import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createShareCopyRepository, createShareLink, previewSharedRoutine, revokeOwnedShareLink, ShareLinkNotFoundError } from "@/features/planning/domain/share-repository";
import { getDb } from "@/lib/db/client";
import { trainingPlan, user } from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

const proposal: PlanProposal = {
  proposalId: "proposal-a",
  ruleVersion: "plan-proposal-v1",
  reasons: [],
  alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
  week: { sessions: [{ day: "monday", kind: "strength", title: "Fuerza: piernas", estimatedMinutes: 60, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] }] }
};

async function fixture() {
  const db = getDb();
  const suffix = crypto.randomUUID();
  const ownerA = `account-a-${suffix}`;
  const ownerB = `account-b-${suffix}`;
  const planA = `plan-a-${suffix}`;
  const now = new Date();
  for (const id of [ownerA, ownerB]) {
    await db.insert(user).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  }
  await db.insert(trainingPlan).values({ id: planA, ownerId: ownerA, name: "Plan A", status: "active", version: 1, contentJson: JSON.stringify(proposal), createdAt: now });
  return { db, ownerA, ownerB, planA };
}

async function cleanup(db: ReturnType<typeof getDb>, ...ownerIds: string[]) {
  for (const id of ownerIds) await db.delete(user).where(eq(user.id, id));
}

describe("share-repository", () => {
  it("creates an independent copy that never links back to the origin's loads, history, or later edits", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const { token } = await createShareLink(db, ownerA, planA);

    const preview = await previewSharedRoutine(db, token);
    expect(preview.planName).toBe("Plan A");
    expect(preview.sessionCount).toBe(1);
    expect(preview).not.toHaveProperty("ownerId");
    expect(preview).not.toHaveProperty("loads");

    const copyRepo = createShareCopyRepository(db);
    const { planId: copiedPlanId } = await copyRepo.copySharedRoutine(token, ownerB);
    expect(copiedPlanId).not.toBe(planA);

    const copiedRow = (await db.select().from(trainingPlan).where(eq(trainingPlan.id, copiedPlanId))).at(0)!;
    expect(copiedRow.ownerId).toBe(ownerB);
    expect(copiedRow.status).toBe("active");
    expect(JSON.parse(copiedRow.contentJson)).toEqual(proposal);

    // Editing the origin afterwards never touches the already-made copy.
    await db.update(trainingPlan).set({ contentJson: JSON.stringify({ ...proposal, initialBlock: { ...proposal.initialBlock, name: "Bloque cambiado" } }) }).where(eq(trainingPlan.id, planA));
    const stillOriginal = (await db.select().from(trainingPlan).where(eq(trainingPlan.id, copiedPlanId))).at(0)!;
    expect(JSON.parse(stillOriginal.contentJson).initialBlock.name).toBe("Bloque");

    await cleanup(db, ownerA, ownerB);
  });

  it("archives the copier's previous active plan, same invariant as activating a proposal", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const now = new Date();
    const planBOld = `plan-b-old-${ownerB}`;
    await db.insert(trainingPlan).values({ id: planBOld, ownerId: ownerB, name: "Plan viejo de B", status: "active", version: 1, contentJson: "{}", createdAt: now });
    const { token } = await createShareLink(db, ownerA, planA);

    const copyRepo = createShareCopyRepository(db);
    await copyRepo.copySharedRoutine(token, ownerB);

    const old = (await db.select().from(trainingPlan).where(eq(trainingPlan.id, planBOld))).at(0)!;
    expect(old.status).toBe("archived");
    const activeRows = await db.select().from(trainingPlan).where(and(eq(trainingPlan.ownerId, ownerB), eq(trainingPlan.status, "active")));
    expect(activeRows).toHaveLength(1);

    await cleanup(db, ownerA, ownerB);
  });

  it("a revoked link can no longer be previewed or copied", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const { token } = await createShareLink(db, ownerA, planA);
    const created = await db.query.shareLink.findFirst({ where: (row, { eq }) => eq(row.id, token) });
    await revokeOwnedShareLink(db, ownerA, created!.id);

    await expect(previewSharedRoutine(db, token)).rejects.toThrow(ShareLinkNotFoundError);
    const copyRepo = createShareCopyRepository(db);
    await expect(copyRepo.copySharedRoutine(token, ownerB)).rejects.toThrow(ShareLinkNotFoundError);

    await cleanup(db, ownerA, ownerB);
  });
});
