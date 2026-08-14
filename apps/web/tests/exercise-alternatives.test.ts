import { describe, expect, it } from "vitest";
import { compatibleExerciseAlternatives, exerciseById } from "@/features/planning/domain/exercise-alternatives";

describe("compatible exercise alternatives", () => {
  it("returns only active variants with the same movement pattern and compatible equipment", () => {
    const alternatives = compatibleExerciseAlternatives("push-h-bench", {
      kind: "basic_gym",
      equipment: ["free_weights", "benches_supports"]
    });

    expect(alternatives.map((item) => item.id)).toContain("push-h-dumbbell");
    expect(alternatives.map((item) => item.id)).not.toContain("pull-h-dumbbell-row");
    expect(alternatives.map((item) => item.id)).not.toContain("push-h-chest-machine");
    expect(alternatives.map((item) => item.id)).not.toContain("push-h-bench");
  });

  it("returns an unknown variant as no alternatives", () => {
    expect(exerciseById("missing-variant")).toBeUndefined();
    expect(compatibleExerciseAlternatives("missing-variant", { kind: "full_gym", equipment: [] })).toEqual([]);
  });
});
