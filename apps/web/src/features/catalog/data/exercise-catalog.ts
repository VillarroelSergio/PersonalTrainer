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
 * Semilla editorial mínima (Fase 1): suficientes patrones y variantes por
 * entorno para armar PPL/cuerpo completo, no un inventario exhaustivo de
 * máquinas. Ampliar aquí, nunca inventar contenido en tiempo de ejecución.
 */
export const EXERCISE_CATALOG: ExerciseVariant[] = [
  { id: "squat-barbell", exerciseName: "Sentadilla", variantName: "Sentadilla con barra", movementPattern: "squat", primaryMuscleGroup: "cuadriceps", equipment: "free_weights", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Barra apoyada en trapecio, desciende controlando la rodilla en línea con el pie.", mediaUrl: "/library/exercises/sentadilla-barra-v2.webp" },
  { id: "squat-dumbbell", exerciseName: "Sentadilla", variantName: "Sentadilla goblet con mancuerna", movementPattern: "squat", primaryMuscleGroup: "cuadriceps", equipment: "free_weights", environments: ["full_gym", "basic_gym", "home"], loadType: "external", guide: "Mancuerna pegada al pecho, torso erguido durante todo el recorrido.", mediaUrl: "/library/exercises/sentadilla-goblet-v3.webp" },
  { id: "squat-bodyweight", exerciseName: "Sentadilla", variantName: "Sentadilla con peso corporal", movementPattern: "squat", primaryMuscleGroup: "cuadriceps", equipment: "bodyweight", environments: ["full_gym", "basic_gym", "home", "outdoors"], loadType: "bodyweight", guide: "Pies al ancho de cadera, baja hasta donde la técnica se mantenga limpia." },
  { id: "hinge-barbell", exerciseName: "Peso muerto", variantName: "Peso muerto rumano con barra", movementPattern: "hinge", primaryMuscleGroup: "isquios_gluteos", equipment: "free_weights", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Cadera atrás, barra pegada a las piernas, espalda neutra.", mediaUrl: "/library/exercises/peso-muerto-rumano-v2.webp" },
  { id: "hinge-band", exerciseName: "Peso muerto", variantName: "Peso muerto rumano con banda", movementPattern: "hinge", primaryMuscleGroup: "isquios_gluteos", equipment: "bodyweight_accessories", environments: ["home", "outdoors"], loadType: "external", guide: "Pisa la banda al centro, tensión constante al bajar cadera." },
  { id: "lunge-dumbbell", exerciseName: "Zancada", variantName: "Zancada caminando con mancuernas", movementPattern: "lunge", primaryMuscleGroup: "cuadriceps", equipment: "free_weights", environments: ["full_gym", "basic_gym", "home"], loadType: "external", guide: "Paso largo, rodilla trasera hacia el suelo sin golpear.", mediaUrl: "/library/exercises/zancada-mancuernas-v3.webp" },
  { id: "lunge-bodyweight", exerciseName: "Zancada", variantName: "Zancada con peso corporal", movementPattern: "lunge", primaryMuscleGroup: "cuadriceps", equipment: "bodyweight", environments: ["full_gym", "basic_gym", "home", "outdoors"], loadType: "bodyweight", guide: "Torso estable, empuja desde el talón delantero al subir." },
  { id: "push-h-bench", exerciseName: "Press horizontal", variantName: "Press de banca con barra", movementPattern: "push_horizontal", primaryMuscleGroup: "pecho", secondaryMuscleGroups: ["hombros", "triceps"], equipment: "benches_supports", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Escápulas retraídas, barra baja a la altura del pecho medio.", mediaUrl: "/library/exercises/press-banca-barra-v2.webp" },
  { id: "push-h-dumbbell", exerciseName: "Press horizontal", variantName: "Press de banca con mancuernas", movementPattern: "push_horizontal", primaryMuscleGroup: "pecho", secondaryMuscleGroups: ["hombros", "triceps"], equipment: "benches_supports", environments: ["full_gym", "basic_gym", "home"], loadType: "external", guide: "Codos a 45 grados, recorrido completo sin bloquear con fuerza.", mediaUrl: "/library/exercises/press-banca-mancuernas-v3.webp" },
  { id: "push-h-pushup", exerciseName: "Press horizontal", variantName: "Flexión de brazos", movementPattern: "push_horizontal", primaryMuscleGroup: "pecho", equipment: "bodyweight", environments: ["full_gym", "basic_gym", "home", "outdoors"], loadType: "bodyweight", guide: "Cuerpo en línea recta, baja el pecho cerca del suelo." },
  { id: "push-v-machine", exerciseName: "Press vertical", variantName: "Press de hombro en máquina", movementPattern: "push_vertical", primaryMuscleGroup: "hombros", secondaryMuscleGroups: ["triceps"], equipment: "leg_machines", environments: ["full_gym"], loadType: "external", guide: "Espalda apoyada, empuja sin bloquear el codo con fuerza.", mediaUrl: "/library/exercises/press-maquina-v3.webp" },
  { id: "push-v-dumbbell", exerciseName: "Press vertical", variantName: "Press de hombro con mancuernas", movementPattern: "push_vertical", primaryMuscleGroup: "hombros", equipment: "free_weights", environments: ["full_gym", "basic_gym", "home"], loadType: "external", guide: "Sentado o de pie, empuja recto sobre la línea de hombros.", mediaUrl: "/library/exercises/press-militar-mancuernas-v2.webp" },
  { id: "pull-h-cable-row", exerciseName: "Remo horizontal", variantName: "Remo en polea baja", movementPattern: "pull_horizontal", primaryMuscleGroup: "espalda", equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Espalda neutra, tira llevando el codo hacia atrás.", mediaUrl: "/library/exercises/remo-sentado-maquina-v2.webp" },
  { id: "pull-h-dumbbell-row", exerciseName: "Remo horizontal", variantName: "Remo con mancuerna a una mano", movementPattern: "pull_horizontal", primaryMuscleGroup: "espalda", equipment: "free_weights", environments: ["full_gym", "basic_gym", "home"], loadType: "external", guide: "Apoyo en banco, tira sin rotar el torso." },
  { id: "pull-h-band-row", exerciseName: "Remo horizontal", variantName: "Remo con banda", movementPattern: "pull_horizontal", primaryMuscleGroup: "espalda", equipment: "bodyweight_accessories", environments: ["home", "outdoors"], loadType: "external", guide: "Ancla la banda al frente, tira manteniendo codos cerca del cuerpo." },
  { id: "pull-v-lat-pulldown", exerciseName: "Jalón vertical", variantName: "Jalón al pecho en polea", movementPattern: "pull_vertical", primaryMuscleGroup: "espalda", equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Tira la barra hacia el pecho controlando la vuelta.", mediaUrl: "/library/exercises/jalon-polea-agarre-ancho-v2.webp" },
  { id: "pull-v-pullup-bar", exerciseName: "Jalón vertical", variantName: "Dominada asistida en barra", movementPattern: "pull_vertical", primaryMuscleGroup: "espalda", equipment: "bodyweight_accessories", environments: ["home"], loadType: "bodyweight", guide: "Agarre pronado, sube hasta que la barbilla pase la barra.", mediaUrl: "/library/exercises/dominada-asistida-v3.webp" },
  { id: "core-plank", exerciseName: "Estabilidad de core", variantName: "Plancha frontal", movementPattern: "core", primaryMuscleGroup: "core", secondaryMuscleGroups: ["hombros"], equipment: "bodyweight", environments: ["full_gym", "basic_gym", "home", "outdoors"], loadType: "bodyweight", guide: "Cadera alineada con hombros y tobillos, sin dejarla caer.", mediaUrl: "/library/exercises/plancha-v3.webp" },
  { id: "core-deadbug", exerciseName: "Estabilidad de core", variantName: "Dead bug", movementPattern: "core", primaryMuscleGroup: "core", equipment: "bodyweight", environments: ["full_gym", "basic_gym", "home", "outdoors"], loadType: "bodyweight", guide: "Zona lumbar pegada al suelo durante todo el movimiento." },
  { id: "curl-biceps-barra", exerciseName: "Curl de bíceps", variantName: "Barra Z", movementPattern: "elbow_flexion", primaryMuscleGroup: "biceps", equipment: "free_weights", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Codos pegados al torso, sube sin balancear la espalda.", mediaUrl: "/library/exercises/curl-biceps-barra-v3.webp" },
  { id: "curl-biceps-mancuerna", exerciseName: "Curl de bíceps", variantName: "Mancuernas alterno", movementPattern: "elbow_flexion", primaryMuscleGroup: "biceps", equipment: "free_weights", environments: ["full_gym", "basic_gym", "home"], loadType: "external", guide: "Gira la muñeca hacia fuera al subir, baja con control.", mediaUrl: "/library/exercises/curl-biceps-mancuerna-v2.webp" },
  { id: "extension-triceps-cuerda", exerciseName: "Extensión de tríceps", variantName: "Polea con cuerda", movementPattern: "elbow_extension", primaryMuscleGroup: "triceps", equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Codos fijos junto al cuerpo, extiende sin abrir la cuerda de golpe.", mediaUrl: "/library/exercises/extension-triceps-cuerda-v2.webp" },
  { id: "elevacion-gemelo-maquina", exerciseName: "Elevación de gemelo", variantName: "De pie en máquina", movementPattern: "plantarflexion", primaryMuscleGroup: "gemelos", equipment: "leg_machines", environments: ["full_gym"], loadType: "external", guide: "Sube hasta la punta del pie, baja controlando el estiramiento.", mediaUrl: "/library/exercises/elevacion-gemelo-maquina-v2.webp" },
  { id: "elevacion-gemelo-prensa", exerciseName: "Elevación de gemelo", variantName: "En prensa", movementPattern: "plantarflexion", primaryMuscleGroup: "gemelos", equipment: "leg_machines", environments: ["full_gym"], loadType: "external", guide: "Empuja con la punta del pie, recorrido completo sin rebotar.", mediaUrl: "/library/exercises/elevacion-gemelo-prensa-v3.webp" }
];

export function findVariant(id: string): ExerciseVariant | undefined {
  return EXERCISE_CATALOG.find((variant) => variant.id === id);
}
