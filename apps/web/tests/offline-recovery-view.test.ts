import { describe, expect, it } from "vitest";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { computeRecoveryView } from "@/features/recovery/domain/recovery-view";

function plan(sessions: unknown[]) {
  return { id: "plan-a", name: "Plan", contentJson: JSON.stringify({ week: { sessions } }) };
}

function baseSnapshot(overrides: Partial<OfflineSnapshot["data"]> = {}): OfflineSnapshot {
  return {
    userId: "user-1",
    syncedAt: 1,
    data: {
      activePlan: plan([
        { day: "monday", kind: "strength", title: "Piernas", estimatedMinutes: 45, exercises: [] },
        { day: "wednesday", kind: "endurance", title: "Carrera", estimatedMinutes: 30 }
      ]),
      recoverySessions: [],
      ...overrides
    }
  };
}

describe("computeRecoveryView", () => {
  it("reconstructs runner inputs from the local snapshot and session query", () => {
    const view = computeRecoveryView(baseSnapshot(), "0");

    if (view.redirect) throw new Error("expected recovery view");
    expect(view).toMatchObject({
      activePlan: { id: "plan-a" },
      sessionIndex: 0,
      sessionTitle: "Piernas",
      initialSessionId: null,
      initialStatus: null
    });
  });

  it("resumes the latest recovery session for the active plan and session", () => {
    const view = computeRecoveryView(baseSnapshot({
      recoverySessions: [
        { id: "old", planId: "plan-a", sessionIndex: 0, status: "completed", startedAt: "2026-01-01T00:00:00.000Z" },
        { id: "current", planId: "plan-a", sessionIndex: 0, status: "in_progress", startedAt: "2026-01-02T00:00:00.000Z" },
        { id: "other-plan", planId: "plan-b", sessionIndex: 0, status: "in_progress", startedAt: "2026-01-03T00:00:00.000Z" }
      ]
    }), "0");

    if (view.redirect) throw new Error("expected recovery view");
    expect(view.initialSessionId).toBe("current");
    expect(view.initialStatus).toBe("in_progress");
  });

  it("redirects to /hoy when the session query cannot resolve a planned session", () => {
    expect(computeRecoveryView(baseSnapshot(), undefined).redirect).toBe("/hoy");
    expect(computeRecoveryView(baseSnapshot(), "9").redirect).toBe("/hoy");
  });
});
