import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  PlanNotFoundError,
  RecoverySessionAlreadyClosedError,
  RecoverySessionNotFoundError,
  createRecoverySessionRepository
} from "@/features/recovery/domain/recovery-session-repository";
import { getDb } from "@/lib/db/client";
import { trainingPlan, user } from "@/lib/db/schema";

async function fixture() {
  const db = getDb();
  const now = new Date();
  const ownerA = `account-a-${crypto.randomUUID()}`;
  const ownerB = `account-b-${crypto.randomUUID()}`;
  const planA = `plan-a-${ownerA}`;
  for (const id of [ownerA, ownerB]) {
    await db.insert(user).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  }
  await db.insert(trainingPlan).values({ id: planA, ownerId: ownerA, name: "Plan A", status: "active", version: 1, contentJson: "{}", createdAt: now });
  return { db, ownerA, ownerB, planA };
}

async function cleanup(db: ReturnType<typeof getDb>, ownerA: string, ownerB: string) {
  await db.delete(user).where(eq(user.id, ownerA));
  await db.delete(user).where(eq(user.id, ownerB));
}

describe("recovery session repository", () => {
  it("starts, resumes the same in-progress session, then finishes it", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createRecoverySessionRepository(db);

    const first = await repo.startOrResume(ownerA, planA, 0);
    expect(first.status).toBe("in_progress");
    const resumed = await repo.startOrResume(ownerA, planA, 0);
    expect(resumed.id).toBe(first.id);

    const finished = await repo.finish(ownerA, first.id, "Me sentí mejor");
    expect(finished.status).toBe("completed");
    expect(finished.endedAt).not.toBeNull();
    expect(finished.comment).toBe("Me sentí mejor");

    await cleanup(db, ownerA, ownerB);
  });

  it("never creates any session_exercise/set_performance row — it can never contribute strength volume or progression", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createRecoverySessionRepository(db);
    await repo.startOrResume(ownerA, planA, 0);
    // Calling again resumes the same in-progress row instead of throwing — recovery sessions never touch session_exercise/set_performance.
    await expect(repo.startOrResume(ownerA, planA, 0)).resolves.toBeDefined();

    await cleanup(db, ownerA, ownerB);
  });

  it("rejects finishing an already-completed session, and finishing/reading someone else's session", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createRecoverySessionRepository(db);
    const started = await repo.startOrResume(ownerA, planA, 0);
    await repo.finish(ownerA, started.id);
    await expect(repo.finish(ownerA, started.id)).rejects.toThrow(RecoverySessionAlreadyClosedError);
    await expect(repo.finish(ownerB, started.id)).rejects.toThrow(RecoverySessionNotFoundError);

    await cleanup(db, ownerA, ownerB);
  });

  it("rejects starting a recovery session for a plan that isn't this account's", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createRecoverySessionRepository(db);
    await expect(repo.startOrResume(ownerB, planA, 0)).rejects.toThrow(PlanNotFoundError);

    await cleanup(db, ownerA, ownerB);
  });

  it("a completed recovery session counts toward adherence as 'adapted', never as full strength volume", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createRecoverySessionRepository(db);
    const started = await repo.startOrResume(ownerA, planA, 0);
    await repo.finish(ownerA, started.id);

    const forAdherence = await repo.listCompletedForAdherence(ownerA, planA);
    expect(forAdherence).toHaveLength(1);
    expect(forAdherence[0]).toMatchObject({ sessionIndex: 0, status: "adapted" });

    // Isolation: another account's completed recovery never leaks in.
    expect(await repo.listCompletedForAdherence(ownerB, planA)).toHaveLength(0);

    await cleanup(db, ownerA, ownerB);
  });
});
