import { and, eq, inArray } from "drizzle-orm";
import type Database from "better-sqlite3";
import type { db as productionDb } from "@/lib/db/client";
import { performanceBaseline, sessionExercise, setPerformance, trainingPlan, workoutSession } from "@/lib/db/schema";
import { findVariant } from "@/features/catalog/data/exercise-catalog";
import { computeBaseline, type Exposure, type SessionCloseStatus, type SetDifficulty } from "./progression";
import type { PlanProposal } from "@/contracts/onboarding";
import type { RecommendationOp } from "@/contracts/training-engine";

type AssignedExercise = NonNullable<PlanProposal["week"]["sessions"][number]["exercises"]>[number];

/** Applies an applied recommendation's mechanical ops to a session's assigned exercises. Pure — never touches the plan template. */
export function applyAdjustmentOps(exercises: AssignedExercise[], ops: RecommendationOp[]): AssignedExercise[] {
  let result = exercises.map((exercise) => ({ ...exercise }));
  for (const op of ops) {
    if (op.op === "remove_exercise") result = result.filter((_, position) => position !== op.position);
    else if (op.op === "reduce_sets" && result[op.position]) result[op.position] = { ...result[op.position], targetSets: Math.max(1, result[op.position].targetSets - op.by) };
    else if (op.op === "replace_variant" && result[op.position]) result[op.position] = { ...result[op.position], variantId: op.toVariantId };
  }
  return result;
}

type Db = typeof productionDb;
const FINISHED_STATUSES = ["completed", "adapted", "partial"] as const;

export class PlanNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Training plan not found."); }
}
export class SessionNotStrengthError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("The requested session is not a strength session with assigned exercises."); }
}
export class WorkoutNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Workout session not found."); }
}
export class SessionExerciseNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Session exercise not found."); }
}
export class VersionConflictError extends Error {
  code = "VERSION_CONFLICT" as const;
  constructor(public currentVersion: number) { super("The session changed elsewhere since this device last saw it."); }
}

/**
 * All writes are wrapped in better-sqlite3's synchronous `.transaction()`
 * (see activation.ts for why: it commits on callback return, never awaits),
 * built from injected `database`/`sqliteHandle` so tests can use an
 * in-memory database.
 */
export function createWorkoutSessionRepository(database: Db, sqliteHandle: Database.Database) {
  const runStartOrResume = sqliteHandle.transaction((ownerId: string, planId: string, sessionIndex: number, adjustmentOps: RecommendationOp[] = []) => {
    const existing = database
      .select()
      .from(workoutSession)
      .where(and(eq(workoutSession.ownerId, ownerId), eq(workoutSession.planId, planId), eq(workoutSession.sessionIndex, sessionIndex), eq(workoutSession.status, "in_progress")))
      .get();
    if (existing) {
      const exercises = database.select().from(sessionExercise).where(and(eq(sessionExercise.workoutSessionId, existing.id), eq(sessionExercise.status, "active"))).all();
      const exercisesWithSets = exercises.map((exercise) => ({
        ...exercise,
        sets: database.select().from(setPerformance).where(eq(setPerformance.sessionExerciseId, exercise.id)).orderBy(setPerformance.setNumber).all()
      }));
      return { workoutSession: existing, sessionExercises: exercisesWithSets };
    }

    const plan = database.select().from(trainingPlan).where(and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId))).get();
    if (!plan) throw new PlanNotFoundError();

    const proposal = JSON.parse(plan.contentJson) as PlanProposal;
    const plannedSession = proposal.week?.sessions?.[sessionIndex];
    if (!plannedSession || plannedSession.kind !== "strength" || !plannedSession.exercises?.length) throw new SessionNotStrengthError();

    const id = crypto.randomUUID();
    const now = new Date();
    database.insert(workoutSession).values({ id, ownerId, planId, sessionIndex, status: "in_progress", startedAt: now, createdAt: now }).run();

    const assigned = applyAdjustmentOps(plannedSession.exercises, adjustmentOps);
    const exercises = assigned.map((exercise, position) => ({
      id: crypto.randomUUID(),
      workoutSessionId: id,
      variantId: exercise.variantId,
      position,
      status: "active" as const,
      targetSets: exercise.targetSets,
      targetRepsMin: exercise.targetRepsMin,
      targetRepsMax: exercise.targetRepsMax
    }));
    for (const exercise of exercises) database.insert(sessionExercise).values(exercise).run();

    return { workoutSession: { id, ownerId, planId, sessionIndex, status: "in_progress" as const, version: 1, startedAt: now, endedAt: null, globalEffort: null, comment: null, discomfortJson: null, createdAt: now }, sessionExercises: exercises };
  });

  const runRecordSet = sqliteHandle.transaction((ownerId: string, workoutSessionId: string, sessionExerciseId: string, setNumber: number, loadKg: number | null, repetitions: number | null, difficulty: SetDifficulty | null) => {
    const owned = database.select().from(workoutSession).where(and(eq(workoutSession.id, workoutSessionId), eq(workoutSession.ownerId, ownerId))).get();
    if (!owned) throw new WorkoutNotFoundError();
    const exercise = database.select().from(sessionExercise).where(and(eq(sessionExercise.id, sessionExerciseId), eq(sessionExercise.workoutSessionId, workoutSessionId))).get();
    if (!exercise) throw new SessionExerciseNotFoundError();

    database
      .insert(setPerformance)
      .values({ id: crypto.randomUUID(), sessionExerciseId, setNumber, loadKg, repetitions, difficulty, completedAt: new Date() })
      .onConflictDoUpdate({ target: [setPerformance.sessionExerciseId, setPerformance.setNumber], set: { loadKg, repetitions, difficulty, completedAt: new Date() } })
      .run();
  });

  const runRemoveSet = sqliteHandle.transaction((ownerId: string, workoutSessionId: string, sessionExerciseId: string, setNumber: number) => {
    const owned = database.select().from(workoutSession).where(and(eq(workoutSession.id, workoutSessionId), eq(workoutSession.ownerId, ownerId))).get();
    if (!owned) throw new WorkoutNotFoundError();
    const exercise = database.select().from(sessionExercise).where(and(eq(sessionExercise.id, sessionExerciseId), eq(sessionExercise.workoutSessionId, workoutSessionId))).get();
    if (!exercise) throw new SessionExerciseNotFoundError();

    database.delete(setPerformance).where(and(eq(setPerformance.sessionExerciseId, sessionExerciseId), eq(setPerformance.setNumber, setNumber))).run();
  });

  const runSubstituteVariant = sqliteHandle.transaction((ownerId: string, workoutSessionId: string, sessionExerciseId: string, newVariantId: string) => {
    const owned = database.select().from(workoutSession).where(and(eq(workoutSession.id, workoutSessionId), eq(workoutSession.ownerId, ownerId))).get();
    if (!owned) throw new WorkoutNotFoundError();
    const previous = database.select().from(sessionExercise).where(and(eq(sessionExercise.id, sessionExerciseId), eq(sessionExercise.workoutSessionId, workoutSessionId))).get();
    if (!previous) throw new SessionExerciseNotFoundError();
    if (!findVariant(newVariantId)) throw new SessionExerciseNotFoundError();

    database.update(sessionExercise).set({ status: "replaced" }).where(eq(sessionExercise.id, sessionExerciseId)).run();
    const replacement = {
      id: crypto.randomUUID(),
      workoutSessionId,
      variantId: newVariantId,
      position: previous.position,
      status: "active" as const,
      targetSets: previous.targetSets,
      targetRepsMin: previous.targetRepsMin,
      targetRepsMax: previous.targetRepsMax
    };
    database.insert(sessionExercise).values(replacement).run();
    return replacement;
  });

  const runFinish = sqliteHandle.transaction((ownerId: string, workoutSessionId: string, clientOperationId: string, baseVersion: number, status: SessionCloseStatus, globalEffort: number | null, comment: string | null, discomfortJson: string | null) => {
    const owned = database.select().from(workoutSession).where(and(eq(workoutSession.id, workoutSessionId), eq(workoutSession.ownerId, ownerId))).get();
    if (!owned) throw new WorkoutNotFoundError();
    // Replaying the exact same offline operation (outbox retry after the first attempt already succeeded) is a no-op success, never a conflict.
    if (owned.lastFinishOperationId === clientOperationId) return;
    if (owned.version !== baseVersion) throw new VersionConflictError(owned.version);

    database.update(workoutSession).set({ status, version: owned.version + 1, lastFinishOperationId: clientOperationId, endedAt: new Date(), globalEffort, comment, discomfortJson }).where(eq(workoutSession.id, workoutSessionId)).run();

    const exercises = database.select().from(sessionExercise).where(eq(sessionExercise.workoutSessionId, workoutSessionId)).all();
    const variantIds = [...new Set(exercises.map((exercise) => exercise.variantId))];
    for (const variantId of variantIds) {
      const exposures = loadExposures(database, ownerId, variantId);
      const baseline = computeBaseline(exposures);
      database
        .insert(performanceBaseline)
        .values({ ownerId, variantId, confidence: Math.round(baseline.confidence * 100), summaryJson: JSON.stringify(baseline), ruleVersion: baseline.ruleVersion, calculatedAt: new Date() })
        .onConflictDoUpdate({ target: [performanceBaseline.ownerId, performanceBaseline.variantId], set: { confidence: Math.round(baseline.confidence * 100), summaryJson: JSON.stringify(baseline), ruleVersion: baseline.ruleVersion, calculatedAt: new Date() } })
        .run();
    }
  });

  return {
    startOrResumeWorkout: (ownerId: string, planId: string, sessionIndex: number, adjustmentOps: RecommendationOp[] = []) => runStartOrResume(ownerId, planId, sessionIndex, adjustmentOps),
    recordSet: (ownerId: string, workoutSessionId: string, sessionExerciseId: string, setNumber: number, loadKg: number | null, repetitions: number | null, difficulty: SetDifficulty | null) =>
      runRecordSet(ownerId, workoutSessionId, sessionExerciseId, setNumber, loadKg, repetitions, difficulty),
    removeSet: (ownerId: string, workoutSessionId: string, sessionExerciseId: string, setNumber: number) =>
      runRemoveSet(ownerId, workoutSessionId, sessionExerciseId, setNumber),
    substituteVariant: (ownerId: string, workoutSessionId: string, sessionExerciseId: string, newVariantId: string) => runSubstituteVariant(ownerId, workoutSessionId, sessionExerciseId, newVariantId),
    finishWorkout: (ownerId: string, workoutSessionId: string, clientOperationId: string, baseVersion: number, status: SessionCloseStatus, globalEffort: number | null, comment: string | null, discomfortJson: string | null) =>
      runFinish(ownerId, workoutSessionId, clientOperationId, baseVersion, status, globalEffort, comment, discomfortJson),
    getBaseline: (ownerId: string, variantId: string) => database.select().from(performanceBaseline).where(and(eq(performanceBaseline.ownerId, ownerId), eq(performanceBaseline.variantId, variantId))).get(),
    /** Every finished (or in-progress) session for this plan, most recent first — the real chronological source for Historial (Fase 3), never a fixture. Owner-scoped. */
    listSessionHistory: (ownerId: string, planId: string) =>
      database
        .select({ id: workoutSession.id, sessionIndex: workoutSession.sessionIndex, status: workoutSession.status, startedAt: workoutSession.startedAt, endedAt: workoutSession.endedAt, globalEffort: workoutSession.globalEffort, comment: workoutSession.comment })
        .from(workoutSession)
        .where(and(eq(workoutSession.ownerId, ownerId), eq(workoutSession.planId, planId)))
        .orderBy(workoutSession.startedAt)
        .all()
        .reverse(),
    /** Latest known status per plan session index, for the weekly rail. Owner-scoped. */
    listLatestStatuses: (ownerId: string, planId: string) => {
      const rows = database
        .select({ sessionIndex: workoutSession.sessionIndex, status: workoutSession.status, startedAt: workoutSession.startedAt })
        .from(workoutSession)
        .where(and(eq(workoutSession.ownerId, ownerId), eq(workoutSession.planId, planId)))
        .orderBy(workoutSession.startedAt)
        .all();
      const byIndex: Record<number, string> = {};
      for (const row of rows) byIndex[row.sessionIndex] = row.status;
      return byIndex;
    },
    /** Variant ids actually used in this account's real history (any plan), most recently first, deduplicated — real "recientes" (Bloqueante 5), never a fixture. */
    listRecentVariantIds: (ownerId: string, limit: number): string[] => {
      const rows = database
        .select({ variantId: sessionExercise.variantId, startedAt: workoutSession.startedAt })
        .from(sessionExercise)
        .innerJoin(workoutSession, eq(sessionExercise.workoutSessionId, workoutSession.id))
        .where(eq(workoutSession.ownerId, ownerId))
        .orderBy(workoutSession.startedAt)
        .all()
        .reverse();
      const seen = new Set<string>();
      const recent: string[] = [];
      for (const row of rows) {
        if (seen.has(row.variantId)) continue;
        seen.add(row.variantId);
        recent.push(row.variantId);
        if (recent.length >= limit) break;
      }
      return recent;
    }
  };
}

function loadExposures(database: Db, ownerId: string, variantId: string): Exposure[] {
  const rows = database
    .select({ sessionStatus: workoutSession.status, startedAt: workoutSession.startedAt, sessionExerciseId: sessionExercise.id, targetSets: sessionExercise.targetSets, targetRepsMin: sessionExercise.targetRepsMin, targetRepsMax: sessionExercise.targetRepsMax })
    .from(sessionExercise)
    .innerJoin(workoutSession, eq(sessionExercise.workoutSessionId, workoutSession.id))
    .where(and(eq(workoutSession.ownerId, ownerId), eq(sessionExercise.variantId, variantId), inArray(workoutSession.status, FINISHED_STATUSES)))
    .orderBy(workoutSession.startedAt)
    .all();

  return rows.map((row) => {
    const sets = database.select().from(setPerformance).where(eq(setPerformance.sessionExerciseId, row.sessionExerciseId)).orderBy(setPerformance.setNumber).all();
    return {
      targetSets: row.targetSets,
      targetRepsMin: row.targetRepsMin,
      targetRepsMax: row.targetRepsMax,
      sessionStatus: row.sessionStatus as SessionCloseStatus,
      sets: sets.map((set) => ({ loadKg: set.loadKg, repetitions: set.repetitions, difficulty: set.difficulty as SetDifficulty | null }))
    };
  });
}
