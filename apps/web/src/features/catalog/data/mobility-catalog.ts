import type { EnvironmentKind, MuscleGroup } from "@/features/catalog/data/exercise-catalog";

export type MobilityCategory = "mobility" | "stretch";
export type MobilityMetric = "seconds" | "reps";

export type MobilityExercise = {
  id: string;
  exerciseName: string;
  variantName: string;
  category: MobilityCategory;
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups?: MuscleGroup[];
  environments: EnvironmentKind[];
  metric: MobilityMetric;
  defaultDose: string;
  guide: string;
  mediaUrl: string;
};

const ALL_ENVIRONMENTS: EnvironmentKind[] = ["full_gym", "basic_gym", "home", "outdoors"];
const HOME_ENVIRONMENTS: EnvironmentKind[] = ["full_gym", "basic_gym", "home"];

/** Catálogo de movilidad y estiramientos: no participa en la progresión de fuerza. */
export const MOBILITY_EXERCISES: MobilityExercise[] = [
  { id: "mobility-cat-cow", exerciseName: "Movilidad de columna", variantName: "Gato-vaca", category: "mobility", primaryMuscleGroup: "core", secondaryMuscleGroups: ["espalda"], environments: ALL_ENVIRONMENTS, metric: "reps", defaultDose: "8–10 repeticiones", guide: "Alterna flexión y extensión suave de la columna acompañando el movimiento con la respiración.", mediaUrl: "/library/exercises/movilidad-gato-vaca-v1.webp" },
  { id: "mobility-child-pose", exerciseName: "Movilidad de espalda", variantName: "Postura del niño dinámica", category: "mobility", primaryMuscleGroup: "espalda", secondaryMuscleGroups: ["hombros"], environments: ALL_ENVIRONMENTS, metric: "seconds", defaultDose: "30–45 segundos", guide: "Lleva la cadera atrás y alcanza con las manos sin forzar el rango.", mediaUrl: "/library/exercises/movilidad-postura-nino-v1.webp" },
  { id: "mobility-90-90-switch", exerciseName: "Movilidad de cadera", variantName: "Cambios 90/90", category: "mobility", primaryMuscleGroup: "isquios_gluteos", secondaryMuscleGroups: ["cuadriceps"], environments: ALL_ENVIRONMENTS, metric: "reps", defaultDose: "6–8 por lado", guide: "Cambia de una posición 90/90 a la otra manteniendo el tronco alto y el movimiento controlado.", mediaUrl: "/library/exercises/movilidad-90-90-v1.webp" },
  { id: "mobility-half-kneeling-hip", exerciseName: "Movilidad de cadera", variantName: "Media rodilla con alcance", category: "mobility", primaryMuscleGroup: "isquios_gluteos", secondaryMuscleGroups: ["core"], environments: ALL_ENVIRONMENTS, metric: "reps", defaultDose: "6–8 por lado", guide: "Aprieta suavemente el glúteo de la pierna atrasada y alcanza con el brazo contrario.", mediaUrl: "/library/exercises/movilidad-media-rodilla-v1.webp" },
  { id: "mobility-deep-squat-pry", exerciseName: "Movilidad de tobillo y cadera", variantName: "Sentadilla profunda con balanceo", category: "mobility", primaryMuscleGroup: "cuadriceps", secondaryMuscleGroups: ["gemelos", "isquios_gluteos"], environments: HOME_ENVIRONMENTS, metric: "seconds", defaultDose: "30 segundos", guide: "Busca una posición cómoda y desplaza el peso de un lado al otro sin rebotes.", mediaUrl: "/library/exercises/movilidad-sentadilla-profunda-v1.webp" },
  { id: "mobility-adductor-rockback", exerciseName: "Movilidad de aductores", variantName: "Rockback de aductor", category: "mobility", primaryMuscleGroup: "isquios_gluteos", secondaryMuscleGroups: ["cuadriceps"], environments: HOME_ENVIRONMENTS, metric: "reps", defaultDose: "8 por lado", guide: "Desde cuatro apoyos, extiende una pierna al lado y lleva la cadera atrás con control.", mediaUrl: "/library/exercises/movilidad-aductor-rockback-v1.webp" },
  { id: "mobility-open-book", exerciseName: "Movilidad torácica", variantName: "Libro abierto", category: "mobility", primaryMuscleGroup: "espalda", secondaryMuscleGroups: ["hombros"], environments: ALL_ENVIRONMENTS, metric: "reps", defaultDose: "6–8 por lado", guide: "Abre el brazo siguiendo la mano con la mirada, manteniendo las rodillas juntas.", mediaUrl: "/library/exercises/movilidad-libro-abierto-v1.webp" },
  { id: "mobility-quadruped-rotation", exerciseName: "Movilidad torácica", variantName: "Rotación en cuadrupedia", category: "mobility", primaryMuscleGroup: "espalda", secondaryMuscleGroups: ["hombros", "core"], environments: ALL_ENVIRONMENTS, metric: "reps", defaultDose: "6–8 por lado", guide: "Apoya una mano y rota el codo contrario hacia el techo sin mover la pelvis.", mediaUrl: "/library/exercises/movilidad-rotacion-cuadrupedia-v1.webp" },
  { id: "mobility-wall-shoulder-flexion", exerciseName: "Movilidad de hombro", variantName: "Deslizamiento en pared", category: "mobility", primaryMuscleGroup: "hombros", secondaryMuscleGroups: ["espalda"], environments: HOME_ENVIRONMENTS, metric: "reps", defaultDose: "8–10 repeticiones", guide: "Desliza los brazos por la pared hasta donde puedas mantener costillas y cuello relajados.", mediaUrl: "/library/exercises/movilidad-deslizamiento-pared-v1.webp" },
  { id: "mobility-band-pass-through", exerciseName: "Movilidad de hombro", variantName: "Pasadas con banda", category: "mobility", primaryMuscleGroup: "hombros", secondaryMuscleGroups: ["pecho"], environments: HOME_ENVIRONMENTS, metric: "reps", defaultDose: "8–10 repeticiones", guide: "Con agarre amplio, pasa la banda por encima de la cabeza sin arquear la espalda.", mediaUrl: "/library/exercises/movilidad-pasadas-banda-v1.webp" },
  { id: "mobility-worlds-greatest", exerciseName: "Movilidad global", variantName: "World's greatest stretch", category: "mobility", primaryMuscleGroup: "isquios_gluteos", secondaryMuscleGroups: ["hombros", "cuadriceps"], environments: ALL_ENVIRONMENTS, metric: "reps", defaultDose: "4–6 por lado", guide: "Combina zancada, rotación torácica y extensión de cadera en una secuencia lenta.", mediaUrl: "/library/exercises/movilidad-worlds-greatest-v1.webp" },
  { id: "mobility-ankle-knee-wall", exerciseName: "Movilidad de tobillo", variantName: "Rodilla a la pared", category: "mobility", primaryMuscleGroup: "gemelos", secondaryMuscleGroups: ["cuadriceps"], environments: ALL_ENVIRONMENTS, metric: "reps", defaultDose: "8 por lado", guide: "Acerca la rodilla a la pared manteniendo el talón apoyado y vuelve despacio.", mediaUrl: "/library/exercises/movilidad-tobillo-pared-v1.webp" },
  { id: "stretch-hip-flexor", exerciseName: "Estiramiento de cadera", variantName: "Flexor de cadera en media rodilla", category: "stretch", primaryMuscleGroup: "isquios_gluteos", secondaryMuscleGroups: ["cuadriceps"], environments: ALL_ENVIRONMENTS, metric: "seconds", defaultDose: "30–45 segundos por lado", guide: "Mantén el tronco alto y desplaza la pelvis ligeramente hacia delante sin rebotes.", mediaUrl: "/library/exercises/estiramiento-flexor-cadera-v1.webp" },
  { id: "stretch-quad-standing", exerciseName: "Estiramiento de pierna", variantName: "Cuádriceps de pie", category: "stretch", primaryMuscleGroup: "cuadriceps", secondaryMuscleGroups: ["isquios_gluteos"], environments: ALL_ENVIRONMENTS, metric: "seconds", defaultDose: "30 segundos por lado", guide: "Junta las rodillas, lleva el talón hacia el glúteo y mantén una postura estable.", mediaUrl: "/library/exercises/estiramiento-cuadriceps-pie-v1.webp" },
  { id: "stretch-hamstring-standing", exerciseName: "Estiramiento de pierna", variantName: "Isquios de pie", category: "stretch", primaryMuscleGroup: "isquios_gluteos", secondaryMuscleGroups: ["gemelos"], environments: ALL_ENVIRONMENTS, metric: "seconds", defaultDose: "30–45 segundos por lado", guide: "Apoya el talón, flexiona ligeramente la rodilla y lleva la cadera atrás.", mediaUrl: "/library/exercises/estiramiento-isquios-pie-v1.webp" },
  { id: "stretch-glute-figure-four", exerciseName: "Estiramiento de glúteo", variantName: "Figura cuatro sentado", category: "stretch", primaryMuscleGroup: "isquios_gluteos", secondaryMuscleGroups: ["core"], environments: ALL_ENVIRONMENTS, metric: "seconds", defaultDose: "30–45 segundos por lado", guide: "Cruza el tobillo sobre la rodilla y acerca el pecho con la espalda larga.", mediaUrl: "/library/exercises/estiramiento-figura-cuatro-v1.webp" },
  { id: "stretch-calf-wall", exerciseName: "Estiramiento de pantorrilla", variantName: "Gemelo contra pared", category: "stretch", primaryMuscleGroup: "gemelos", environments: ALL_ENVIRONMENTS, metric: "seconds", defaultDose: "30 segundos por lado", guide: "Mantén el talón atrás apoyado y desplaza el cuerpo hacia la pared sin rebotes.", mediaUrl: "/library/exercises/estiramiento-gemelo-pared-v1.webp" },
  { id: "stretch-pec-doorway", exerciseName: "Estiramiento de pecho", variantName: "Pectoral en marco de puerta", category: "stretch", primaryMuscleGroup: "pecho", secondaryMuscleGroups: ["hombros"], environments: HOME_ENVIRONMENTS, metric: "seconds", defaultDose: "30 segundos por lado", guide: "Apoya el antebrazo en el marco y gira el tronco suavemente hacia fuera.", mediaUrl: "/library/exercises/estiramiento-pectoral-puerta-v1.webp" },
  { id: "stretch-cross-body-shoulder", exerciseName: "Estiramiento de hombro", variantName: "Hombro cruzado", category: "stretch", primaryMuscleGroup: "hombros", secondaryMuscleGroups: ["espalda"], environments: ALL_ENVIRONMENTS, metric: "seconds", defaultDose: "30 segundos por lado", guide: "Cruza el brazo delante del pecho y acércalo con el otro sin elevar el hombro.", mediaUrl: "/library/exercises/estiramiento-hombro-cruzado-v1.webp" },
  { id: "stretch-lat-child-reach", exerciseName: "Estiramiento de espalda", variantName: "Dorsal con alcance lateral", category: "stretch", primaryMuscleGroup: "espalda", secondaryMuscleGroups: ["hombros"], environments: HOME_ENVIRONMENTS, metric: "seconds", defaultDose: "30 segundos por lado", guide: "Desde postura de niño, camina con las manos hacia un lado y respira despacio.", mediaUrl: "/library/exercises/estiramiento-dorsal-lateral-v1.webp" },
  { id: "stretch-wrist-flexor", exerciseName: "Movilidad de muñeca", variantName: "Flexores de muñeca", category: "stretch", primaryMuscleGroup: "triceps", secondaryMuscleGroups: ["hombros"], environments: ALL_ENVIRONMENTS, metric: "seconds", defaultDose: "20–30 segundos por lado", guide: "Extiende el codo y lleva los dedos hacia atrás con una tensión cómoda.", mediaUrl: "/library/exercises/estiramiento-muneca-flexores-v1.webp" },
  { id: "stretch-wrist-extensor", exerciseName: "Movilidad de muñeca", variantName: "Extensores de muñeca", category: "stretch", primaryMuscleGroup: "triceps", secondaryMuscleGroups: ["hombros"], environments: ALL_ENVIRONMENTS, metric: "seconds", defaultDose: "20–30 segundos por lado", guide: "Con el codo extendido, flexiona la muñeca suavemente y mantén los dedos relajados.", mediaUrl: "/library/exercises/estiramiento-muneca-extensores-v1.webp" },
  { id: "mobility-dead-hang", exerciseName: "Movilidad de hombro", variantName: "Suspensión pasiva", category: "mobility", primaryMuscleGroup: "hombros", secondaryMuscleGroups: ["espalda"], environments: ["full_gym", "basic_gym", "home"], metric: "seconds", defaultDose: "15–30 segundos", guide: "Cuelga con apoyo seguro y hombros relajados; usa una asistencia si la necesitas.", mediaUrl: "/library/exercises/movilidad-suspension-barra-v1.webp" }
];

export type MobilityRoutine = {
  id: string;
  name: string;
  purpose: string;
  durationMinutes: number;
  level: "beginner" | "intermediate";
  exerciseIds: string[];
};

export const MOBILITY_ROUTINES: MobilityRoutine[] = [
  { id: "mobility-reset-8", name: "Reset de movilidad · 8 min", purpose: "Desbloqueo general para empezar o cerrar el día", durationMinutes: 8, level: "beginner", exerciseIds: ["mobility-cat-cow", "mobility-90-90-switch", "mobility-open-book", "mobility-ankle-knee-wall"] },
  { id: "mobility-upper-12", name: "Hombros y espalda · 12 min", purpose: "Movilidad suave de cintura escapular y columna torácica", durationMinutes: 12, level: "beginner", exerciseIds: ["mobility-child-pose", "mobility-open-book", "mobility-wall-shoulder-flexion", "mobility-band-pass-through", "stretch-cross-body-shoulder"] },
  { id: "mobility-hips-15", name: "Cadera y tobillo · 15 min", purpose: "Rango controlado para sentadillas, zancadas y caminatas", durationMinutes: 15, level: "beginner", exerciseIds: ["mobility-90-90-switch", "mobility-half-kneeling-hip", "mobility-deep-squat-pry", "mobility-adductor-rockback", "mobility-ankle-knee-wall"] },
  { id: "stretch-lower-10", name: "Estiramientos de tren inferior · 10 min", purpose: "Vuelta a la calma después de piernas o cardio", durationMinutes: 10, level: "beginner", exerciseIds: ["stretch-hip-flexor", "stretch-quad-standing", "stretch-hamstring-standing", "stretch-glute-figure-four", "stretch-calf-wall"] },
  { id: "mobility-full-body-18", name: "Full-body dinámico · 18 min", purpose: "Secuencia completa de movilidad antes de entrenar", durationMinutes: 18, level: "intermediate", exerciseIds: ["mobility-cat-cow", "mobility-worlds-greatest", "mobility-deep-squat-pry", "mobility-quadruped-rotation", "mobility-wall-shoulder-flexion", "mobility-ankle-knee-wall"] },
  { id: "stretch-recovery-20", name: "Estiramiento tranquilo · 20 min", purpose: "Sesión de bienestar general con respiración pausada", durationMinutes: 20, level: "beginner", exerciseIds: ["mobility-child-pose", "stretch-pec-doorway", "stretch-lat-child-reach", "stretch-hip-flexor", "stretch-glute-figure-four", "stretch-wrist-flexor"] }
];

const byId = new Map(MOBILITY_EXERCISES.map((exercise) => [exercise.id, exercise]));
export function findMobilityExercise(id: string): MobilityExercise | undefined { return byId.get(id); }
export function exercisesForMobilityRoutine(routine: MobilityRoutine): MobilityExercise[] { return routine.exerciseIds.map(findMobilityExercise).filter((exercise): exercise is MobilityExercise => Boolean(exercise)); }
