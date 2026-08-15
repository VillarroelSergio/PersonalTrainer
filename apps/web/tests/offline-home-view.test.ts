import { describe, expect, it } from "vitest";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { computeHoyView } from "@/features/home/domain/hoy-view";
import { isoWeekStart, todayWeekday } from "@/lib/weekdays";

const WEEK_START = isoWeekStart();
const TODAY = todayWeekday();

function plan(sessions: Array<{ day: string; kind: "strength" | "endurance"; title: string; estimatedMinutes: number; exercises?: unknown[] }>) {
  return {
    id: "plan-a",
    name: "Plan de fuerza",
    contentJson: JSON.stringify({ week: { sessions } })
  };
}

function baseSnapshot(overrides: Partial<OfflineSnapshot["data"]> = {}): OfflineSnapshot {
  return {
    userId: "user-1",
    syncedAt: 1,
    data: {
      activePlan: plan([{ day: TODAY, kind: "strength", title: "Sesión de hoy", estimatedMinutes: 45, exercises: [{ variantId: "squat-back", targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }] }]),
      planEdits: [],
      history: { workoutSessions: [], sessionExercises: [], setPerformances: [] },
      recoverySessions: [],
      ...overrides
    }
  };
}

describe("computeHoyView", () => {
  it("resolves today's session from the plan template", () => {
    const view = computeHoyView(baseSnapshot());
    expect(view.todaySession).toMatchObject({ title: "Sesión de hoy" });
    expect(view.todayIndex).toBe(0);
    expect(view.todayAdjustment).toBeUndefined();
  });

  it("shows the moved/'movida' state when a reschedule adjustment exists for today's occurrence", () => {
    const snapshot = baseSnapshot({
      planEdits: [
        { id: "adj-1", ownerId: "user-1", planId: "plan-a", isoWeekStart: WEEK_START, sessionIndex: 0, originDay: TODAY, kind: "reschedule", targetDay: "sunday", opsJson: "[]", recommendationId: null, createdAt: "2026-01-01" }
      ]
    });
    const view = computeHoyView(snapshot);
    // Rescheduled away from today: today's occurrence for session 0 is no longer visible as an actionable "today" slot.
    expect(view.todayIndex).toBe(-1);
    expect(view.todaySession).toBeNull();
  });

  it("surfaces recoveryStatus when a recovery adjustment applies to today's occurrence", () => {
    const snapshot = baseSnapshot({
      planEdits: [
        { id: "adj-1", ownerId: "user-1", planId: "plan-a", isoWeekStart: WEEK_START, sessionIndex: 0, originDay: TODAY, kind: "recovery", targetDay: null, opsJson: "[]", recommendationId: null, createdAt: "2026-01-01" }
      ],
      recoverySessions: [
        { id: "rec-1", ownerId: "user-1", planId: "plan-a", sessionIndex: 0, status: "in_progress", startedAt: "2026-01-01T10:00:00.000Z", endedAt: null, comment: null, createdAt: "2026-01-01T10:00:00.000Z" }
      ]
    });
    const view = computeHoyView(snapshot);
    expect(view.todayAdjustment).toMatchObject({ kind: "recovery" });
    expect(view.recoveryStatus).toBe("in_progress");
  });

  it("fires the weekly load warning when a long endurance session sits next to a legs-heavy strength session", () => {
    const sessions = [
      { day: "monday", kind: "strength" as const, title: "Piernas", estimatedMinutes: 45, exercises: [{ variantId: "squat-barbell", targetSets: 4, targetRepsMin: 6, targetRepsMax: 10 }] },
      { day: "tuesday", kind: "endurance" as const, title: "Carrera larga", estimatedMinutes: 90 }
    ];
    const snapshot = baseSnapshot({ activePlan: plan(sessions) });
    const view = computeHoyView(snapshot);
    expect(view.warn).not.toBeNull();
  });

  it("ignores a workout session from a different (e.g. previous) plan when computing this week's statuses", () => {
    const now = new Date().toISOString();
    const snapshot = baseSnapshot({
      history: {
        workoutSessions: [{ planId: "plan-old", sessionIndex: 0, status: "completed", startedAt: now }],
        sessionExercises: [],
        setPerformances: []
      }
    });
    const view = computeHoyView(snapshot);
    // Session index 0 was only completed under the old plan, not the active one ("plan-a"):
    // it must not be misattributed as this week's status for the active plan's session 0.
    expect(view.statuses[0]).toBeUndefined();
    expect(view.weekSummary.completed).toBe(0);
  });
});
