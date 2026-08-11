import { EXERCISE_CATALOG, type EnvironmentKind, type MovementPattern } from "@/features/catalog/data/exercise-catalog";
import type { Goal } from "@/contracts/onboarding";

const PATTERNS_BY_TITLE: Record<string, MovementPattern[]> = {
  "Fuerza: empuje": ["push_horizontal", "push_vertical", "core"],
  "Fuerza: tracción": ["pull_horizontal", "pull_vertical", "core"],
  "Fuerza: piernas": ["squat", "hinge", "lunge"]
};

// Conservador (ruleVersion "plan-proposal-v1"): 3 series fijas, rango de
// repeticiones por objetivo principal, nunca inventa una carga.
const REP_RANGE_BY_GOAL: Record<Goal, [number, number]> = {
  strength: [4, 6],
  muscle_gain: [8, 12],
  fat_loss: [12, 15],
  endurance: [12, 15],
  active_lifestyle: [10, 12]
};

export function assignSessionExercises(sessionTitle: string, environments: EnvironmentKind[], primaryGoal: Goal) {
  const patterns = PATTERNS_BY_TITLE[sessionTitle] ?? [];
  const [targetRepsMin, targetRepsMax] = REP_RANGE_BY_GOAL[primaryGoal];
  return patterns
    .map((pattern) => EXERCISE_CATALOG.find((variant) => variant.movementPattern === pattern && variant.environments.some((env) => environments.includes(env))))
    .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant))
    .map((variant) => ({ variantId: variant.id, targetSets: 3, targetRepsMin, targetRepsMax }));
}
