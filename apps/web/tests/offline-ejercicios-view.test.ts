import { describe, expect, it } from "vitest";
import { computeEjerciciosView } from "@/features/catalog/domain/ejercicios-view";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";

function baseSnapshot(overrides: Partial<OfflineSnapshot["data"]> = {}): OfflineSnapshot {
  return { userId: "owner-1", syncedAt: Date.now(), data: { favorites: [], history: { workoutSessions: [], sessionExercises: [] }, ...overrides } };
}

describe("computeEjerciciosView", () => {
  it("returns favorite variant ids from the snapshot", () => {
    const snapshot = baseSnapshot({ favorites: [{ variantId: "squat-back" }, { variantId: "bench-press" }] });
    expect(computeEjerciciosView(snapshot).favoriteVariantIds).toEqual(["squat-back", "bench-press"]);
  });

  it("returns the 5 most recently used variant ids, newest first, deduplicated", () => {
    const snapshot = baseSnapshot({
      history: {
        workoutSessions: [
          { id: "w1", startedAt: "2026-08-01T00:00:00.000Z" },
          { id: "w2", startedAt: "2026-08-05T00:00:00.000Z" },
          { id: "w3", startedAt: "2026-08-10T00:00:00.000Z" }
        ],
        sessionExercises: [
          { id: "e1", workoutSessionId: "w1", variantId: "squat-back" },
          { id: "e2", workoutSessionId: "w2", variantId: "bench-press" },
          { id: "e3", workoutSessionId: "w3", variantId: "squat-back" },
          { id: "e4", workoutSessionId: "w3", variantId: "deadlift" },
          { id: "e5", workoutSessionId: "w1", variantId: "row-barbell" },
          { id: "e6", workoutSessionId: "w1", variantId: "overhead-press" },
          { id: "e7", workoutSessionId: "w1", variantId: "lat-pulldown" }
        ]
      }
    });
    const view = computeEjerciciosView(snapshot);
    expect(view.recentVariantIds).toHaveLength(5);
    expect(view.recentVariantIds[0]).toBe("deadlift");
    expect(view.recentVariantIds[1]).toBe("squat-back");
  });

  it("returns empty arrays when the snapshot has no favorites or history", () => {
    const view = computeEjerciciosView(baseSnapshot());
    expect(view.favoriteVariantIds).toEqual([]);
    expect(view.recentVariantIds).toEqual([]);
  });
});
