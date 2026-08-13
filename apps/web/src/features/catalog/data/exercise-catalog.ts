import type { z } from "zod";
import type { equipmentCategorySchema } from "@/contracts/onboarding";

export type MovementPattern = "squat" | "hinge" | "lunge" | "push_horizontal" | "push_vertical" | "pull_horizontal" | "pull_vertical" | "core" | "elbow_flexion" | "elbow_extension" | "plantarflexion";
export type MuscleGroup = "pecho" | "espalda" | "hombros" | "biceps" | "triceps" | "cuadriceps" | "isquios_gluteos" | "gemelos" | "core";
export type EnvironmentKind = "full_gym" | "basic_gym" | "home" | "outdoors";
export type EquipmentCategory = z.infer<typeof equipmentCategorySchema>;

/** Los nueve grupos aprobados de la biblioteca (VISUAL-PARITY-CONTRACT.md), en el orden en que se muestran. */
export const MUSCLE_GROUPS: MuscleGroup[] = ["pecho", "espalda", "hombros", "biceps", "triceps", "cuadriceps", "isquios_gluteos", "gemelos", "core"];
export const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = {
  pecho: "Pecho", espalda: "Espalda", hombros: "Hombros", biceps: "Bíceps", triceps: "Tríceps",
  cuadriceps: "Cuádriceps", isquios_gluteos: "Isquios y glúteos", gemelos: "Gemelos", core: "Core"
};
/** Ilustraciones reales migradas de prototype/assets/library/groups/ (Bloqueante 5), una por grupo aprobado. */
export const MUSCLE_GROUP_IMAGE: Record<MuscleGroup, string> = {
  pecho: "pecho-card-v1.webp", espalda: "espalda-card-v1.webp", hombros: "hombros-card-v1.webp",
  biceps: "biceps-card-v1.webp", triceps: "triceps-card-v1.webp", cuadriceps: "cuadriceps-card-v1.webp",
  isquios_gluteos: "isquios-gluteos-card-v1.webp", gemelos: "gemelos-card-v1.webp", core: "core-card-v1.webp"
};

export type ExerciseVariant = {
  id: string;
  exerciseName: string;
  variantName: string;
  movementPattern: MovementPattern;
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups?: MuscleGroup[];
  equipment: EquipmentCategory | "bodyweight";
  /** Environments where this variant is realistically available. */
  environments: EnvironmentKind[];
  loadType: "external" | "bodyweight";
  guide: string;
  /** Path under public/library/exercises/, copied consciously from prototype/assets/ (Bloqueante 5) — only set when a real illustration exists for this exact variant. Absent, never a placeholder or an invented URL. */
  mediaUrl?: string;
};

/**
 * Adaptador de compatibilidad (Task 1): `ExerciseVariant`/`EXERCISE_CATALOG`/
 * `findVariant` se derivan del contenido editorial en `editorial-exercises.ts`
 * en vez de duplicar los datos, conservando el mismo comportamiento
 * observable para quienes ya importan desde este archivo.
 */
import { EDITORIAL_VARIANTS } from "@/features/catalog/data/editorial-exercises";

function equipmentFromRequirement(variant: (typeof EDITORIAL_VARIANTS)[number]): EquipmentCategory | "bodyweight" {
  const capability = variant.requirements.anyOf?.[0] ?? variant.requirements.allOf?.[0];
  return capability === "no_equipment" || capability === undefined ? "bodyweight" : (capability as EquipmentCategory);
}

export const EXERCISE_CATALOG: ExerciseVariant[] = EDITORIAL_VARIANTS.filter((variant) => variant.active).map((variant) => {
  const primary = variant.targets.find((target) => target.role === "primary");
  const secondary = variant.targets.filter((target) => target.role === "secondary").map((target) => target.muscleGroup);
  return {
    id: variant.id,
    exerciseName: variant.exerciseName,
    variantName: variant.variantName,
    movementPattern: variant.movementPattern,
    primaryMuscleGroup: (primary?.muscleGroup ?? variant.targets[0]?.muscleGroup) as MuscleGroup,
    ...(secondary.length > 0 ? { secondaryMuscleGroups: secondary } : {}),
    equipment: equipmentFromRequirement(variant),
    environments: variant.environments,
    loadType: variant.loadType,
    guide: variant.guide,
    ...(variant.mediaUrl ? { mediaUrl: variant.mediaUrl } : {})
  };
});

export function findVariant(id: string): ExerciseVariant | undefined {
  return EXERCISE_CATALOG.find((variant) => variant.id === id);
}
