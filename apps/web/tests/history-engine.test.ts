import { describe, expect, it } from "vitest";
import { computeAdherence, computeMetricTrend, loadCategoryForPattern, pickAchievements, type AdjustmentOccurrence, type ExecutedOccurrence, type PlannedStrengthOccurrence } from "@/features/history/domain/history-engine";
import { parseIsoDateLocal } from "@/lib/weekdays";

describe("computeAdherence", () => {
  const planned: PlannedStrengthOccurrence[] = [{ sessionIndex: 0, day: "monday" }];

  it("counts nothing before the plan's first due day", () => {
    const result = computeAdherence(planned, parseIsoDateLocal("2026-08-10"), parseIsoDateLocal("2026-08-10"), [], []);
    expect(result.previstas).toBe(1);
  });

  it("classifies a completed, an adapted and a partial exposure in three different weeks", () => {
    const executed: ExecutedOccurrence[] = [
      { sessionIndex: 0, isoWeekStart: "2026-08-10", status: "completed" },
      { sessionIndex: 0, isoWeekStart: "2026-08-17", status: "adapted" },
      { sessionIndex: 0, isoWeekStart: "2026-08-24", status: "partial" }
    ];
    const result = computeAdherence(planned, parseIsoDateLocal("2026-08-10"), parseIsoDateLocal("2026-08-24"), executed, []);
    expect(result).toEqual({ previstas: 3, completadas: 1, adaptadas: 1, parciales: 1, omitidas: 0, recolocadas: 0 });
  });

  it("counts a due occurrence with no execution and no adjustment as omitted", () => {
    const result = computeAdherence(planned, parseIsoDateLocal("2026-08-10"), parseIsoDateLocal("2026-08-10"), [], []);
    expect(result).toEqual({ previstas: 1, completadas: 0, adaptadas: 0, parciales: 0, omitidas: 1, recolocadas: 0 });
  });

  it("counts a rescheduled occurrence as recolocada, not omitida, even without a matching workout_session row", () => {
    const adjustments: AdjustmentOccurrence[] = [{ sessionIndex: 0, isoWeekStart: "2026-08-10", kind: "reschedule" }];
    const result = computeAdherence(planned, parseIsoDateLocal("2026-08-10"), parseIsoDateLocal("2026-08-10"), [], adjustments);
    expect(result).toEqual({ previstas: 1, completadas: 0, adaptadas: 0, parciales: 0, omitidas: 0, recolocadas: 1 });
  });

  it("does not count next week's occurrence until its own day arrives", () => {
    // 2026-08-10 is a Monday; the following Monday (2026-08-17) has not arrived yet on 2026-08-11.
    const result = computeAdherence(planned, parseIsoDateLocal("2026-08-10"), parseIsoDateLocal("2026-08-11"), [], []);
    expect(result.previstas).toBe(1);
  });
});

describe("loadCategoryForPattern", () => {
  it("classifies squat/hinge/lunge as piernas", () => {
    expect(loadCategoryForPattern("squat")).toBe("piernas");
    expect(loadCategoryForPattern("hinge")).toBe("piernas");
    expect(loadCategoryForPattern("lunge")).toBe("piernas");
  });

  it("classifies everything else as tren_superior", () => {
    expect(loadCategoryForPattern("push_horizontal")).toBe("tren_superior");
    expect(loadCategoryForPattern("core")).toBe("tren_superior");
  });
});

describe("pickAchievements", () => {
  it("has no achievement reached and the first threshold as cercano at zero adherence", () => {
    const result = pickAchievements(0);
    expect(result.alcanzado).toBeNull();
    expect(result.cercano).toEqual({ threshold: 1, label: expect.any(String) });
  });

  it("reaches the highest threshold met and reports the next one as cercano", () => {
    const result = pickAchievements(7);
    expect(result.alcanzado).toEqual({ threshold: 5, label: expect.any(String) });
    expect(result.cercano).toEqual({ threshold: 10, label: expect.any(String) });
  });
});

describe("computeMetricTrend", () => {
  it("returns null with fewer than two entries", () => {
    expect(computeMetricTrend([])).toBeNull();
    expect(computeMetricTrend([{ value: 70, unit: "kg", measuredAt: "2026-08-01" }])).toBeNull();
  });

  it("reports the diff between the first and last entry, sorted by date", () => {
    const trend = computeMetricTrend([
      { value: 72, unit: "kg", measuredAt: "2026-08-10" },
      { value: 70, unit: "kg", measuredAt: "2026-08-01" }
    ]);
    expect(trend?.diff).toBe(2);
    expect(trend?.text).toContain("+2 kg");
  });
});
