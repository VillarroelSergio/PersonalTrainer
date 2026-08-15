/**
 * Pure local-first helpers for WorkoutRunner (Fase 5, Task 5). No React, no fetch:
 * given the current OfflineSnapshot and an action payload, each function returns
 * the new snapshot (with the local patch already applied) and the OutboxOperation
 * to enqueue. The UI component owns deciding *when* to call these (on a failed
 * network request) and applying the result via useOfflineData()/useOfflineSyncContext().
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { applyLocalMutation } from "@/lib/offline/snapshot-client";
import { createClientId } from "@/lib/client-id";
import type {
  Difficulty,
  FinishWorkoutPayload,
  OutboxOperation,
  RecordSetPayload,
  RemoveSetPayload,
  StartWorkoutPayload
} from "@/lib/offline/outbox";

export type CreateId = () => string;

type PersistedSet = { setNumber: number; loadKg: number | null; repetitions: number | null; difficulty: Difficulty | null };
type SessionExercise = { id: string; variantId: string; position: number; status: string; targetSets: number; targetRepsMin: number; targetRepsMax: number; sets?: PersistedSet[] };
type WorkoutSession = { id: string; status: string; version: number };

type WorkoutHistory = { workoutSessions: WorkoutSession[]; sessionExercises: SessionExercise[]; setPerformances: unknown[] };

function historyOf(snapshot: OfflineSnapshot): WorkoutHistory {
  const history = snapshot.data.history as Partial<WorkoutHistory> | undefined;
  return { workoutSessions: history?.workoutSessions ?? [], sessionExercises: history?.sessionExercises ?? [], setPerformances: history?.setPerformances ?? [] };
}

/** Starts a strength session locally: creates a "local-workout-N" session id so later
 * reconciliation with the server-assigned id (once `start_workout` flushes) is unambiguous. */
export function startWorkoutOffline(
  snapshot: OfflineSnapshot,
  payload: StartWorkoutPayload,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation; session: WorkoutSession } {
  const sessionId = `local-workout-${createId()}`;
  const session: WorkoutSession = { id: sessionId, status: "in_progress", version: 0 };
  const history = historyOf(snapshot);
  const nextSnapshot = applyLocalMutation(snapshot, { history: { ...history, workoutSessions: [...history.workoutSessions, session] } });
  const operation: OutboxOperation = { id: createId(), kind: "start_workout", workoutSessionId: sessionId, payload, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation, session };
}

/** Records (or updates) one set locally, marking it saved so the UI reflects the confirm immediately. */
export function recordSetOffline(
  snapshot: OfflineSnapshot,
  workoutSessionId: string,
  payload: RecordSetPayload,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const history = historyOf(snapshot);
  const sessionExercises = history.sessionExercises.map((exercise) => {
    if (exercise.id !== payload.sessionExerciseId) return exercise;
    const sets = exercise.sets ?? [];
    const withoutSet = sets.filter((set) => set.setNumber !== payload.setNumber);
    const nextSet: PersistedSet = { setNumber: payload.setNumber, loadKg: payload.loadKg, repetitions: payload.repetitions, difficulty: payload.difficulty };
    return { ...exercise, sets: [...withoutSet, nextSet].sort((a, b) => a.setNumber - b.setNumber) };
  });
  const nextSnapshot = applyLocalMutation(snapshot, { history: { ...history, sessionExercises } });
  const operation: OutboxOperation = { id: createId(), kind: "record_set", workoutSessionId, payload, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation };
}

/** Removes (unconfirms) a locally recorded set. */
export function removeSetOffline(
  snapshot: OfflineSnapshot,
  workoutSessionId: string,
  payload: RemoveSetPayload,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const history = historyOf(snapshot);
  const sessionExercises = history.sessionExercises.map((exercise) => {
    if (exercise.id !== payload.sessionExerciseId) return exercise;
    return { ...exercise, sets: (exercise.sets ?? []).filter((set) => set.setNumber !== payload.setNumber) };
  });
  const nextSnapshot = applyLocalMutation(snapshot, { history: { ...history, sessionExercises } });
  const operation: OutboxOperation = { id: createId(), kind: "remove_set", workoutSessionId, payload, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation };
}

/** Substitutes a session exercise's variant locally (offline "Cambiar variante"). Mirrors the
 * online PATCH .../workouts/:id/exercises/:sessionExerciseId call via a queued outbox operation
 * so the change reaches the server on the next flush instead of being lost on snapshot refresh. */
export function substituteVariantOffline(
  snapshot: OfflineSnapshot,
  workoutSessionId: string,
  sessionExerciseId: string,
  variantId: string,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; exercise: SessionExercise | null; operation: OutboxOperation } {
  const history = historyOf(snapshot);
  let updated: SessionExercise | null = null;
  const sessionExercises = history.sessionExercises.map((exercise) => {
    if (exercise.id !== sessionExerciseId) return exercise;
    updated = { ...exercise, variantId };
    return updated;
  });
  const nextSnapshot = applyLocalMutation(snapshot, { history: { ...history, sessionExercises } });
  const operation: OutboxOperation = {
    id: createId(),
    kind: "substitute_variant",
    workoutSessionId,
    payload: { sessionExerciseId, variantId },
    createdAt: Date.now(),
    status: "pending"
  };
  return { snapshot: nextSnapshot, exercise: updated, operation };
}

/** Finishes (closes) the session locally. `baseVersion` mirrors the online path so a
 * later server-side version conflict on flush is detected the same way it already is today. */
export function finishWorkoutOffline(
  snapshot: OfflineSnapshot,
  workoutSessionId: string,
  baseVersion: number,
  payload: FinishWorkoutPayload,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const history = historyOf(snapshot);
  const workoutSessions = history.workoutSessions.map((session) => (session.id === workoutSessionId ? { ...session, status: payload.status } : session));
  const nextSnapshot = applyLocalMutation(snapshot, { history: { ...history, workoutSessions } });
  const operation: OutboxOperation = { id: createId(), kind: "finish_workout", workoutSessionId, baseVersion, payload, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation };
}
