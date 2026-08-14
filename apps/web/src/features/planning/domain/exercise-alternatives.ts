import { EDITORIAL_VARIANTS } from "@/features/catalog/data/editorial-exercises";
import type { EditorialVariant } from "@/features/catalog/domain/editorial-content";
import { isEquipmentRequirementSatisfied } from "@/features/catalog/domain/editorial-content";
import { capabilitiesForEnvironment, type EquipmentProfile } from "@/features/catalog/domain/inventory";

export function exerciseById(variantId: string): EditorialVariant | undefined {
  return EDITORIAL_VARIANTS.find((variant) => variant.id === variantId);
}

export function compatibleExerciseAlternatives(variantId: string, environment: EquipmentProfile): EditorialVariant[] {
  const current = exerciseById(variantId);
  if (!current) return [];

  const capabilities = capabilitiesForEnvironment(environment);
  return EDITORIAL_VARIANTS.filter((variant) => (
    variant.id !== current.id
    && variant.active
    && variant.movementPattern === current.movementPattern
    && variant.environments.includes(environment.kind)
    && isEquipmentRequirementSatisfied(variant.requirements, capabilities)
  ));
}
