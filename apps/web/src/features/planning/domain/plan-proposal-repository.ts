import { and, eq } from "drizzle-orm";
import type { db as productionDb } from "@/lib/db/client";
import { planProposal } from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

type Database = typeof productionDb;

/** Idempotent by proposal id (== clientOperationId): retrying the same submission overwrites, never duplicates. */
export async function saveOwnedProposal(database: Database, ownerId: string, proposal: PlanProposal): Promise<void> {
  const now = new Date();
  await database
    .insert(planProposal)
    .values({ id: proposal.proposalId, ownerId, proposalJson: JSON.stringify(proposal), status: "pending", createdAt: now })
    .onConflictDoUpdate({ target: planProposal.id, set: { proposalJson: JSON.stringify(proposal) } });
}

/** Scoped by owner id: a foreign proposal id returns undefined, never another account's data. */
export async function findOwnedProposal(database: Database, ownerId: string, proposalId: string) {
  return database.query.planProposal.findFirst({ where: and(eq(planProposal.id, proposalId), eq(planProposal.ownerId, ownerId)) });
}
