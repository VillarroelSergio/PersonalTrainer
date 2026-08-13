import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { youtubeSearchUrl } from "@/features/catalog/domain/video-link";
import { getDb } from "@/lib/db/client";
import { trainingPlan, user } from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

const proposal: PlanProposal = {
  proposalId: "p1", ruleVersion: "plan-proposal-v1", reasons: [], alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Base", weeks: 4 },
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Empuje", estimatedMinutes: 40, exercises: [{ variantId: "push-h-bench", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] },
      { day: "wednesday", kind: "strength", title: "Piernas", estimatedMinutes: 40, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] }
    ]
  }
};

async function fixture() {
  const db = getDb();
  const now = new Date();
  const ownerId = `account-a-${crypto.randomUUID()}`;
  const planId = `plan-a-${ownerId}`;
  await db.insert(user).values({ id: ownerId, name: ownerId, email: `${ownerId}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  await db.insert(trainingPlan).values({ id: planId, ownerId, name: "Plan A", status: "active", version: 1, contentJson: JSON.stringify(proposal), createdAt: now });
  return { db, ownerId, planId };
}

async function cleanup(db: ReturnType<typeof getDb>, ownerId: string) {
  await db.delete(user).where(eq(user.id, ownerId));
}

describe("listRecentVariantIds (Bloqueante 5)", () => {
  it("returns real history variants, most recent first, deduplicated, owner-scoped", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createWorkoutSessionRepository(db);

    await repo.startOrResumeWorkout(ownerId, planId, 0); // push-h-bench
    await repo.startOrResumeWorkout(ownerId, planId, 1); // squat-barbell, more recent

    const recent = await repo.listRecentVariantIds(ownerId, 5);
    expect(recent).toEqual(["squat-barbell", "push-h-bench"]);
    expect(await repo.listRecentVariantIds("account-b-nonexistent", 5)).toEqual([]);

    await cleanup(db, ownerId);
  });

  it("respects the limit", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createWorkoutSessionRepository(db);
    await repo.startOrResumeWorkout(ownerId, planId, 0);
    await repo.startOrResumeWorkout(ownerId, planId, 1);
    expect(await repo.listRecentVariantIds(ownerId, 1)).toHaveLength(1);

    await cleanup(db, ownerId);
  });
});

describe("youtubeSearchUrl (Bloqueante 5)", () => {
  it("builds a labeled external search URL, never a specific invented video", () => {
    const url = youtubeSearchUrl("Sentadilla", "Sentadilla con barra");
    expect(url).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
    expect(url).not.toMatch(/\/watch\?v=/);
    expect(decodeURIComponent(url.split("=")[1])).toContain("Sentadilla con barra");
  });
});
