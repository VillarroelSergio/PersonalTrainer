import { and, eq } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { planProposal, trainingPlan } from "@/lib/db/schema";

export class ProposalNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() {
    super("Plan proposal not found.");
  }
}

export type ActivationProvenance = {
  source: "template" | "guided";
  sourceTemplateId?: string;
  sourceTemplateVersion?: string;
  catalogVersion?: string;
};

/**
 * Wrapped in a real Postgres transaction so find + archive + create +
 * mark-activated commit or roll back together.
 *
 * `database` is injected (not imported as a singleton) so this can run
 * against a test database.
 */
export function createActivation(database: ReturnType<typeof getDb>) {
  async function runActivation(ownerId: string, proposalId: string, proposalJson: string | undefined, provenance: ActivationProvenance) {
    return database.transaction(async (tx) => {
      const proposal = (await tx
        .select()
        .from(planProposal)
        .where(and(eq(planProposal.id, proposalId), eq(planProposal.ownerId, ownerId))))
        .at(0);
      if (!proposal) throw new ProposalNotFoundError();

      const contentJson = proposalJson ?? proposal.proposalJson;
      if (proposalJson) await tx.update(planProposal).set({ proposalJson }).where(eq(planProposal.id, proposalId));
      await tx.update(trainingPlan).set({ status: "archived" }).where(and(eq(trainingPlan.ownerId, ownerId), eq(trainingPlan.status, "active")));

      const id = crypto.randomUUID();
      await tx
        .insert(trainingPlan)
        .values({
          id, ownerId, name: "Plan activo", status: "active", version: 1, contentJson, createdAt: new Date(),
          source: provenance.source,
          sourceTemplateId: provenance.sourceTemplateId ?? null,
          sourceTemplateVersion: provenance.sourceTemplateVersion ?? null,
          catalogVersion: provenance.catalogVersion ?? null
        });

      await tx.update(planProposal).set({ status: "activated" }).where(eq(planProposal.id, proposalId));

      return { id, ownerId };
    });
  }

  /**
   * Scoped by owner id: activating another account's proposal id throws ProposalNotFoundError.
   * Without an explicit `provenance`, the new plan is recorded as `source: "guided"` (today's
   * only activation path) with the rest of the provenance columns left null.
   */
  return function activateOwnedProposal(ownerId: string, proposalId: string, proposalJson?: string, provenance?: ActivationProvenance): Promise<{ id: string; ownerId: string }> {
    return runActivation(ownerId, proposalId, proposalJson, provenance ?? { source: "guided" });
  };
}
