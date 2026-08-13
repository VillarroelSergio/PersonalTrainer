import { describe, expect, it } from "vitest";
import { computeBaseline, type Exposure } from "@/features/workouts/domain/progression";

function exposure(overrides: Partial<Exposure> = {}): Exposure {
  return {
    targetSets: 3,
    targetRepsMin: 8,
    targetRepsMax: 10,
    sessionStatus: "completed",
    sets: [
      { loadKg: 20, repetitions: 10, difficulty: "just_right" },
      { loadKg: 20, repetitions: 10, difficulty: "just_right" },
      { loadKg: 20, repetitions: 10, difficulty: "just_right" }
    ],
    ...overrides
  };
}

describe("progression-v1", () => {
  it("has no baseline and asks to calibrate with zero exposures", () => {
    const baseline = computeBaseline([]);
    expect(baseline.hasBaseline).toBe(false);
    expect(baseline.suggestion.type).toBe("calibrate");
  });

  it("proposes a minimal load increase after three complete, adequate exposures at the rep ceiling", () => {
    const baseline = computeBaseline([exposure(), exposure(), exposure()]);
    expect(baseline.ruleVersion).toBe("progression-v1");
    expect(baseline.suggestion).toEqual({ type: "increase_load", loadKg: 22.5, reason: expect.any(String) });
    expect(baseline.confidence).toBeGreaterThan(0);
  });

  it("proposes one more repetition instead of load when still below the rep ceiling", () => {
    const belowCeiling = () => exposure({ sets: [{ loadKg: 20, repetitions: 8, difficulty: "just_right" }, { loadKg: 20, repetitions: 8, difficulty: "just_right" }, { loadKg: 20, repetitions: 8, difficulty: "just_right" }] });
    const baseline = computeBaseline([belowCeiling(), belowCeiling()]);
    expect(baseline.suggestion).toEqual({ type: "increase_reps", repetitions: 9, reason: expect.any(String) });
  });

  it("never progresses after a partial close, regardless of prior good exposures", () => {
    const baseline = computeBaseline([exposure(), exposure(), exposure({ sessionStatus: "partial", sets: [{ loadKg: 20, repetitions: 6, difficulty: null }] })]);
    expect(baseline.suggestion.type).toBe("maintain");
  });

  it("never progresses when a set felt too hard", () => {
    const baseline = computeBaseline([exposure(), exposure({ sets: [{ loadKg: 20, repetitions: 10, difficulty: "too_hard" }, { loadKg: 20, repetitions: 8, difficulty: "just_right" }, { loadKg: 20, repetitions: 7, difficulty: "just_right" }] })]);
    expect(baseline.suggestion.type).toBe("maintain");
  });
});
