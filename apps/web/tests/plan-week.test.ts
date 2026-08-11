import { describe, expect, it } from "vitest";
import { buildWeekView, ADDED_SESSION_INDEX_BASE } from "@/features/planning/domain/plan-week";
import type { PlanProposal } from "@/contracts/onboarding";

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

  it("an added session appears once on its declared day with the embedded ops, and is editable only for a future/current week", () => {
    const addedRow = { sessionIndex: ADDED_SESSION_INDEX_BASE + 1, kind: "added", targetDay: "sunday", opsJson: JSON.stringify({ title: "Movilidad extra", kind: "endurance", estimatedMinutes: 20 }) };
    const future = buildWeekView(proposal, true, [addedRow], {});
    const past = buildWeekView(proposal, false, [addedRow], {});
    expect(future.find((o) => o.isAdded)).toMatchObject({ day: "sunday", title: "Movilidad extra", estimatedMinutes: 20, editable: true });
    expect(past.find((o) => o.isAdded)?.editable).toBe(false);
  });

  it("a week with no session on a given day has no occurrence for it (rest day)", () => {
    const view = buildWeekView(proposal, true, [], {});
    expect(view.some((o) => o.day === "tuesday")).toBe(false);
  });
});
