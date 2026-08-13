import { and, eq } from "drizzle-orm";
import type Database from "better-sqlite3";
import type { db as productionDb } from "@/lib/db/client";
import { recoverySession, trainingPlan } from "@/lib/db/schema";
import { isoWeekStart } from "@/lib/weekdays";

type Db = typeof productionDb;

export class PlanNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Training plan not found."); }
}
export class RecoverySessionNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Recovery session not found."); }
}
export class RecoverySessionAlreadyClosedError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("This recovery session is already finished."); }
}

/**
 * Real, loggable recovery session (Bloqueante 3): the same shape of
 * start/resume → finish lifecycle as workout_session (Fase 1), but with no
 * session_exercise/set_performance rows at all — it can never contribute
 * strength volume or feed the progression baseline (progression only ever
 * reads rows reachable from workout_session).
 */
export function createRecoverySessionRepository(database: Db, sqliteHandle: Database.Database) {
  const runStartOrResume = sqliteHandle.transaction((ownerId: string, planId: string, sessionIndex: number) => {
    const existing = database.select().from(recoverySession)
      .where(and(eq(recoverySession.ownerId, ownerId), eq(recoverySession.planId, planId), eq(recoverySession.sessionIndex, sessionIndex), eq(recoverySession.status, "in_progress")))
      .get();
    if (existing) return existing;

    const plan = database.select().from(trainingPlan).where(and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId))).get();
    if (!plan) throw new PlanNotFoundError();

    const id = crypto.randomUUID();
    const now = new Date();
    database.insert(recoverySession).values({ id, ownerId, planId, sessionIndex, status: "in_progress", startedAt: now, createdAt: now }).run();
    return database.select().from(recoverySession).where(eq(recoverySession.id, id)).get()!;
  });

  const runFinish = sqliteHandle.transaction((ownerId: string, id: string, comment: string | null) => {
    const row = database.select().from(recoverySession).where(and(eq(recoverySession.id, id), eq(recoverySession.ownerId, ownerId))).get();
    if (!row) throw new RecoverySessionNotFoundError();
    if (row.status === "completed") throw new RecoverySessionAlreadyClosedError();
    const now = new Date();
    database.update(recoverySession).set({ status: "completed", endedAt: now, comment }).where(eq(recoverySession.id, id)).run();
    return database.select().from(recoverySession).where(eq(recoverySession.id, id)).get()!;
  });

  return {
    startOrResume: (ownerId: string, planId: string, sessionIndex: number) => runStartOrResume(ownerId, planId, sessionIndex),
    /** Most recent recovery session for this occurrence (any status), for a page reload to show the right state without creating one. */
    findLatest: (ownerId: string, planId: string, sessionIndex: number) =>
      database.select().from(recoverySession)
        .where(and(eq(recoverySession.ownerId, ownerId), eq(recoverySession.planId, planId), eq(recoverySession.sessionIndex, sessionIndex)))
        .orderBy(recoverySession.startedAt).all().at(-1) ?? null,
    finish: (ownerId: string, id: string, comment: string | null = null) => runFinish(ownerId, id, comment),
    /** Latest known status per session index, for /hoy — same "latest wins, not week-scoped" simplification as workout_session.listLatestStatuses. */
    listLatestStatuses: (ownerId: string, planId: string): Record<number, string> => {
      const rows = database.select({ sessionIndex: recoverySession.sessionIndex, status: recoverySession.status, startedAt: recoverySession.startedAt })
        .from(recoverySession).where(and(eq(recoverySession.ownerId, ownerId), eq(recoverySession.planId, planId))).orderBy(recoverySession.startedAt).all();
      const byIndex: Record<number, string> = {};
      for (const row of rows) byIndex[row.sessionIndex] = row.status;
      return byIndex;
    },
    /** Completed recovery sessions, shaped for history-engine's adherence computation: a completed recovery session counts as adherence ("adaptada" — a softened, non-strength version of the planned occurrence), never as full strength volume. */
    listCompletedForAdherence: (ownerId: string, planId: string): Array<{ sessionIndex: number; isoWeekStart: string; status: "adapted" }> =>
      database.select({ sessionIndex: recoverySession.sessionIndex, startedAt: recoverySession.startedAt })
        .from(recoverySession)
        .where(and(eq(recoverySession.ownerId, ownerId), eq(recoverySession.planId, planId), eq(recoverySession.status, "completed")))
        .all()
        .map((row) => ({ sessionIndex: row.sessionIndex, isoWeekStart: isoWeekStart(row.startedAt), status: "adapted" as const }))
  };
}
