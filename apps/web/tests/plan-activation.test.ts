import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createActivation, ProposalNotFoundError } from "@/features/planning/domain/activation";
import { getDb } from "@/lib/db/client";
import { planProposal, trainingPlan, user } from "@/lib/db/schema";

async function fixture() {
  const db = getDb();
  const suffix = crypto.randomUUID();
  const ownerA = `account-a-${suffix}`;
  const ownerB = `account-b-${suffix}`;
  const proposalA = `proposal-a-${suffix}`;
  const planOld = `plan-old-${suffix}`;
  const now = new Date();
  for (const id of [ownerA, ownerB]) {
    await db.insert(user).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  }
  await db.insert(planProposal).values({ id: proposalA, ownerId: ownerA, proposalJson: JSON.stringify({ week: { sessions: [] } }), status: "pending", createdAt: now });
  await db.insert(trainingPlan).values({ id: planOld, ownerId: ownerA, name: "Plan viejo", status: "active", version: 1, contentJson: "{}", createdAt: now });
  return { db, ownerA, ownerB, proposalA, planOld };
}

async function cleanup(db: ReturnType<typeof getDb>, ...ownerIds: string[]) {
  for (const id of ownerIds) await db.delete(user).where(eq(user.id, id));
}

describe("createActivation", () => {
  it("archives the previous active plan and activates the new proposal for its owner", async () => {
    const { db, ownerA, ownerB, proposalA, planOld } = await fixture();
    const activateOwnedProposal = createActivation(db);

    const result = await activateOwnedProposal(ownerA, proposalA);

    expect(result.ownerId).toBe(ownerA);
    const plans = await db.select().from(trainingPlan).where(eq(trainingPlan.ownerId, ownerA));
    expect(plans.find((plan) => plan.id === planOld)?.status).toBe("archived");
    expect(plans.find((plan) => plan.id === result.id)?.status).toBe("active");
    const proposal = (await db.select().from(planProposal).where(eq(planProposal.id, proposalA))).at(0)!;
    expect(proposal.status).toBe("activated");

    await cleanup(db, ownerA, ownerB);
  });

  it("persists template provenance when activation supplies it, and defaults to guided with no provenance", async () => {
    const { db, ownerA, ownerB, proposalA } = await fixture();
    const activateOwnedProposal = createActivation(db);

    const guided = await activateOwnedProposal(ownerA, proposalA);
    const guidedRow = (await db.select().from(trainingPlan).where(eq(trainingPlan.id, guided.id))).at(0)!;
    expect({ source: guidedRow.source, sourceTemplateId: guidedRow.sourceTemplateId, sourceTemplateVersion: guidedRow.sourceTemplateVersion, catalogVersion: guidedRow.catalogVersion })
      .toEqual({ source: "guided", sourceTemplateId: null, sourceTemplateVersion: null, catalogVersion: null });

    const proposalB = `proposal-b-${ownerA}`;
    await db.insert(planProposal).values({ id: proposalB, ownerId: ownerA, proposalJson: JSON.stringify({ week: { sessions: [] } }), status: "pending", createdAt: new Date() });
    const fromTemplate = await activateOwnedProposal(ownerA, proposalB, undefined, {
      source: "template",
      sourceTemplateId: "full-body-gym",
      sourceTemplateVersion: "1.0.0",
      catalogVersion: "catalog-v1"
    });
    const templateRow = (await db.select().from(trainingPlan).where(eq(trainingPlan.id, fromTemplate.id))).at(0)!;
    expect({ source: templateRow.source, sourceTemplateId: templateRow.sourceTemplateId, sourceTemplateVersion: templateRow.sourceTemplateVersion, catalogVersion: templateRow.catalogVersion })
      .toEqual({ source: "template", sourceTemplateId: "full-body-gym", sourceTemplateVersion: "1.0.0", catalogVersion: "catalog-v1" });

    await cleanup(db, ownerA, ownerB);
  });

  it("does not activate another account's proposal and leaves no partial state", async () => {
    const { db, ownerA, ownerB, proposalA } = await fixture();
    const activateOwnedProposal = createActivation(db);

    await expect(activateOwnedProposal(ownerB, proposalA)).rejects.toThrow(ProposalNotFoundError);
    const bPlans = await db.select().from(trainingPlan).where(eq(trainingPlan.ownerId, ownerB));
    expect(bPlans).toHaveLength(0);
    const aPlans = await db.select().from(trainingPlan).where(eq(trainingPlan.ownerId, ownerA));
    expect(aPlans.map((plan) => plan.status)).toEqual(["active"]);

    await cleanup(db, ownerA, ownerB);
  });
});
