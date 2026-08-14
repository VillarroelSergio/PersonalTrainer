import { describe, expect, it } from "vitest";
import { latestWeekStatuses } from "@/features/planning/domain/plan-week";

describe("latestWeekStatuses", () => {
  it("uses only the current ISO week so an old in-progress session is not shown as active today", () => {
    const statuses = latestWeekStatuses([
      { sessionIndex: 0, startedAt: new Date("2026-08-03T09:00:00Z"), status: "in_progress" },
      { sessionIndex: 1, startedAt: new Date("2026-08-12T09:00:00Z"), status: "in_progress" }
    ], new Date("2026-08-10T00:00:00Z"), new Date("2026-08-17T00:00:00Z"));

    expect(statuses).toEqual({ 1: "in_progress" });
  });
});
