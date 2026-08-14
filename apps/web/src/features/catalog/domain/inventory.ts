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
  const capabilities = new Set<EquipmentCapability>(["no_equipment"]);
  for (const equipment of profile.equipment) {
    capabilities.add(equipment as EquipmentCapability);
    if (equipment === "racks_smith") {
      capabilities.add("free_weights");
      capabilities.add("benches_supports");
    }
    if (equipment === "pullup_dip_station" || equipment === "resistance_bands") {
      capabilities.add("bodyweight_accessories");
    }
  }
  return [...capabilities];
}
