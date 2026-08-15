import { describe, expect, it } from "vitest";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { computeEntrenarView } from "@/features/workouts/domain/entrenar-view";

function plan(sessions: unknown[]) {
  return { id: "plan-a", name: "Plan de fuerza", contentJson: JSON.stringify({ week: { sessions } }) };
}

function baseSnapshot(overrides: Partial<OfflineSnapshot["data"]> = {}): OfflineSnapshot {
  return {
    userId: "user-1",
    syncedAt: 1,
    data: {
      activePlan: plan([
        { day: "monday", kind: "strength", title: "Piernas", estimatedMinutes: 45, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }] },
        { day: "tuesday", kind: "endurance", title: "Carrera", estimatedMinutes: 30 }
      ]),
      favorites: [],
      history: { workoutSessions: [], sessionExercises: [], setPerformances: [] },
      ...overrides
    }
  };
}

describe("computeEntrenarView", () => {
  it("resolves a valid strength session", () => {
    const view = computeEntrenarView(baseSnapshot(), 0);
    if (view.redirect) throw new Error("expected no redirect");
    expect(view.plannedSession).toMatchObject({ title: "Piernas" });
    expect(view.favoriteVariantIds).toEqual([]);
    expect(view.recentVariantIds).toEqual([]);
    expect(view.isResuming).toBe(false);
  });

  it("signals a redirect to /hoy when the session index is not a strength session", () => {
    const view = computeEntrenarView(baseSnapshot(), 1);
    expect(view.redirect).toBe("/hoy");
  });

  it("signals a redirect to /hoy when the session index does not exist", () => {
    const view = computeEntrenarView(baseSnapshot(), 5);
    expect(view.redirect).toBe("/hoy");
  });

  it("maps favorites from the raw favoriteVariant rows to variant ids", () => {
    const view = computeEntrenarView(baseSnapshot({ favorites: [{ ownerId: "user-1", variantId: "squat-barbell", createdAt: "2026-01-01" }] }), 0);
    if (view.redirect) throw new Error("expected no redirect");
    expect(view.favoriteVariantIds).toEqual(["squat-barbell"]);
  });

  it("marks isResuming true when the latest status for this session index is in_progress", () => {
    const snapshot = baseSnapshot({
      history: {
        workoutSessions: [{ id: "w1", planId: "plan-a", sessionIndex: 0, status: "in_progress", startedAt: "2026-01-01T00:00:00.000Z" }],
        sessionExercises: [],
        setPerformances: []
      }
    });
    const view = computeEntrenarView(snapshot, 0);
    if (view.redirect) throw new Error("expected no redirect");
    expect(view.isResuming).toBe(true);
  });

  it("returns recent variant ids most-recently-used first, deduplicated", () => {
    const snapshot = baseSnapshot({
      history: {
        workoutSessions: [
          { id: "w1", planId: "plan-a", sessionIndex: 0, status: "completed", startedAt: "2026-01-01T00:00:00.000Z" },
          { id: "w2", planId: "plan-a", sessionIndex: 0, status: "completed", startedAt: "2026-01-05T00:00:00.000Z" }
        ],
        sessionExercises: [
          { id: "se1", workoutSessionId: "w1", variantId: "squat-barbell" },
          { id: "se2", workoutSessionId: "w2", variantId: "squat-dumbbell" }
        ],
        setPerformances: []
      }
    });
    const view = computeEntrenarView(snapshot, 0);
    if (view.redirect) throw new Error("expected no redirect");
    expect(view.recentVariantIds).toEqual(["squat-dumbbell", "squat-barbell"]);
  });
});
