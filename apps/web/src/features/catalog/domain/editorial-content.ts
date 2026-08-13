import type { EnvironmentKind, MovementPattern, MuscleGroup } from "@/features/catalog/data/exercise-catalog";

/**
 * Capacidades de equipamiento estables (Task 1). Mapean 1:1 las categorías de
 * `equipmentCategorySchema` (contracts/onboarding.ts) más `no_equipment` para
 * variantes de peso corporal sin accesorios.
 */
export type EquipmentCapability =
  | "free_weights"
  | "benches_supports"
  | "cables_torso"
  | "leg_machines"
  | "bodyweight_accessories"
  | "indoor_cardio"
  | "no_equipment";

/** Todo `allOf` debe cumplirse; si hay `anyOf`, basta con una capacidad de esa lista. */
export type EquipmentRequirement = {
  allOf?: EquipmentCapability[];
  anyOf?: EquipmentCapability[];
};

export type TargetContribution = {
  muscleGroup: MuscleGroup;
  role: "primary" | "secondary";
};

export type EditorialVariant = {
  id: string;
  exerciseName: string;
  variantName: string;
  movementPattern: MovementPattern;
  targets: TargetContribution[];
  requirements: EquipmentRequirement;
  environments: EnvironmentKind[];
  loadType: "external" | "bodyweight";
  guide: string;
  mediaUrl?: string;
  /** Una variante archivada se puede leer desde historial, pero no proponerse en contenido nuevo. */
  active: boolean;
};

/** Agrupa variantes editoriales bajo un mismo ejercicio (mismo patrón de movimiento). */
export type EditorialExercise = {
  exerciseName: string;
  movementPattern: MovementPattern;
  variants: EditorialVariant[];
};

export function isEquipmentRequirementSatisfied(
  requirement: EquipmentRequirement,
  capabilities: readonly string[]
): boolean {
  const available = new Set(capabilities);
  const allOfSatisfied = (requirement.allOf ?? []).every((id) => available.has(id));
  const anyOfSatisfied = !(requirement.anyOf?.length) || requirement.anyOf.some((id) => available.has(id));
  return allOfSatisfied && anyOfSatisfied;
}

export function isVariantEligible(
  variant: EditorialVariant,
  environment: EnvironmentKind,
  capabilities: readonly string[]
): boolean {
  return variant.active
    && variant.environments.includes(environment)
    && isEquipmentRequirementSatisfied(variant.requirements, capabilities);
}
