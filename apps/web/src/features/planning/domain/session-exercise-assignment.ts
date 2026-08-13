import { EDITORIAL_VARIANTS } from "@/features/catalog/data/editorial-exercises";
import type { MovementPattern } from "@/features/catalog/data/exercise-catalog";
import { isEquipmentRequirementSatisfied } from "@/features/catalog/domain/editorial-content";
import { capabilitiesForEnvironment, type EquipmentProfile } from "@/features/catalog/domain/inventory";
import type { Goal } from "@/contracts/onboarding";

const PATTERNS_BY_TITLE: Record<string, MovementPattern[]> = {
  "Fuerza: empuje": ["push_horizontal", "push_vertical", "core"],
  "Fuerza: tracción": ["pull_horizontal", "pull_vertical", "core"],
  "Fuerza: piernas": ["squat", "hinge", "lunge"]
};

// Conservador (ruleVersion "plan-proposal-v1"): 3 series fijas, rango de
// repeticiones por objetivo principal, nunca inventa una carga.
export const REP_RANGE_BY_GOAL: Record<Goal, [number, number]> = {
  strength: [4, 6],
  muscle_gain: [8, 12],
  fat_loss: [12, 15],
  endurance: [12, 15],
  active_lifestyle: [10, 12]
};

export function assignSessionExercises(sessionTitle: string, environment: EquipmentProfile, primaryGoal: Goal) {
  const patterns = PATTERNS_BY_TITLE[sessionTitle] ?? [];
  const [targetRepsMin, targetRepsMax] = REP_RANGE_BY_GOAL[primaryGoal];
  const capabilities = capabilitiesForEnvironment(environment);
  return patterns
    .map((pattern) => EDITORIAL_VARIANTS.find((variant) =>
      variant.active
      && variant.movementPattern === pattern
      && variant.environments.includes(environment.kind)
      && isEquipmentRequirementSatisfied(variant.requirements, capabilities)
    ))
    .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant))
    .map((variant) => ({ variantId: variant.id, targetSets: 3, targetRepsMin, targetRepsMax }));
}
