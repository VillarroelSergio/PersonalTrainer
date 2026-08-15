import { describe, expect, it } from "vitest";
import { computePlanView } from "@/features/planning/domain/plan-view";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { isoDate, isoWeekStart, parseIsoDateLocal } from "@/lib/weekdays";

const PLAN_ID = "plan-1";

const proposal = {
  initialBlock: { name: "Bloque 1", purpose: "Adaptación", weeks: 4 },
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Piernas", estimatedMinutes: 45, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] },
      { day: "wednesday", kind: "strength", title: "Torso", estimatedMinutes: 40, exercises: [{ variantId: "push-h-bench", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] }
    ]
  }
};

function baseSnapshot(overrides: Partial<OfflineSnapshot["data"]> = {}): OfflineSnapshot {
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - 10);
  return {
    userId: "owner-1",
    syncedAt: Date.now(),
    data: {
      activePlan: { id: PLAN_ID, name: "Mi plan", status: "active", createdAt: createdAt.toISOString(), contentJson: JSON.stringify(proposal) },
      plans: [{ id: PLAN_ID, name: "Mi plan", status: "active", contentJson: JSON.stringify(proposal) }],
      planEdits: [],
      recoverySessions: [],
      history: { workoutSessions: [], sessionExercises: [], setPerformances: [] },
      enduranceActivities: [],
      activityMetrics: [],
      performanceBaselines: [],
      ...overrides
    }
  };
}

describe("computePlanView", () => {
  it("defaults to the 'semana' tab and the current week when no query params are given", () => {
    const view = computePlanView(baseSnapshot(), null, null);
    expect(view.vista).toBe("semana");
    expect(view.offset).toBe(0);
    expect(view.weekStart).toBe(isoWeekStart());
    expect(view.weekSessionCount).toBe(2);
    expect(view.weekPlannedMinutes).toBe(85);
  });

  it("falls back to 'semana' for an unknown vista and clamps a negative week offset to 0", () => {
    const view = computePlanView(baseSnapshot(), "-3", "unknown");
    expect(view.vista).toBe("semana");
    expect(view.offset).toBe(0);
  });

  it("navigates forward by the given week offset", () => {
    const view = computePlanView(baseSnapshot(), "2", "semana");
    expect(view.offset).toBe(2);
    const expected = isoDate(new Date(parseIsoDateLocal(isoWeekStart()).getTime() + 14 * 24 * 60 * 60 * 1000));
    expect(view.weekStart).toBe(expected);
  });

  it("carries every owned plan (not just the active one) into the 'planes' tab data", () => {
    const snapshot = baseSnapshot({ plans: [{ id: PLAN_ID, name: "Mi plan", status: "active", contentJson: JSON.stringify(proposal) }, { id: "plan-2", name: "Plan archivado", status: "archived", contentJson: "{}" }] });
    const view = computePlanView(snapshot, null, "planes");
    expect(view.plans.map((plan) => plan.id)).toEqual([PLAN_ID, "plan-2"]);
  });

  it("computes weeklyLoad for the real current week, independent of the navigated week offset", () => {
    const monday = isoWeekStart();
    const snapshot = baseSnapshot({
      history: {
        workoutSessions: [{ id: "s1", planId: PLAN_ID, sessionIndex: 0, status: "completed", startedAt: `${monday}T00:00:00.000Z`, endedAt: null, globalEffort: null, comment: null, discomfortJson: null }],
        sessionExercises: [{ id: "e1", workoutSessionId: "s1", variantId: "squat-barbell", position: 0, status: "active" }],
        setPerformances: [{ id: "p1", sessionExerciseId: "e1", setNumber: 1, loadKg: 60, repetitions: 8, difficulty: "just_right" }]
      }
    });
    // Navigate two weeks into the future: weeklyLoad must still reflect *this* week's set, not the navigated one.
    const view = computePlanView(snapshot, "2", "semana");
    expect(view.progress.weeklyLoad).toEqual({ piernas: 1, treSuperior: 0, resistenciaMinutos: 0 });
  });

  it("computes block progress from the plan's real createdAt", () => {
    const view = computePlanView(baseSnapshot(), null, null);
    expect(view.blockProgress.totalWeeks).toBe(4);
    expect(view.blockProgress.currentWeek).toBeGreaterThanOrEqual(1);
  });
});
