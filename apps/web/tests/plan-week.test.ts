import { describe, expect, it } from "vitest";
import {
  buildWeekView, occurrenceRenderKey, sessionAction, computeBlockProgress, computeWeekMinutes, computeConsistencyWeeks, evolutionNote,
  type WeekOccurrence, type FinishedSessionRow
} from "@/features/planning/domain/plan-week";
import type { PlanProposal } from "@/contracts/onboarding";

function occurrence(overrides: Partial<WeekOccurrence>): WeekOccurrence {
  return {
    sessionIndex: 0, day: "monday", title: "Piernas", kind: "strength", estimatedMinutes: 60,
    status: "planned", editable: true, movedFromDay: null, movedToDay: null,
    ...overrides
  };
}

const proposal: PlanProposal = {
  proposalId: "p1", ruleVersion: "plan-proposal-v1", reasons: [], alternatives: [],
  initialBlock: { name: "Adaptación", purpose: "Base", weeks: 4 },
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Piernas", estimatedMinutes: 60 },
      { day: "wednesday", kind: "endurance", title: "Carrera suave", estimatedMinutes: 40 }
    ]
  }
};

describe("buildWeekView", () => {
  it("shows plain planned sessions with no adjustments", () => {
    const view = buildWeekView(proposal, true, [], {});
    expect(view).toHaveLength(2);
    expect(view.find((o) => o.sessionIndex === 0)).toMatchObject({ day: "monday", status: "planned", editable: true });
  });

  it("a moved session appears once at origin (moved_away) and once at target (moved_here) — never duplicated as a third entry", () => {
    const view = buildWeekView(proposal, true, [{ sessionIndex: 0, kind: "reschedule", targetDay: "friday", opsJson: "[]" }], {});
    const forIndex0 = view.filter((o) => o.sessionIndex === 0);
    expect(forIndex0).toHaveLength(2);
    expect(forIndex0.find((o) => o.day === "monday")?.status).toBe("moved_away");
    expect(forIndex0.find((o) => o.day === "friday")?.status).toBe("moved_here");
  });

  it("exposes unique render keys even if old dev data contains a same-day reschedule", () => {
    const view = buildWeekView(proposal, true, [{ sessionIndex: 0, kind: "reschedule", targetDay: "monday", opsJson: "[]" }], {});
    expect(new Set(view.map(occurrenceRenderKey)).size).toBe(view.length);
  });

  it("marks a skipped session distinctly from a removed one, both at their origin day", () => {
    const view = buildWeekView(proposal, true, [{ sessionIndex: 0, kind: "skipped", targetDay: null, opsJson: "[]" }], {});
    expect(view.find((o) => o.sessionIndex === 0)).toMatchObject({ status: "skipped", day: "monday" });
  });

  it("an executed occurrence overrides any pending adjustment display and is never editable", () => {
    const view = buildWeekView(proposal, true, [{ sessionIndex: 0, kind: "reschedule", targetDay: "friday", opsJson: "[]" }], { 0: "completed" });
    const forIndex0 = view.filter((o) => o.sessionIndex === 0);
    expect(forIndex0).toHaveLength(1);
    expect(forIndex0[0]).toMatchObject({ status: "completed", editable: false });
  });

  it("a week with no session on a given day has no occurrence for it (rest day)", () => {
    const view = buildWeekView(proposal, true, [], {});
    expect(view.some((o) => o.day === "tuesday")).toBe(false);
  });
});

describe("sessionAction — single primary CTA per day row, no ghost CTA for rest/skipped/completed", () => {
  it("returns 'Iniciar' pointing at /entrenar for a planned strength session", () => {
    expect(sessionAction(occurrence({ kind: "strength", status: "planned", sessionIndex: 3 })))
      .toEqual({ label: "Iniciar", href: "/entrenar?session=3" });
  });

  it("returns 'Continuar' for an in-progress strength session", () => {
    expect(sessionAction(occurrence({ kind: "strength", status: "in_progress" }))?.label).toBe("Continuar");
  });

  it("returns 'Ver sesión' pointing at /resistencia for a planned endurance session", () => {
    expect(sessionAction(occurrence({ kind: "endurance", status: "planned", sessionIndex: 7 })))
      .toEqual({ label: "Ver sesión", href: "/resistencia?session=7" });
  });

  it("returns null for a recolocated-away, skipped, removed, or already-completed occurrence", () => {
    for (const status of ["moved_away", "skipped", "removed", "completed", "adapted", "partial"] as const) {
      expect(sessionAction(occurrence({ status }))).toBeNull();
    }
  });
});

describe("computeBlockProgress — derived from real createdAt, never a stored/fabricated counter", () => {
  it("reads week 1 the day the plan is created", () => {
    const today = new Date(2026, 0, 1);
    expect(computeBlockProgress(today, 8, today)).toEqual({ currentWeek: 1, totalWeeks: 8, percent: 13 });
  });

  it("advances one week per elapsed 7 days", () => {
    const created = new Date(2026, 0, 1);
    const today = new Date(2026, 0, 15);
    expect(computeBlockProgress(created, 8, today)).toMatchObject({ currentWeek: 3 });
  });

  it("clamps at totalWeeks for a plan older than its block", () => {
    const created = new Date(2025, 0, 1);
    const today = new Date(2026, 0, 1);
    expect(computeBlockProgress(created, 4, today)).toMatchObject({ currentWeek: 4, totalWeeks: 4, percent: 100 });
  });
});

describe("computeWeekMinutes — real elapsed time, never the plan's estimate", () => {
  const weekStart = new Date(2026, 0, 5);
  const weekEnd = new Date(2026, 0, 12);

  it("sums endedAt - startedAt only for finished sessions inside the week", () => {
    const history: FinishedSessionRow[] = [
      { startedAt: new Date(2026, 0, 6, 9, 0), endedAt: new Date(2026, 0, 6, 9, 45), status: "completed" },
      { startedAt: new Date(2026, 0, 6, 10, 0), endedAt: new Date(2026, 0, 6, 10, 20), status: "adapted" },
      { startedAt: new Date(2025, 11, 29, 9, 0), endedAt: new Date(2025, 11, 29, 9, 30), status: "completed" }, // outside week
      { startedAt: new Date(2026, 0, 7, 9, 0), endedAt: null, status: "in_progress" } // never finished
    ];
    expect(computeWeekMinutes(history, weekStart, weekEnd)).toBe(65);
  });

  it("is zero with no history", () => {
    expect(computeWeekMinutes([], weekStart, weekEnd)).toBe(0);
  });
});

describe("computeConsistencyWeeks — distinct ISO weeks with a finished session", () => {
  it("counts each week once even with multiple finished sessions", () => {
    const history: FinishedSessionRow[] = [
      { startedAt: new Date(2026, 0, 5), endedAt: new Date(2026, 0, 5), status: "completed" },
      { startedAt: new Date(2026, 0, 7), endedAt: new Date(2026, 0, 7), status: "adapted" },
      { startedAt: new Date(2026, 0, 12), endedAt: new Date(2026, 0, 12), status: "completed" }
    ];
    expect(computeConsistencyWeeks(history)).toBe(2);
  });

  it("ignores skipped/removed rows", () => {
    expect(computeConsistencyWeeks([{ startedAt: new Date(2026, 0, 5), endedAt: null, status: "skipped" } as FinishedSessionRow])).toBe(0);
  });
});

describe("evolutionNote — never a fabricated trend", () => {
  it("says there's nothing yet with no finished sessions", () => {
    expect(evolutionNote([])).toMatch(/Todavía no hay sesiones/);
  });

  it("says it's still early with only one finished session", () => {
    expect(evolutionNote([{ startedAt: new Date(), endedAt: new Date(), status: "completed" }])).toMatch(/Todavía es pronto/);
  });

  it("states the real count once there are at least two", () => {
    const history: FinishedSessionRow[] = [
      { startedAt: new Date(), endedAt: new Date(), status: "completed" },
      { startedAt: new Date(), endedAt: new Date(), status: "adapted" }
    ];
    expect(evolutionNote(history)).toContain("2 sesiones");
  });
});
