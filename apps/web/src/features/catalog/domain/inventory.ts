import type { OnboardingDraft } from "@/contracts/onboarding";
import type { EquipmentCapability } from "@/features/catalog/domain/editorial-content";

/** Un entorno declarado en onboarding, con su inventario de equipamiento. */
export type EquipmentProfile = OnboardingDraft["environments"][number];

/**
 * Traduce el inventario de equipamiento declarado en onboarding a capacidades
 * editoriales (Task 2). Todo el mundo puede hacer ejercicios sin equipo, así
 * que `no_equipment` siempre está disponible.
 */
export function capabilitiesForEnvironment(profile: EquipmentProfile): EquipmentCapability[] {
  return [...new Set([...profile.equipment, "no_equipment"] as EquipmentCapability[])];
}
