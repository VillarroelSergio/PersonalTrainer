import type { EquipmentCapability } from "@/features/catalog/domain/editorial-content";

/**
 * Catálogo estable de capacidades de equipamiento (Task 1). Una por cada
 * categoría de `equipmentCategorySchema` (contracts/onboarding.ts) más
 * `no_equipment` para variantes de peso corporal sin accesorios.
 */
export const EQUIPMENT_CAPABILITIES: Array<{ id: EquipmentCapability; label: string }> = [
  { id: "free_weights", label: "Pesos libres" },
  { id: "benches_supports", label: "Bancos y soportes" },
  { id: "cables_torso", label: "Poleas de torso" },
  { id: "leg_machines", label: "Máquinas de pierna" },
  { id: "bodyweight_accessories", label: "Accesorios de peso corporal" },
  { id: "indoor_cardio", label: "Cardio indoor" },
  { id: "racks_smith", label: "Rack y multipower" },
  { id: "pullup_dip_station", label: "Dominadas y fondos" },
  { id: "resistance_bands", label: "Bandas elásticas" },
  { id: "no_equipment", label: "Sin equipamiento" }
];
