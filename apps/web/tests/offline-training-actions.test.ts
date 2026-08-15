import { describe, expect, it } from "vitest";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import {
  finishWorkoutOffline,
  recordSetOffline,
  removeSetOffline,
  startWorkoutOffline,
  substituteVariantOffline
} from "@/features/workouts/domain/workout-offline";
import { decideOffline, submitCheckinOffline } from "@/features/training-engine/domain/checkin-offline";
import { finishRecoveryOffline, startRecoveryOffline } from "@/features/recovery/domain/recovery-offline";

function createId() {
  let n = 0;
  return () => String(++n);
}

function emptySnapshot(): OfflineSnapshot {
  return {
    userId: "user-1",
    syncedAt: 1,
    data: {
      history: { workoutSessions: [], sessionExercises: [{ id: "se-1", variantId: "squat-back", position: 0, status: "pending", targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }], setPerformances: [] },
      recoverySessions: [],
      checkins: []
    }
  };
}

describe("workout offline helpers", () => {
  it("starts strength locally after a network failure", () => {
    const snapshot = emptySnapshot();
    const result = startWorkoutOffline(snapshot, { planId: "plan-a", sessionIndex: 0 }, createId());
    expect(result.session).toMatchObject({ id: "local-workout-1", status: "in_progress" });
    expect(result.operation).toMatchObject({ kind: "start_workout", workoutSessionId: "local-workout-1", payload: { planId: "plan-a", sessionIndex: 0 } });
    expect((result.snapshot.data.history as { workoutSessions: unknown[] }).workoutSessions).toContainEqual(result.session);
  });

  it("records a set locally and marks it saved", () => {
    const snapshot = emptySnapshot();
    const payload = { sessionExerciseId: "se-1", setNumber: 1, loadKg: 40, repetitions: 10, difficulty: "just_right" as const };
    const result = recordSetOffline(snapshot, "local-workout-1", payload, createId());
    const exercise = (result.snapshot.data.history as { sessionExercises: Array<{ id: string; sets?: unknown[] }> }).sessionExercises.find((item) => item.id === "se-1");
    expect(exercise?.sets).toContainEqual({ setNumber: 1, loadKg: 40, repetitions: 10, difficulty: "just_right" });
    expect(result.operation).toMatchObject({ kind: "record_set", workoutSessionId: "local-workout-1", payload });
  });

  it("removes a locally recorded set", () => {
    const snapshot = emptySnapshot();
    const recorded = recordSetOffline(snapshot, "local-workout-1", { sessionExerciseId: "se-1", setNumber: 1, loadKg: 40, repetitions: 10, difficulty: null }, createId());
    const result = removeSetOffline(recorded.snapshot, "local-workout-1", { sessionExerciseId: "se-1", setNumber: 1 }, createId());
    const exercise = (result.snapshot.data.history as { sessionExercises: Array<{ id: string; sets?: unknown[] }> }).sessionExercises.find((item) => item.id === "se-1");
    expect(exercise?.sets).toEqual([]);
    expect(result.operation.kind).toBe("remove_set");
  });

  it("substitutes a variant locally and queues it for sync", () => {
    const snapshot = emptySnapshot();
    const result = substituteVariantOffline(snapshot, "local-workout-1", "se-1", "squat-front", createId());
    expect(result.exercise).toMatchObject({ id: "se-1", variantId: "squat-front" });
    expect(result.operation).toMatchObject({
      kind: "substitute_variant",
      workoutSessionId: "local-workout-1",
      payload: { sessionExerciseId: "se-1", variantId: "squat-front" }
    });
  });

  it("finishes the workout locally", () => {
    const snapshot = emptySnapshot();
    const payload = { status: "completed" as const, globalEffort: 7, comment: null, discomfort: null };
    const result = finishWorkoutOffline(snapshot, "local-workout-1", 0, payload, createId());
    const session = (result.snapshot.data.history as { workoutSessions: Array<{ id: string; status: string }> }).workoutSessions;
    expect(result.operation).toMatchObject({ kind: "finish_workout", workoutSessionId: "local-workout-1", baseVersion: 0, payload });
    expect(session).toEqual([]);
  });
});

describe("check-in offline helpers", () => {
  it("queues a check-in submission locally", () => {
    const snapshot = emptySnapshot();
    const payload = { energy: "normal" as const, motivation: "high" as const, timeAvailableMinutes: 40 as const, equipmentUnavailable: false, discomfort: null };
    const result = submitCheckinOffline(snapshot, payload, createId());
    expect((result.snapshot.data.checkins as unknown[])).toContainEqual(payload);
    expect(result.operation.kind).toBe("submit_checkin");
  });

  it("updates the local daily adjustment when a check-in decision is queued", () => {
    const snapshot = emptySnapshot();
    const decision = {
      recommendationId: "rec-1",
      decision: "apply" as const,
      changeCode: "CHG-1",
      changes: [{ code: "CHG-1", kind: "recovery" as const, description: "Convertir en recuperación", ops: [] }]
    };
    const result = decideOffline(snapshot, decision);
    expect((result.snapshot.data.today as { adjustment: { kind: string } }).adjustment.kind).toBe("recovery");
    expect(result.operation).toMatchObject({ kind: "decide_recommendation", payload: { recommendationId: "rec-1", decision: "apply", changeCode: "CHG-1" } });
  });

  it("marks the adjustment as keep_planned when the person keeps the planned session", () => {
    const snapshot = emptySnapshot();
    const result = decideOffline(snapshot, { recommendationId: "rec-1", decision: "keep", changes: [] });
    expect((result.snapshot.data.today as { adjustment: { kind: string } }).adjustment.kind).toBe("keep_planned");
  });
});

describe("recovery offline helpers", () => {
  it("starts a recovery session locally", () => {
    const snapshot = emptySnapshot();
    const result = startRecoveryOffline(snapshot, { planId: "plan-a", sessionIndex: 1 }, createId());
    expect(result.session).toMatchObject({ id: "local-recovery-1", status: "in_progress" });
    expect(result.operation).toMatchObject({ kind: "start_recovery_session", recoverySessionId: "local-recovery-1" });
    expect((result.snapshot.data.recoverySessions as unknown[])).toContainEqual(result.session);
  });

  it("finishes a recovery session locally", () => {
    const snapshot = emptySnapshot();
    const started = startRecoveryOffline(snapshot, { planId: "plan-a", sessionIndex: 1 }, createId());
    const result = finishRecoveryOffline(started.snapshot, "local-recovery-1", { comment: "listo" }, createId());
    const session = (result.snapshot.data.recoverySessions as Array<{ id: string; status: string; comment: string | null }>).find((item) => item.id === "local-recovery-1");
    expect(session).toMatchObject({ status: "completed", comment: "listo" });
    expect(result.operation.kind).toBe("finish_recovery_session");
  });
});
