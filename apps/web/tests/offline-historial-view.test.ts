import { describe, expect, it } from "vitest";
import {
  computeAdherenceView,
  computeWeeklyLoadView,
  computeWeekStatsView,
  getEnduranceActivityDetailView,
  getSessionDetailView,
  listEnduranceActivitiesView,
  listSessionHistoryView,
  listVariantProgressView
} from "@/features/history/domain/historial-view";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { isoWeekStart } from "@/lib/weekdays";

const PLAN_ID = "plan-1";
const OTHER_PLAN_ID = "plan-2";

const proposal = {
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Piernas", exercises: [{ variantId: "squat-back" }] },
      { day: "wednesday", kind: "strength", title: "Torso", exercises: [{ variantId: "bench-press" }] }
    ]
  }
};

function baseSnapshot(overrides: Partial<OfflineSnapshot["data"]> = {}): OfflineSnapshot {
  return {
    userId: "owner-1",
    syncedAt: Date.now(),
    data: {
      activePlan: { id: PLAN_ID, createdAt: "2026-01-01T00:00:00.000Z", contentJson: JSON.stringify(proposal) },
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

describe("listSessionHistoryView", () => {
  it("is plan-scoped and most-recent first, with title/day/kind from the proposal", () => {
    const snapshot = baseSnapshot({
      history: {
        workoutSessions: [
          { id: "s1", planId: PLAN_ID, sessionIndex: 0, status: "completed", startedAt: "2026-08-01T00:00:00.000Z", endedAt: null, globalEffort: null, comment: null, discomfortJson: null },
          { id: "s2", planId: PLAN_ID, sessionIndex: 1, status: "completed", startedAt: "2026-08-03T00:00:00.000Z", endedAt: null, globalEffort: null, comment: null, discomfortJson: null },
          { id: "other-plan", planId: OTHER_PLAN_ID, sessionIndex: 0, status: "completed", startedAt: "2026-08-05T00:00:00.000Z", endedAt: null, globalEffort: null, comment: null, discomfortJson: null }
        ],
        sessionExercises: [],
        setPerformances: []
      }
    });
    const rows = listSessionHistoryView(snapshot, PLAN_ID);
    expect(rows.map((row) => row.id)).toEqual(["s2", "s1"]);
    expect(rows[0]).toMatchObject({ title: "Torso", day: "wednesday", kind: "strength" });
  });

  it("returns empty for a planId that isn't the snapshot's active plan", () => {
    const snapshot = baseSnapshot();
    expect(listSessionHistoryView(snapshot, "unknown-plan")).toEqual([]);
  });
});

describe("computeAdherenceView", () => {
  it("counts a completed session as adherence for its planned occurrence", () => {
    const monday = new Date("2026-08-03T00:00:00.000Z"); // a Monday
    const weekIso = isoWeekStart(monday);
    const snapshot = baseSnapshot({
      history: {
        workoutSessions: [{ id: "s1", planId: PLAN_ID, sessionIndex: 0, status: "completed", startedAt: monday.toISOString(), endedAt: null, globalEffort: null, comment: null, discomfortJson: null }],
        sessionExercises: [],
        setPerformances: []
      }
    });
    const adherence = computeAdherenceView(snapshot, PLAN_ID, monday);
    expect(adherence).not.toBeNull();
    expect(adherence!.completadas).toBe(1);
    void weekIso;
  });

  it("returns null for a planId that isn't the active plan", () => {
    expect(computeAdherenceView(baseSnapshot(), "unknown-plan")).toBeNull();
  });
});

describe("listVariantProgressView", () => {
  it("is account-wide, sorted by exercise name", () => {
    const snapshot = baseSnapshot({
      performanceBaselines: [
        { ownerId: "owner-1", variantId: "bench-press", confidence: 60, summaryJson: JSON.stringify({ hasBaseline: true, lastLoadKg: 40, lastRepetitions: 8, suggestion: { type: "maintain", reason: "r" } }) },
        { ownerId: "owner-1", variantId: "squat-back", confidence: 80, summaryJson: JSON.stringify({ hasBaseline: true, lastLoadKg: 60, lastRepetitions: 10, suggestion: { type: "increase_load", reason: "r" } }) }
      ]
    });
    const rows = listVariantProgressView(snapshot);
    expect(rows).toHaveLength(2);
    // Neither id exists in the real catalog fixture-side, so exerciseName falls back to the
    // variantId itself (same fallback as history-repository.ts) — alphabetical by that string.
    expect(rows[0].variantId).toBe("bench-press");
  });
});

describe("listEnduranceActivitiesView", () => {
  it("is account-wide (no plan filter) and attaches metrics, most recent first", () => {
    const snapshot = baseSnapshot({
      enduranceActivities: [
        { id: "a1", ownerId: "owner-1", planId: null, sport: "running", name: "Carrera corta", source: "manual", startedAt: "2026-08-01T00:00:00.000Z", durationS: 1200, distanceM: 3000 },
        { id: "a2", ownerId: "owner-1", planId: OTHER_PLAN_ID, sport: "cycling", name: "Bici", source: "manual", startedAt: "2026-08-05T00:00:00.000Z", durationS: 1800, distanceM: 10000 }
      ],
      activityMetrics: [{ activityId: "a1", metricType: "avg_heart_rate", value: 140, unit: "bpm" }]
    });
    const rows = listEnduranceActivitiesView(snapshot);
    expect(rows.map((row) => row.id)).toEqual(["a2", "a1"]);
    expect(rows.find((row) => row.id === "a1")!.metrics).toEqual([{ metricType: "avg_heart_rate", value: 140, unit: "bpm" }]);
  });
});

describe("computeWeekStatsView", () => {
  it("counts endurance activities toward the week even though they belong to a different plan", () => {
    const monday = new Date("2026-08-03T00:00:00.000Z");
    const snapshot = baseSnapshot({
      history: { workoutSessions: [], sessionExercises: [], setPerformances: [] },
      enduranceActivities: [{ id: "a1", ownerId: "owner-1", planId: OTHER_PLAN_ID, sport: "running", name: "Carrera", source: "manual", startedAt: monday.toISOString(), durationS: 1800, distanceM: 5000 }]
    });
    const stats = computeWeekStatsView(snapshot, PLAN_ID, monday);
    expect(stats).not.toBeNull();
    expect(stats!.hechas).toBe(1);
    expect(stats!.minutos).toBe(30);
  });

  it("returns null for a planId that isn't the active plan", () => {
    expect(computeWeekStatsView(baseSnapshot(), "unknown-plan")).toBeNull();
  });
});

describe("getSessionDetailView", () => {
  it("returns exercises and sets for the matching session, scoped to plan+id", () => {
    const snapshot = baseSnapshot({
      history: {
        workoutSessions: [{ id: "s1", planId: PLAN_ID, sessionIndex: 0, status: "completed", startedAt: "2026-08-01T00:00:00.000Z", endedAt: null, globalEffort: 7, comment: "bien", discomfortJson: null }],
        sessionExercises: [{ id: "e1", workoutSessionId: "s1", variantId: "squat-back", position: 0, status: "active" }],
        setPerformances: [{ id: "p1", sessionExerciseId: "e1", setNumber: 1, loadKg: 60, repetitions: 10, difficulty: "just_right" }]
      }
    });
    const detail = getSessionDetailView(snapshot, PLAN_ID, "s1");
    expect(detail).not.toBeNull();
    expect(detail!.title).toBe("Piernas");
    expect(detail!.exercises).toHaveLength(1);
    expect(detail!.exercises[0].sets).toEqual([{ setNumber: 1, loadKg: 60, repetitions: 10, difficulty: "just_right" }]);
  });

  it("returns null when the session id doesn't exist", () => {
    expect(getSessionDetailView(baseSnapshot(), PLAN_ID, "missing")).toBeNull();
  });
});

describe("computeWeeklyLoadView", () => {
  it("counts one unit per finished set (piernas vs. tren superior) and resistenciaMinutos account-wide, ignoring planId", () => {
    const monday = "2026-08-03T00:00:00.000Z"; // a Monday
    const snapshot = baseSnapshot({
      history: {
        workoutSessions: [
          { id: "s1", planId: PLAN_ID, sessionIndex: 0, status: "completed", startedAt: monday, endedAt: null, globalEffort: null, comment: null, discomfortJson: null },
          { id: "s2", planId: OTHER_PLAN_ID, sessionIndex: 0, status: "in_progress", startedAt: monday, endedAt: null, globalEffort: null, comment: null, discomfortJson: null }
        ],
        sessionExercises: [
          { id: "e1", workoutSessionId: "s1", variantId: "squat-barbell", position: 0, status: "active" },
          { id: "e2", workoutSessionId: "s2", variantId: "squat-barbell", position: 0, status: "active" }
        ],
        setPerformances: [
          { id: "p1", sessionExerciseId: "e1", setNumber: 1, loadKg: 60, repetitions: 8, difficulty: "just_right" },
          { id: "p2", sessionExerciseId: "e1", setNumber: 2, loadKg: 60, repetitions: 8, difficulty: "just_right" },
          // s2's exercise belongs to an in_progress (unfinished) session: excluded, like the real query.
          { id: "p3", sessionExerciseId: "e2", setNumber: 1, loadKg: 60, repetitions: 8, difficulty: "just_right" }
        ]
      },
      enduranceActivities: [
        { id: "a1", ownerId: "owner-1", planId: OTHER_PLAN_ID, sport: "running", name: "Carrera", source: "manual", startedAt: monday, durationS: 1800, distanceM: 5000 }
      ]
    });
    const load = computeWeeklyLoadView(snapshot, isoWeekStart(new Date(monday)));
    expect(load).toEqual({ piernas: 2, treSuperior: 0, resistenciaMinutos: 30 });
  });

  it("returns all zeros for a week with no finished sets or activities", () => {
    expect(computeWeeklyLoadView(baseSnapshot(), isoWeekStart())).toEqual({ piernas: 0, treSuperior: 0, resistenciaMinutos: 0 });
  });
});

describe("getEnduranceActivityDetailView", () => {
  it("returns an activity with its metrics by id", () => {
    const snapshot = baseSnapshot({
      enduranceActivities: [{ id: "a1", ownerId: "owner-1", planId: null, sport: "running", name: "Carrera", source: "manual", startedAt: "2026-08-01T00:00:00.000Z", durationS: 1200, distanceM: 3000 }],
      activityMetrics: [{ activityId: "a1", metricType: "avg_pace_sec_per_km", value: 300, unit: "s/km" }]
    });
    const detail = getEnduranceActivityDetailView(snapshot, "a1");
    expect(detail).not.toBeNull();
    expect(detail!.metrics).toEqual([{ metricType: "avg_pace_sec_per_km", value: 300, unit: "s/km" }]);
  });

  it("returns null when the activity id doesn't exist", () => {
    expect(getEnduranceActivityDetailView(baseSnapshot(), "missing")).toBeNull();
  });
});
