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
    const result = startWorkoutOffline(snapshot, { planId: "plan-a", sessionIndex: 0 }, [], createId());
    expect(result.session).toMatchObject({ id: "local-workout-1", planId: "plan-a", sessionIndex: 0, status: "in_progress" });
    expect(result.operation).toMatchObject({ kind: "start_workout", workoutSessionId: "local-workout-1", payload: { planId: "plan-a", sessionIndex: 0 } });
    expect((result.snapshot.data.history as { workoutSessions: unknown[] }).workoutSessions).toContainEqual(result.session);
  });

  it("resumes an already in-progress session instead of starting a duplicate", () => {
    // The exact bug reproduced offline in production: reopening /entrenar after leaving the
    // screen used to call startWorkoutOffline again, creating a second local session and
    // orphaning the one whose sets were just confirmed.
    const started = startWorkoutOffline(emptySnapshot(), { planId: "plan-a", sessionIndex: 0 }, [{ variantId: "squat-back", targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }], createId());
    const recorded = recordSetOffline(started.snapshot, started.session.id, { sessionExerciseId: started.exercises[0].id, setNumber: 1, loadKg: 40, repetitions: 10, difficulty: "just_right" }, createId());

    const resumed = startWorkoutOffline(recorded.snapshot, { planId: "plan-a", sessionIndex: 0 }, [{ variantId: "squat-back", targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }], createId());

    expect(resumed.operation).toBeNull();
    expect(resumed.session).toEqual(started.session);
    expect((resumed.snapshot.data.history as { workoutSessions: unknown[] }).workoutSessions).toHaveLength(1);
    expect(resumed.exercises).toHaveLength(1);
    expect(resumed.exercises[0].sets).toContainEqual({ setNumber: 1, loadKg: 40, repetitions: 10, difficulty: "just_right" });
  });

  it("records a set locally, keyed like the server's setPerformance rows", () => {
    const snapshot = emptySnapshot();
    const payload = { sessionExerciseId: "se-1", setNumber: 1, loadKg: 40, repetitions: 10, difficulty: "just_right" as const };
    const result = recordSetOffline(snapshot, "local-workout-1", payload, createId());
    const setPerformances = (result.snapshot.data.history as { setPerformances: Array<{ sessionExerciseId: string; setNumber: number; loadKg: number | null; repetitions: number | null; difficulty: string | null }> }).setPerformances;
    expect(setPerformances).toContainEqual(expect.objectContaining({ sessionExerciseId: "se-1", setNumber: 1, loadKg: 40, repetitions: 10, difficulty: "just_right" }));
    expect(result.operation).toMatchObject({ kind: "record_set", workoutSessionId: "local-workout-1", payload });
  });

  it("removes a locally recorded set", () => {
    const snapshot = emptySnapshot();
    const recorded = recordSetOffline(snapshot, "local-workout-1", { sessionExerciseId: "se-1", setNumber: 1, loadKg: 40, repetitions: 10, difficulty: null }, createId());
    const result = removeSetOffline(recorded.snapshot, "local-workout-1", { sessionExerciseId: "se-1", setNumber: 1 }, createId());
    const setPerformances = (result.snapshot.data.history as { setPerformances: unknown[] }).setPerformances;
    expect(setPerformances).toEqual([]);
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

  it("writes a plan-edit row when a check-in decision applies a change with ops", () => {
    const snapshot = emptySnapshot();
    const decision = {
      recommendationId: "rec-1",
      decision: "apply" as const,
      changeCode: "CHG-1",
      changes: [{ code: "CHG-1", kind: "recovery" as const, description: "Convertir en recuperación", ops: [{ op: "convert_recovery" as const }] }],
      planId: "plan-a",
      isoWeekStart: "2026-08-10",
      originDay: "monday",
      sessionIndex: 0
    };
    const result = decideOffline(snapshot, decision);
    const planEdits = result.snapshot.data.planEdits as Array<{ planId: string; sessionIndex: number; kind: string; targetDay: string | null }>;
    expect(planEdits).toContainEqual(expect.objectContaining({ planId: "plan-a", sessionIndex: 0, kind: "recovery", targetDay: null }));
    expect(result.operation).toMatchObject({ kind: "decide_recommendation", payload: { recommendationId: "rec-1", decision: "apply", changeCode: "CHG-1" } });
  });

  it("captures the reschedule target day when the applied change reschedules the session", () => {
    const snapshot = emptySnapshot();
    const decision = {
      recommendationId: "rec-1",
      decision: "apply" as const,
      changeCode: "CHG-2",
      changes: [{ code: "CHG-2", kind: "reschedule" as const, description: "Mover a otro día", ops: [{ op: "reschedule" as const, targetDay: "wednesday" as const }] }],
      planId: "plan-a",
      isoWeekStart: "2026-08-10",
      originDay: "monday",
      sessionIndex: 0
    };
    const result = decideOffline(snapshot, decision);
    const planEdits = result.snapshot.data.planEdits as Array<{ sessionIndex: number; kind: string; targetDay: string | null }>;
    expect(planEdits).toContainEqual(expect.objectContaining({ sessionIndex: 0, kind: "reschedule", targetDay: "wednesday" }));
  });

  it("does not write a plan-edit row when the applied change has no ops", () => {
    const snapshot = emptySnapshot();
    const decision = {
      recommendationId: "rec-1",
      decision: "apply" as const,
      changeCode: "CHG-1",
      changes: [{ code: "CHG-1", kind: "keep_planned" as const, description: "Sin cambios", ops: [] }],
      planId: "plan-a",
      isoWeekStart: "2026-08-10",
      originDay: "monday",
      sessionIndex: 0
    };
    const result = decideOffline(snapshot, decision);
    expect(result.snapshot.data.planEdits).toBeUndefined();
  });

  it("does not write a plan-edit row when the person keeps the planned session", () => {
    const snapshot = emptySnapshot();
    const result = decideOffline(snapshot, { recommendationId: "rec-1", decision: "keep", changes: [], planId: "plan-a", isoWeekStart: "2026-08-10", originDay: "monday", sessionIndex: 0 });
    expect(result.snapshot.data.planEdits).toBeUndefined();
    expect(result.operation).toMatchObject({ kind: "decide_recommendation", payload: { recommendationId: "rec-1", decision: "keep" } });
  });
});

describe("recovery offline helpers", () => {
  it("starts a recovery session locally", () => {
    const snapshot = emptySnapshot();
    const result = startRecoveryOffline(snapshot, { planId: "plan-a", sessionIndex: 1 }, createId());
    expect(result.session).toMatchObject({ id: "local-recovery-1", planId: "plan-a", sessionIndex: 1, status: "in_progress" });
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
