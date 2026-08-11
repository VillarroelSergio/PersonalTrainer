import { and, eq } from "drizzle-orm";
import type Database from "better-sqlite3";
import type { db as productionDb } from "@/lib/db/client";
import { sessionAdjustment, trainingPlan, workoutSession } from "@/lib/db/schema";
import { isoWeekStart, parseIsoDateLocal } from "@/lib/weekdays";
import { ADDED_SESSION_INDEX_BASE } from "./plan-week";
import type { PlanEditInput } from "@/contracts/plan";
import type { PlanProposal } from "@/contracts/onboarding";

type Db = typeof productionDb;

export class PlanNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Training plan not found."); }
}
export class PastWeekError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("Cannot edit a week that has already started or passed."); }
}
export class SessionAlreadyExecutedError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("This session already has an execution record for this week and can no longer be edited."); }
}
export class InvalidSessionIndexError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("This session does not exist in the plan template."); }
}
export class AdjustmentNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("No adjustment exists for this occurrence."); }
}
export class InvalidWeekStartError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("isoWeekStart must be the Monday of its own ISO week."); }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Direct manual edits to future plan occurrences (Bloqueante 1), separate
 * from the check-in-driven recommendation flow (Fase 2) but sharing the same
 * `session_adjustment` per-occurrence identity — (owner, plan, isoWeekStart,
 * sessionIndex) — so a moved session is never a second agenda entry, and
 * re-applying the same edit overwrites rather than duplicating.
 */
export function createPlanEditRepository(database: Db, sqliteHandle: Database.Database) {
  function loadOwnedPlan(ownerId: string, planId: string) {
    const plan = database.select().from(trainingPlan).where(and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId))).get();
    if (!plan) throw new PlanNotFoundError();
    return { plan, proposal: JSON.parse(plan.contentJson) as PlanProposal };
  }

  function assertFutureWeek(weekStartIso: string) {
    if (isoWeekStart(parseIsoDateLocal(weekStartIso)) !== weekStartIso) throw new InvalidWeekStartError();
    if (weekStartIso < isoWeekStart()) throw new PastWeekError();
  }

  /** A workout_session shares (planId, sessionIndex) identity across every week it recurs in; "already executed for this week" means a real row whose startedAt falls inside this week's date range. */
  function assertNotExecutedThisWeek(ownerId: string, planId: string, sessionIndex: number, weekStartIso: string) {
    const weekStart = parseIsoDateLocal(weekStartIso);
    const weekEnd = addDays(weekStart, 7);
    const rows = database.select({ startedAt: workoutSession.startedAt }).from(workoutSession)
      .where(and(eq(workoutSession.ownerId, ownerId), eq(workoutSession.planId, planId), eq(workoutSession.sessionIndex, sessionIndex))).all();
    if (rows.some((row) => row.startedAt >= weekStart && row.startedAt < weekEnd)) throw new SessionAlreadyExecutedError();
  }

  function upsertAdjustment(ownerId: string, planId: string, weekStartIso: string, sessionIndex: number, originDay: string, kind: string, targetDay: string | null, opsJson: string) {
    const id = crypto.randomUUID();
    const now = new Date();
    database.insert(sessionAdjustment)
      .values({ id, ownerId, planId, isoWeekStart: weekStartIso, sessionIndex, originDay, kind, targetDay, opsJson, recommendationId: null, createdAt: now })
      .onConflictDoUpdate({
        target: [sessionAdjustment.ownerId, sessionAdjustment.planId, sessionAdjustment.isoWeekStart, sessionAdjustment.sessionIndex],
        set: { id, originDay, kind, targetDay, opsJson, recommendationId: null, createdAt: now }
      })
      .run();
    return database.select().from(sessionAdjustment)
      .where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, planId), eq(sessionAdjustment.isoWeekStart, weekStartIso), eq(sessionAdjustment.sessionIndex, sessionIndex))).get()!;
  }

  const runEdit = sqliteHandle.transaction((ownerId: string, planId: string, input: PlanEditInput) => {
    assertFutureWeek(input.isoWeekStart);

    if (input.kind === "restore") {
      database.delete(sessionAdjustment).where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, planId), eq(sessionAdjustment.isoWeekStart, input.isoWeekStart), eq(sessionAdjustment.sessionIndex, input.sessionIndex))).run();
      return { deleted: true as const };
    }

    if (input.kind === "remove_added") {
      if (input.sessionIndex < ADDED_SESSION_INDEX_BASE) throw new InvalidSessionIndexError();
      const existing = database.select().from(sessionAdjustment).where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, planId), eq(sessionAdjustment.isoWeekStart, input.isoWeekStart), eq(sessionAdjustment.sessionIndex, input.sessionIndex), eq(sessionAdjustment.kind, "added"))).get();
      if (!existing) throw new AdjustmentNotFoundError();
      database.delete(sessionAdjustment).where(eq(sessionAdjustment.id, existing.id)).run();
      return { deleted: true as const };
    }

    if (input.kind === "add") {
      const { plan } = loadOwnedPlan(ownerId, planId);
      const existingAdded = database.select({ sessionIndex: sessionAdjustment.sessionIndex }).from(sessionAdjustment)
        .where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, plan.id), eq(sessionAdjustment.isoWeekStart, input.isoWeekStart), eq(sessionAdjustment.kind, "added"))).all();
      const nextUsed = existingAdded.reduce((max, row) => Math.max(max, row.sessionIndex), ADDED_SESSION_INDEX_BASE - 1);
      const sessionIndex = nextUsed + 1;
      const ops = { title: input.title, kind: input.sessionKind, estimatedMinutes: input.estimatedMinutes };
      return upsertAdjustment(ownerId, plan.id, input.isoWeekStart, sessionIndex, input.day, "added", input.day, JSON.stringify(ops));
    }

    // move / skip / remove all target an existing template occurrence.
    const { plan, proposal } = loadOwnedPlan(ownerId, planId);
    const plannedSession = proposal.week?.sessions?.[input.sessionIndex];
    if (!plannedSession) throw new InvalidSessionIndexError();
    assertNotExecutedThisWeek(ownerId, plan.id, input.sessionIndex, input.isoWeekStart);

    if (input.kind === "move") {
      const ops = JSON.stringify([{ op: "reschedule", targetDay: input.targetDay }]);
      return upsertAdjustment(ownerId, plan.id, input.isoWeekStart, input.sessionIndex, plannedSession.day, "reschedule", input.targetDay, ops);
    }
    if (input.kind === "skip") {
      return upsertAdjustment(ownerId, plan.id, input.isoWeekStart, input.sessionIndex, plannedSession.day, "skipped", null, "[]");
    }
    // remove
    return upsertAdjustment(ownerId, plan.id, input.isoWeekStart, input.sessionIndex, plannedSession.day, "removed", null, "[]");
  });

  return {
    applyEdit: (ownerId: string, planId: string, input: PlanEditInput) => runEdit(ownerId, planId, input),
    listWeekAdjustments: (ownerId: string, planId: string, weekStartIso: string) =>
      database.select({ sessionIndex: sessionAdjustment.sessionIndex, kind: sessionAdjustment.kind, targetDay: sessionAdjustment.targetDay, opsJson: sessionAdjustment.opsJson })
        .from(sessionAdjustment)
        .where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, planId), eq(sessionAdjustment.isoWeekStart, weekStartIso)))
        .all()
  };
}
