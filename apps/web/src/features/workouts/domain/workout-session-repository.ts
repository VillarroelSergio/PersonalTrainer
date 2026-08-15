import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
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

type Db = PostgresJsDatabase<typeof schema>;
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
 * All writes run inside a real, async `database.transaction()` (Postgres),
 * so this factory only takes the drizzle `database` handle.
 */
export function createWorkoutSessionRepository(database: Db) {
  // /plan y /historial llaman a listSessionHistory varias veces en el mismo
  // request (vista de semana + progreso + adherencia): sin este cache por
  // instancia, cada llamada repetía la misma consulta a workout_session.
  const historyCache = new Map<string, ReturnType<typeof fetchSessionHistory>>();
  function fetchSessionHistory(ownerId: string, planId: string) {
    return database
      .select({ id: workoutSession.id, sessionIndex: workoutSession.sessionIndex, status: workoutSession.status, startedAt: workoutSession.startedAt, endedAt: workoutSession.endedAt, globalEffort: workoutSession.globalEffort, comment: workoutSession.comment })
      .from(workoutSession)
      .where(and(eq(workoutSession.ownerId, ownerId), eq(workoutSession.planId, planId)))
      .orderBy(workoutSession.startedAt)
      .then((rows) => rows.reverse());
  }

  const runStartOrResume = async (ownerId: string, planId: string, sessionIndex: number, adjustmentOps: RecommendationOp[] = []) => {
    return database.transaction(async (tx) => {
      const existing = (
        await tx
          .select()
          .from(workoutSession)
          .where(and(eq(workoutSession.ownerId, ownerId), eq(workoutSession.planId, planId), eq(workoutSession.sessionIndex, sessionIndex), eq(workoutSession.status, "in_progress")))
          .limit(1)
      ).at(0);
      if (existing) {
        const exercises = await tx.select().from(sessionExercise).where(and(eq(sessionExercise.workoutSessionId, existing.id), eq(sessionExercise.status, "active")));
        const exercisesWithSets = await Promise.all(
          exercises.map(async (exercise) => ({
            ...exercise,
            sets: await tx.select().from(setPerformance).where(eq(setPerformance.sessionExerciseId, exercise.id)).orderBy(setPerformance.setNumber)
          }))
        );
        return { workoutSession: existing, sessionExercises: exercisesWithSets };
      }

      const plan = (await tx.select().from(trainingPlan).where(and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId))).limit(1)).at(0);
      if (!plan) throw new PlanNotFoundError();

      const proposal = JSON.parse(plan.contentJson) as PlanProposal;
      const plannedSession = proposal.week?.sessions?.[sessionIndex];
      if (!plannedSession || plannedSession.kind !== "strength" || !plannedSession.exercises?.length) throw new SessionNotStrengthError();

      const id = crypto.randomUUID();
      const now = new Date();
      await tx.insert(workoutSession).values({ id, ownerId, planId, sessionIndex, status: "in_progress", startedAt: now, createdAt: now });

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
      for (const exercise of exercises) await tx.insert(sessionExercise).values(exercise);

      return { workoutSession: { id, ownerId, planId, sessionIndex, status: "in_progress" as const, version: 1, startedAt: now, endedAt: null, globalEffort: null, comment: null, discomfortJson: null, createdAt: now }, sessionExercises: exercises };
    });
  };

  const runRecordSet = async (ownerId: string, workoutSessionId: string, sessionExerciseId: string, setNumber: number, loadKg: number | null, repetitions: number | null, difficulty: SetDifficulty | null) => {
    return database.transaction(async (tx) => {
      const owned = (await tx.select().from(workoutSession).where(and(eq(workoutSession.id, workoutSessionId), eq(workoutSession.ownerId, ownerId))).limit(1)).at(0);
      if (!owned) throw new WorkoutNotFoundError();
      const exercise = (await tx.select().from(sessionExercise).where(and(eq(sessionExercise.id, sessionExerciseId), eq(sessionExercise.workoutSessionId, workoutSessionId))).limit(1)).at(0);
      if (!exercise) throw new SessionExerciseNotFoundError();

      const normalizedLoadKg = findVariant(exercise.variantId)?.trackingMode === "reps_only" ? null : loadKg;

      await tx
        .insert(setPerformance)
        .values({ id: crypto.randomUUID(), sessionExerciseId, setNumber, loadKg: normalizedLoadKg, repetitions, difficulty, completedAt: new Date() })
        .onConflictDoUpdate({ target: [setPerformance.sessionExerciseId, setPerformance.setNumber], set: { loadKg: normalizedLoadKg, repetitions, difficulty, completedAt: new Date() } });
    });
  };

  const runRemoveSet = async (ownerId: string, workoutSessionId: string, sessionExerciseId: string, setNumber: number) => {
    return database.transaction(async (tx) => {
      const owned = (await tx.select().from(workoutSession).where(and(eq(workoutSession.id, workoutSessionId), eq(workoutSession.ownerId, ownerId))).limit(1)).at(0);
      if (!owned) throw new WorkoutNotFoundError();
      const exercise = (await tx.select().from(sessionExercise).where(and(eq(sessionExercise.id, sessionExerciseId), eq(sessionExercise.workoutSessionId, workoutSessionId))).limit(1)).at(0);
      if (!exercise) throw new SessionExerciseNotFoundError();

      await tx.delete(setPerformance).where(and(eq(setPerformance.sessionExerciseId, sessionExerciseId), eq(setPerformance.setNumber, setNumber)));
    });
  };

  const runSubstituteVariant = async (ownerId: string, workoutSessionId: string, sessionExerciseId: string, newVariantId: string) => {
    return database.transaction(async (tx) => {
      const owned = (await tx.select().from(workoutSession).where(and(eq(workoutSession.id, workoutSessionId), eq(workoutSession.ownerId, ownerId))).limit(1)).at(0);
      if (!owned) throw new WorkoutNotFoundError();
      const previous = (await tx.select().from(sessionExercise).where(and(eq(sessionExercise.id, sessionExerciseId), eq(sessionExercise.workoutSessionId, workoutSessionId))).limit(1)).at(0);
      if (!previous) throw new SessionExerciseNotFoundError();
      if (!findVariant(newVariantId)) throw new SessionExerciseNotFoundError();

      await tx.update(sessionExercise).set({ status: "replaced" }).where(eq(sessionExercise.id, sessionExerciseId));
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
      await tx.insert(sessionExercise).values(replacement);
      return replacement;
    });
  };

  const runFinish = async (ownerId: string, workoutSessionId: string, clientOperationId: string, baseVersion: number, status: SessionCloseStatus, globalEffort: number | null, comment: string | null, discomfortJson: string | null) => {
    return database.transaction(async (tx) => {
      const owned = (await tx.select().from(workoutSession).where(and(eq(workoutSession.id, workoutSessionId), eq(workoutSession.ownerId, ownerId))).limit(1)).at(0);
      if (!owned) throw new WorkoutNotFoundError();
      // Replaying the exact same offline operation (outbox retry after the first attempt already succeeded) is a no-op success, never a conflict.
      if (owned.lastFinishOperationId === clientOperationId) return;
      if (owned.version !== baseVersion) throw new VersionConflictError(owned.version);

      await tx.update(workoutSession).set({ status, version: owned.version + 1, lastFinishOperationId: clientOperationId, endedAt: new Date(), globalEffort, comment, discomfortJson }).where(eq(workoutSession.id, workoutSessionId));

      const exercises = await tx.select().from(sessionExercise).where(eq(sessionExercise.workoutSessionId, workoutSessionId));
      const variantIds = [...new Set(exercises.map((exercise) => exercise.variantId))];
      for (const variantId of variantIds) {
        const exposures = await loadExposures(tx, ownerId, variantId);
        const baseline = computeBaseline(exposures);
        await tx
          .insert(performanceBaseline)
          .values({ ownerId, variantId, confidence: Math.round(baseline.confidence * 100), summaryJson: JSON.stringify(baseline), ruleVersion: baseline.ruleVersion, calculatedAt: new Date() })
          .onConflictDoUpdate({ target: [performanceBaseline.ownerId, performanceBaseline.variantId], set: { confidence: Math.round(baseline.confidence * 100), summaryJson: JSON.stringify(baseline), ruleVersion: baseline.ruleVersion, calculatedAt: new Date() } });
      }
    });
  };

  return {
    startOrResumeWorkout: (ownerId: string, planId: string, sessionIndex: number, adjustmentOps: RecommendationOp[] = []) => runStartOrResume(ownerId, planId, sessionIndex, adjustmentOps),
    recordSet: (ownerId: string, workoutSessionId: string, sessionExerciseId: string, setNumber: number, loadKg: number | null, repetitions: number | null, difficulty: SetDifficulty | null) =>
      runRecordSet(ownerId, workoutSessionId, sessionExerciseId, setNumber, loadKg, repetitions, difficulty),
    removeSet: (ownerId: string, workoutSessionId: string, sessionExerciseId: string, setNumber: number) =>
      runRemoveSet(ownerId, workoutSessionId, sessionExerciseId, setNumber),
    substituteVariant: (ownerId: string, workoutSessionId: string, sessionExerciseId: string, newVariantId: string) => runSubstituteVariant(ownerId, workoutSessionId, sessionExerciseId, newVariantId),
    finishWorkout: (ownerId: string, workoutSessionId: string, clientOperationId: string, baseVersion: number, status: SessionCloseStatus, globalEffort: number | null, comment: string | null, discomfortJson: string | null) =>
      runFinish(ownerId, workoutSessionId, clientOperationId, baseVersion, status, globalEffort, comment, discomfortJson),
    getBaseline: async (ownerId: string, variantId: string) => (await database.select().from(performanceBaseline).where(and(eq(performanceBaseline.ownerId, ownerId), eq(performanceBaseline.variantId, variantId))).limit(1)).at(0),
    /** Every finished (or in-progress) session for this plan, most recent first — the real chronological source for Historial (Fase 3), never a fixture. Owner-scoped. */
    listSessionHistory: (ownerId: string, planId: string) => {
      const key = `${ownerId}:${planId}`;
      let cached = historyCache.get(key);
      if (!cached) {
        cached = fetchSessionHistory(ownerId, planId);
        historyCache.set(key, cached);
      }
      return cached;
    },
    /** Latest known status per plan session index, for the weekly rail. Owner-scoped. */
    listLatestStatuses: async (ownerId: string, planId: string) => {
      const rows = await database
        .select({ sessionIndex: workoutSession.sessionIndex, status: workoutSession.status, startedAt: workoutSession.startedAt })
        .from(workoutSession)
        .where(and(eq(workoutSession.ownerId, ownerId), eq(workoutSession.planId, planId)))
        .orderBy(workoutSession.startedAt);
      const byIndex: Record<number, string> = {};
      for (const row of rows) byIndex[row.sessionIndex] = row.status;
      return byIndex;
    },
    /** Variant ids actually used in this account's real history (any plan), most recently first, deduplicated — real "recientes" (Bloqueante 5), never a fixture. */
    listRecentVariantIds: async (ownerId: string, limit: number): Promise<string[]> => {
      const rows = (
        await database
          .select({ variantId: sessionExercise.variantId, startedAt: workoutSession.startedAt })
          .from(sessionExercise)
          .innerJoin(workoutSession, eq(sessionExercise.workoutSessionId, workoutSession.id))
          .where(eq(workoutSession.ownerId, ownerId))
          .orderBy(workoutSession.startedAt)
      ).reverse();
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

async function loadExposures(database: Pick<Db, "select">, ownerId: string, variantId: string): Promise<Exposure[]> {
  const rows = await database
    .select({ sessionStatus: workoutSession.status, startedAt: workoutSession.startedAt, sessionExerciseId: sessionExercise.id, targetSets: sessionExercise.targetSets, targetRepsMin: sessionExercise.targetRepsMin, targetRepsMax: sessionExercise.targetRepsMax })
    .from(sessionExercise)
    .innerJoin(workoutSession, eq(sessionExercise.workoutSessionId, workoutSession.id))
    .where(and(eq(workoutSession.ownerId, ownerId), eq(sessionExercise.variantId, variantId), inArray(workoutSession.status, FINISHED_STATUSES)))
    .orderBy(workoutSession.startedAt);

  const setRows = rows.length === 0 ? [] : await database
    .select()
    .from(setPerformance)
    .where(inArray(setPerformance.sessionExerciseId, rows.map((row) => row.sessionExerciseId)))
    .orderBy(setPerformance.setNumber);
  const setsByExercise = new Map<string, typeof setRows>();
  for (const set of setRows) setsByExercise.set(set.sessionExerciseId, [...(setsByExercise.get(set.sessionExerciseId) ?? []), set]);
  return rows.map((row) => ({
    targetSets: row.targetSets,
    targetRepsMin: row.targetRepsMin,
    targetRepsMax: row.targetRepsMax,
    sessionStatus: row.sessionStatus as SessionCloseStatus,
    sets: (setsByExercise.get(row.sessionExerciseId) ?? []).map((set) => ({ loadKg: set.loadKg, repetitions: set.repetitions, difficulty: set.difficulty as SetDifficulty | null }))
  }));
}
