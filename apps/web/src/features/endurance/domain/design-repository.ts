import { and, eq } from "drizzle-orm";
import type Database from "better-sqlite3";
import type { db as productionDb } from "@/lib/db/client";
import { enduranceSessionDesign, trainingPlan } from "@/lib/db/schema";
import type { EnduranceDesignInput } from "@/contracts/endurance";
import type { PlanProposal } from "@/contracts/onboarding";

type Db = typeof productionDb;

export class ActivePlanNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("No active training plan for this account."); }
}
export class SessionNotEnduranceError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("The requested session is not an endurance session."); }
}
export class DesignNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Endurance session design not found."); }
}

export type EnduranceDesignRow = typeof enduranceSessionDesign.$inferSelect;

/**
 * Saves (or overwrites — same owner/plan/week/sessionIndex never duplicates,
 * same identity model as session_adjustment) the person's own block design
 * for one endurance session occurrence, and separately records "ya está
 * creado en mi reloj" confirmations. Trainer never contacts a watch or any
 * external device; this repository only stores what the person declares.
 */
export function createEnduranceDesignRepository(database: Db, sqliteHandle: Database.Database) {
  const runSaveDesign = sqliteHandle.transaction((ownerId: string, input: EnduranceDesignInput) => {
    const plan = database.select().from(trainingPlan).where(and(eq(trainingPlan.ownerId, ownerId), eq(trainingPlan.status, "active"))).get();
    if (!plan) throw new ActivePlanNotFoundError();
    const proposal = JSON.parse(plan.contentJson) as PlanProposal;
    const plannedSession = proposal.week?.sessions?.[input.sessionIndex];
    if (!plannedSession || plannedSession.kind !== "endurance") throw new SessionNotEnduranceError();

    const id = crypto.randomUUID();
    const now = new Date();
    const values = {
      id, ownerId, planId: plan.id, isoWeekStart: input.isoWeekStart, sessionIndex: input.sessionIndex,
      objective: input.objective, environment: input.environment ?? null,
      optionalLayersJson: input.optionalLayers ? JSON.stringify(input.optionalLayers) : null,
      watchPreparedAt: null, createdAt: now
    };
    database
      .insert(enduranceSessionDesign)
      .values(values)
      .onConflictDoUpdate({
        target: [enduranceSessionDesign.ownerId, enduranceSessionDesign.planId, enduranceSessionDesign.isoWeekStart, enduranceSessionDesign.sessionIndex],
        // Editing an existing design starts a fresh watch-prep confirmation: the blocks may have changed.
        set: { objective: values.objective, environment: values.environment, optionalLayersJson: values.optionalLayersJson, watchPreparedAt: null }
      })
      .run();

    return database.select().from(enduranceSessionDesign).where(and(eq(enduranceSessionDesign.ownerId, ownerId), eq(enduranceSessionDesign.planId, plan.id), eq(enduranceSessionDesign.isoWeekStart, input.isoWeekStart), eq(enduranceSessionDesign.sessionIndex, input.sessionIndex))).get()!;
  });

  const runConfirmWatchPrep = sqliteHandle.transaction((ownerId: string, designId: string) => {
    const row = database.select().from(enduranceSessionDesign).where(and(eq(enduranceSessionDesign.id, designId), eq(enduranceSessionDesign.ownerId, ownerId))).get();
    if (!row) throw new DesignNotFoundError();
    const watchPreparedAt = new Date();
    database.update(enduranceSessionDesign).set({ watchPreparedAt }).where(eq(enduranceSessionDesign.id, designId)).run();
    return { ...row, watchPreparedAt };
  });

  return {
    saveDesign: (ownerId: string, input: EnduranceDesignInput) => runSaveDesign(ownerId, input),
    confirmWatchPrep: (ownerId: string, designId: string) => runConfirmWatchPrep(ownerId, designId),
    getDesign: (ownerId: string, planId: string, isoWeekStart: string, sessionIndex: number) =>
      database.select().from(enduranceSessionDesign).where(and(eq(enduranceSessionDesign.ownerId, ownerId), eq(enduranceSessionDesign.planId, planId), eq(enduranceSessionDesign.isoWeekStart, isoWeekStart), eq(enduranceSessionDesign.sessionIndex, sessionIndex))).get()
  };
}
