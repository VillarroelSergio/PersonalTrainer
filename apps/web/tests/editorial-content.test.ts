import { describe, expect, it } from "vitest";
import { isEquipmentRequirementSatisfied, type EquipmentRequirement } from "@/features/catalog/domain/editorial-content";
import { capabilitiesForEnvironment } from "@/features/catalog/domain/inventory";
import { EDITORIAL_VARIANTS } from "@/features/catalog/data/editorial-exercises";
import { EXERCISE_CATALOG, findVariant } from "@/features/catalog/data/exercise-catalog";

describe("isEquipmentRequirementSatisfied", () => {
  it("requires every allOf capability and one anyOf capability", () => {
    const requirement: EquipmentRequirement = { allOf: ["benches_supports"], anyOf: ["free_weights", "bodyweight_accessories"] };
    expect(isEquipmentRequirementSatisfied(requirement, ["benches_supports", "free_weights"])).toBe(true);
    expect(isEquipmentRequirementSatisfied(requirement, ["free_weights"])).toBe(false);
    expect(isEquipmentRequirementSatisfied(requirement, ["benches_supports"])).toBe(false);
  });

  it("is satisfied trivially when there are no requirements", () => {
    expect(isEquipmentRequirementSatisfied({}, [])).toBe(true);
  });

  it("requires only allOf when anyOf is absent", () => {
    expect(isEquipmentRequirementSatisfied({ allOf: ["free_weights"] }, ["free_weights"])).toBe(true);
    expect(isEquipmentRequirementSatisfied({ allOf: ["free_weights"] }, [])).toBe(false);
  });
});

describe("compatibility catalog (exercise-catalog.ts adapter)", () => {
  it("keeps every current variant id addressable through findVariant()", () => {
    expect(findVariant("squat-barbell")?.id).toBe("squat-barbell");
    expect(findVariant("push-h-bench")?.id).toBe("push-h-bench");
    expect(findVariant("pull-v-lat-pulldown")?.id).toBe("pull-v-lat-pulldown");
  });

  it("returns undefined for an unknown id", () => {
    expect(findVariant("does-not-exist")).toBeUndefined();
  });

  it("has the same total variant count as the editorial content it is derived from", () => {
    expect(EXERCISE_CATALOG).toHaveLength(EDITORIAL_VARIANTS.length);
    expect(EXERCISE_CATALOG).toHaveLength(45);
  });

  it("keeps legacy variants and adds the gym editorial collection", () => {
    expect(findVariant("squat-barbell")?.id).toBe("squat-barbell");
    expect(findVariant("leg-press")?.environments).toContain("full_gym");
  });
});

describe("capabilitiesForEnvironment", () => {
  it("uses a variant when its detailed requirements are met", () => {
    const profile = { kind: "full_gym" as const, equipment: ["free_weights", "benches_supports"] as ("free_weights" | "benches_supports")[] };
    expect(capabilitiesForEnvironment(profile)).toEqual(
      expect.arrayContaining(["free_weights", "benches_supports", "no_equipment"])
    );
  });
});
