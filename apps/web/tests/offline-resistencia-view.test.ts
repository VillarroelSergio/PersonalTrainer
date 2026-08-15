import { describe, expect, it } from "vitest";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { computeResistenciaView } from "@/features/endurance/domain/resistencia-view";
import { isoWeekStart, todayWeekday } from "@/lib/weekdays";

const WEEK_START = isoWeekStart();
const TODAY = todayWeekday();

function plan(sessions: unknown[]) {
  return { id: "plan-a", name: "Plan", contentJson: JSON.stringify({ week: { sessions } }) };
}

function baseSnapshot(overrides: Partial<OfflineSnapshot["data"]> = {}): OfflineSnapshot {
  return {
    userId: "user-1",
    syncedAt: 1,
    data: {
      activePlan: plan([
        { day: TODAY, kind: "endurance", title: "Carrera", estimatedMinutes: 30 },
        { day: TODAY === "monday" ? "tuesday" : "monday", kind: "strength", title: "Piernas", estimatedMinutes: 45, exercises: [] }
      ]),
      enduranceDesigns: [],
      ...overrides
    }
  };
}

describe("computeResistenciaView", () => {
  it("resolves today's endurance session when no ?session= is given", () => {
    const view = computeResistenciaView(baseSnapshot(), undefined);
    if (view.redirect || view.empty) throw new Error("expected a resolved session");
    expect(view.plannedSession).toMatchObject({ title: "Carrera" });
    expect(view.sessionIndex).toBe(0);
    expect(view.weekStart).toBe(WEEK_START);
    expect(view.initialDesign).toBeNull();
  });

  it("shows the empty state when nothing endurance is planned today and no ?session= is given", () => {
    const snapshot = baseSnapshot({ activePlan: plan([{ day: TODAY === "monday" ? "tuesday" : "monday", kind: "strength", title: "Piernas", estimatedMinutes: 45, exercises: [] }]) });
    const view = computeResistenciaView(snapshot, undefined);
    expect(view.empty).toBe(true);
  });

  it("redirects to /hoy for an explicit ?session= pointing at a non-endurance session", () => {
    const view = computeResistenciaView(baseSnapshot(), "1");
    expect(view.redirect).toBe("/hoy");
  });

  it("redirects to /hoy for an explicit ?session= that does not exist", () => {
    const view = computeResistenciaView(baseSnapshot(), "9");
    expect(view.redirect).toBe("/hoy");
  });

  it("resolves a saved design for this plan/week/session into initialDesign", () => {
    const snapshot = baseSnapshot({
      enduranceDesigns: [
        {
          id: "design-1",
          ownerId: "user-1",
          planId: "plan-a",
          isoWeekStart: WEEK_START,
          sessionIndex: 0,
          objective: "base",
          environment: "outdoors",
          optionalLayersJson: JSON.stringify({ duracionMin: "40" }),
          watchPreparedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ]
    });
    const view = computeResistenciaView(snapshot, "0");
    if (view.redirect || view.empty) throw new Error("expected a resolved session");
    expect(view.initialDesign).toEqual({ id: "design-1", objective: "base", environment: "outdoors", optionalLayers: { duracionMin: "40" }, watchPreparedAt: null });
  });

  it("ignores a design saved for a different plan/week/session", () => {
    const snapshot = baseSnapshot({
      enduranceDesigns: [
        { id: "design-1", ownerId: "user-1", planId: "other-plan", isoWeekStart: WEEK_START, sessionIndex: 0, objective: "base", environment: null, optionalLayersJson: null, watchPreparedAt: null, createdAt: "2026-01-01T00:00:00.000Z" }
      ]
    });
    const view = computeResistenciaView(snapshot, "0");
    if (view.redirect || view.empty) throw new Error("expected a resolved session");
    expect(view.initialDesign).toBeNull();
  });

  it("computes conflictText when this session sits next to a legs-heavy strength day", () => {
    const legDay = nextDay(TODAY);
    const snapshot = baseSnapshot({
      activePlan: plan([
        { day: TODAY, kind: "endurance", title: "Carrera larga", estimatedMinutes: 70 },
        { day: legDay, kind: "strength", title: "Piernas", estimatedMinutes: 45, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] }
      ])
    });
    const view = computeResistenciaView(snapshot, undefined);
    if (view.redirect || view.empty) throw new Error("expected a resolved session");
    expect(view.conflictText).not.toBeNull();
  });
});

function nextDay(day: string): string {
  const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  return order[(order.indexOf(day) + 1) % 7];
}
