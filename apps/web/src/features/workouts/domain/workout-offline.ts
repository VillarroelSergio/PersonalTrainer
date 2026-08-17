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
type SessionExercise = { id: string; workoutSessionId: string; variantId: string; position: number; status: string; targetSets: number; targetRepsMin: number; targetRepsMax: number };
type SetPerformance = { id: string; sessionExerciseId: string; setNumber: number; loadKg: number | null; repetitions: number | null; difficulty: Difficulty | null };
type WorkoutSession = { id: string; planId: string; sessionIndex: number; status: string; version: number };

/** The shape WorkoutRunner renders: each exercise with its already-recorded sets nested,
 * mirroring what the online start/resume endpoint returns (workout-session-repository.ts). */
export type ResumedSessionExercise = SessionExercise & { sets: PersistedSet[] };
export type PreviewExerciseInput = { variantId: string; targetSets: number; targetRepsMin: number; targetRepsMax: number };

type WorkoutHistory = { workoutSessions: WorkoutSession[]; sessionExercises: SessionExercise[]; setPerformances: SetPerformance[] };

function historyOf(snapshot: OfflineSnapshot): WorkoutHistory {
  const history = snapshot.data.history as Partial<WorkoutHistory> | undefined;
  return { workoutSessions: history?.workoutSessions ?? [], sessionExercises: history?.sessionExercises ?? [], setPerformances: history?.setPerformances ?? [] };
}

/** setPerformances is the single source of truth for recorded sets — the same flat,
 * sessionExerciseId-keyed shape the server ships (offline-snapshot handler) and the one
 * /historial already reads (historial-view.ts). Nesting sets on the exercise itself was a
 * WorkoutRunner-only convention that /historial never saw and that a resumed exercise could
 * never rebuild from, since the account-wide snapshot never carried nested sets to resume from. */
function exercisesWithSets(history: WorkoutHistory, workoutSessionId: string): ResumedSessionExercise[] {
  return history.sessionExercises
    .filter((exercise) => exercise.workoutSessionId === workoutSessionId && exercise.status === "active")
    .sort((a, b) => a.position - b.position)
    .map((exercise) => ({
      ...exercise,
      sets: history.setPerformances
        .filter((set) => set.sessionExerciseId === exercise.id)
        .map(({ setNumber, loadKg, repetitions, difficulty }) => ({ setNumber, loadKg, repetitions, difficulty }))
        .sort((a, b) => a.setNumber - b.setNumber)
    }));
}

/**
 * Starts a strength session locally, or resumes one already in progress. Mirrors the online
 * repository's dedup (`runStartOrResume` in workout-session-repository.ts): without it,
 * reopening /entrenar offline after a network drop started a brand-new session every time,
 * orphaning the one whose sets the person had just confirmed — they were queued for sync
 * (never lost) but nothing on screen could show them again until the outbox reached the server.
 *
 * `operation` is null on a resume: nothing new needs to reach the server, and the session
 * already went through `start_workout` (or was never offline-only to begin with).
 */
export function startWorkoutOffline(
  snapshot: OfflineSnapshot,
  payload: StartWorkoutPayload,
  previewExercises: PreviewExerciseInput[] = [],
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation | null; session: WorkoutSession; exercises: ResumedSessionExercise[] } {
  const history = historyOf(snapshot);
  const existing = history.workoutSessions.find(
    (session) => session.planId === payload.planId && session.sessionIndex === payload.sessionIndex && session.status === "in_progress"
  );
  if (existing) return { snapshot, operation: null, session: existing, exercises: exercisesWithSets(history, existing.id) };

  const sessionId = `local-workout-${createId()}`;
  const session: WorkoutSession = { id: sessionId, planId: payload.planId, sessionIndex: payload.sessionIndex, status: "in_progress", version: 0 };
  const exercises: SessionExercise[] = previewExercises.map((exercise, position) => ({
    id: `local-exercise-${sessionId}-${position + 1}`,
    workoutSessionId: sessionId,
    variantId: exercise.variantId,
    position,
    status: "active",
    targetSets: exercise.targetSets,
    targetRepsMin: exercise.targetRepsMin,
    targetRepsMax: exercise.targetRepsMax
  }));
  const nextSnapshot = applyLocalMutation(snapshot, {
    history: { ...history, workoutSessions: [...history.workoutSessions, session], sessionExercises: [...history.sessionExercises, ...exercises] }
  });
  const operation: OutboxOperation = { id: createId(), kind: "start_workout", workoutSessionId: sessionId, payload, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation, session, exercises: exercises.map((exercise) => ({ ...exercise, sets: [] })) };
}

/** Records (or updates) one set locally, keyed by (sessionExerciseId, setNumber) like the
 * server's setPerformance table — not nested on the exercise, so a resumed session and
 * /historial's progression view both see it the same way. */
export function recordSetOffline(
  snapshot: OfflineSnapshot,
  workoutSessionId: string,
  payload: RecordSetPayload,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const history = historyOf(snapshot);
  const withoutSet = history.setPerformances.filter((set) => !(set.sessionExerciseId === payload.sessionExerciseId && set.setNumber === payload.setNumber));
  const nextSet: SetPerformance = { id: createId(), sessionExerciseId: payload.sessionExerciseId, setNumber: payload.setNumber, loadKg: payload.loadKg, repetitions: payload.repetitions, difficulty: payload.difficulty };
  const nextSnapshot = applyLocalMutation(snapshot, { history: { ...history, setPerformances: [...withoutSet, nextSet] } });
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
  const setPerformances = history.setPerformances.filter((set) => !(set.sessionExerciseId === payload.sessionExerciseId && set.setNumber === payload.setNumber));
  const nextSnapshot = applyLocalMutation(snapshot, { history: { ...history, setPerformances } });
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
