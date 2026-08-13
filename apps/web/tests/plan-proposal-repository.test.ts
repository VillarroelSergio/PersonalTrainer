import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { findOwnedProposal, saveOwnedProposal } from "@/features/planning/domain/plan-proposal-repository";
import { getDb } from "@/lib/db/client";
import { planProposal, user } from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

async function fixture() {
  const db = getDb();
  const suffix = crypto.randomUUID();
  const ownerA = `account-a-${suffix}`;
  const ownerB = `account-b-${suffix}`;
  const now = new Date();
  for (const id of [ownerA, ownerB]) {
    await db.insert(user).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  }
  return { db, ownerA, ownerB, suffix };
}

async function cleanup(db: ReturnType<typeof getDb>, ...ownerIds: string[]) {
  for (const id of ownerIds) await db.delete(user).where(eq(user.id, id));
}

function proposalFor(suffix: string): PlanProposal {
  return {
    proposalId: `proposal-a-${suffix}`,
    ruleVersion: "plan-proposal-v1",
    reasons: [],
    alternatives: [],
    initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
    week: { sessions: [] }
  };
}

describe("plan proposal repository", () => {
  it("finds a proposal only for its owner", async () => {
    const { db, ownerA, ownerB, suffix } = await fixture();
    const proposal = proposalFor(suffix);
    await saveOwnedProposal(db, ownerA, proposal);

    expect((await findOwnedProposal(db, ownerA, proposal.proposalId))?.ownerId).toBe(ownerA);
    expect(await findOwnedProposal(db, ownerB, proposal.proposalId)).toBeUndefined();

    await cleanup(db, ownerA, ownerB);
  });

  it("is idempotent: resubmitting the same clientOperationId overwrites instead of duplicating", async () => {
    const { db, ownerA, ownerB, suffix } = await fixture();
    const proposal = proposalFor(suffix);
    await saveOwnedProposal(db, ownerA, proposal);
    await saveOwnedProposal(db, ownerA, { ...proposal, confidence: 0.9 });

    const rows = await db.select().from(planProposal).where(eq(planProposal.ownerId, ownerA));
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].proposalJson).confidence).toBe(0.9);

    await cleanup(db, ownerA, ownerB);
  });
});
