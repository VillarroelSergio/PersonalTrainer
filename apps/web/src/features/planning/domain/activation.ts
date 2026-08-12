import { and, eq } from "drizzle-orm";
import type Database from "better-sqlite3";
import type { db as productionDb } from "@/lib/db/client";
import { planProposal, trainingPlan } from "@/lib/db/schema";

export class ProposalNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() {
    super("Plan proposal not found.");
  }
}

/**
 * better-sqlite3 is synchronous end-to-end, and its native `.transaction()`
 * wrapper commits as soon as the callback *returns* — it does not await a
 * Promise. So this stays a plain (non-async) function built from drizzle's
 * synchronous `.get()`/`.run()` calls, never `await`, to guarantee find +
 * archive + create + mark-activated commit or roll back together.
 *
 * `database`/`sqliteHandle` are injected (not imported as a singleton) so
 * this can run against an in-memory database in tests.
 */
export function createActivation(database: typeof productionDb, sqliteHandle: Database.Database) {
  const runActivation = sqliteHandle.transaction((ownerId: string, proposalId: string, proposalJson?: string) => {
    const proposal = database
      .select()
      .from(planProposal)
      .where(and(eq(planProposal.id, proposalId), eq(planProposal.ownerId, ownerId)))
      .get();
    if (!proposal) throw new ProposalNotFoundError();

    const contentJson = proposalJson ?? proposal.proposalJson;
    if (proposalJson) database.update(planProposal).set({ proposalJson }).where(eq(planProposal.id, proposalId)).run();
    database.update(trainingPlan).set({ status: "archived" }).where(and(eq(trainingPlan.ownerId, ownerId), eq(trainingPlan.status, "active"))).run();

    const id = crypto.randomUUID();
    database
      .insert(trainingPlan)
      .values({ id, ownerId, name: "Plan activo", status: "active", version: 1, contentJson, createdAt: new Date() })
      .run();

    database.update(planProposal).set({ status: "activated" }).where(eq(planProposal.id, proposalId)).run();

    return { id, ownerId };
  });

  /** Scoped by owner id: activating another account's proposal id throws ProposalNotFoundError. */
  return function activateOwnedProposal(ownerId: string, proposalId: string, proposalJson?: string): { id: string; ownerId: string } {
    return runActivation(ownerId, proposalId, proposalJson);
  };
}
