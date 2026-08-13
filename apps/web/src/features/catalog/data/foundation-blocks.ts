import type { EquipmentRequirement } from "@/features/catalog/domain/editorial-content";
import type { TrainingBlock } from "@/features/catalog/domain/training-block";

/**
 * Bloques editoriales cortos y opcionales de preparación/cierre de sesión
 * (Task 3). Genéricos, sin lenguaje de tratamiento ni afirmaciones clínicas:
 * nunca alimentan progresión ni volumen de fuerza (ver `contributesToStrengthProgression`).
 */
export type FoundationBlock = TrainingBlock & { requirements: EquipmentRequirement };

export const FOUNDATION_BLOCKS: FoundationBlock[] = [
  {
    id: "warmup-general-mobility",
    kind: "warmup",
    estimatedMinutes: 5,
    instructions: "Movilidad articular general: tobillos, caderas y hombros con movimientos suaves y controlados.",
    requirements: {}
  },
  {
    id: "warmup-breathing-activation",
    kind: "warmup",
    estimatedMinutes: 3,
    instructions: "Respiración y activación general antes de empezar: unas rondas de respiración controlada de pie.",
    requirements: {}
  },
  {
    id: "cooldown-general-mobility",
    kind: "cooldown",
    estimatedMinutes: 5,
    instructions: "Vuelta a la calma con movilidad general suave y respiración tranquila.",
    requirements: {}
  },
  {
    id: "mobility-foam-roll",
    kind: "mobility",
    estimatedMinutes: 6,
    instructions: "Trabajo suave con rodillo de espuma en las zonas trabajadas, a un ritmo cómodo.",
    requirements: { anyOf: ["bodyweight_accessories"] }
  }
];
