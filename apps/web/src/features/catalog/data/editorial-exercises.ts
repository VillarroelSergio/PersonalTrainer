import { trackingModeForEquipment, type EquipmentCapability, type EquipmentRequirement, type EditorialVariant, type TargetContribution } from "@/features/catalog/domain/editorial-content";
import type { EnvironmentKind, EquipmentCategory, MovementPattern, MuscleGroup } from "@/features/catalog/data/exercise-catalog";
import { CATALOG_EXPANSION_V3 } from "@/features/catalog/data/editorial-exercises-v3";

/** Deriva un requirement estructurado desde la categoría plana original del catálogo. */
function requirementFor(equipment: EquipmentCategory | "bodyweight"): EquipmentRequirement {
  const capability: EquipmentCapability = equipment === "bodyweight" ? "no_equipment" : equipment;
  return { anyOf: [capability] };
}

function targetsFor(primary: MuscleGroup, secondary?: MuscleGroup[]): TargetContribution[] {
  return [
    { muscleGroup: primary, role: "primary" },
    ...(secondary ?? []).map((muscleGroup): TargetContribution => ({ muscleGroup, role: "secondary" }))
  ];
}

const SPECIFIC_EQUIPMENT: Partial<Record<string, EquipmentCategory>> = {
  "hinge-band": "resistance_bands",
  "pull-h-band-row": "resistance_bands",
  "pull-v-pullup-bar": "pullup_dip_station",
  "pull-v-assisted-machine": "pullup_dip_station",
  "squat-smith": "racks_smith",
  "pullup-neutral": "pullup_dip_station",
  "chinup-bodyweight": "pullup_dip_station",
  "australian-row": "pullup_dip_station",
  "band-pull-apart": "resistance_bands",
  "band-lateral-walk": "resistance_bands",
  "dip-machine": "pullup_dip_station",
  "extension-triceps-dip-machine": "pullup_dip_station"
};

type Seed = {
  id: string;
  exerciseName: string;
  variantName: string;
  movementPattern: MovementPattern;
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups?: MuscleGroup[];
  equipment: EquipmentCategory | "bodyweight";
  environments: EnvironmentKind[];
  loadType: "external" | "bodyweight";
  guide: string;
  mediaUrl?: string;
};

/**
 * Semilla editorial (Task 1): reexpresa las variantes del catálogo original
 * (mismos IDs, nombres, patrones, grupos musculares, entornos, guías y media)
 * con requisitos de equipamiento estructurados en vez de una categoría plana.
 * Ampliar aquí, nunca inventar contenido en tiempo de ejecución.
 */
const SEEDS: Seed[] = [
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

const GYM_EXPANSION: Seed[] = [
  { id: "leg-press", exerciseName: "Prensa de piernas", variantName: "Prensa a 45 grados", movementPattern: "squat", primaryMuscleGroup: "cuadriceps", secondaryMuscleGroups: ["isquios_gluteos"], equipment: "leg_machines", environments: ["full_gym"], loadType: "external", guide: "Apoya toda la espalda, baja con control y empuja sin bloquear las rodillas." },
  { id: "hack-squat-machine", exerciseName: "Sentadilla", variantName: "Hack squat en máquina", movementPattern: "squat", primaryMuscleGroup: "cuadriceps", secondaryMuscleGroups: ["isquios_gluteos"], equipment: "leg_machines", environments: ["full_gym"], loadType: "external", guide: "Mantén la espalda apoyada y desciende solo mientras controles la posición." },
  { id: "leg-extension-machine", exerciseName: "Extensión de piernas", variantName: "Máquina de cuádriceps", movementPattern: "squat", primaryMuscleGroup: "cuadriceps", equipment: "leg_machines", environments: ["full_gym"], loadType: "external", guide: "Ajusta el eje a la rodilla y eleva con un movimiento controlado." },
  { id: "leg-curl-machine", exerciseName: "Curl femoral", variantName: "Máquina tumbado", movementPattern: "hinge", primaryMuscleGroup: "isquios_gluteos", equipment: "leg_machines", environments: ["full_gym"], loadType: "external", guide: "Mantén las caderas apoyadas y flexiona las rodillas sin impulso." },
  { id: "hip-thrust-barbell", exerciseName: "Hip thrust", variantName: "Hip thrust con barra", movementPattern: "hinge", primaryMuscleGroup: "isquios_gluteos", secondaryMuscleGroups: ["cuadriceps"], equipment: "benches_supports", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Apoya la parte alta de la espalda en el banco y eleva la cadera con control." },
  { id: "deadlift-conventional", exerciseName: "Peso muerto", variantName: "Peso muerto convencional con barra", movementPattern: "hinge", primaryMuscleGroup: "isquios_gluteos", secondaryMuscleGroups: ["espalda"], equipment: "free_weights", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Barra cerca de las piernas, empuja el suelo y mantén el torso firme." },
  { id: "lunge-bulgarian-dumbbell", exerciseName: "Zancada", variantName: "Zancada búlgara con mancuernas", movementPattern: "lunge", primaryMuscleGroup: "cuadriceps", secondaryMuscleGroups: ["isquios_gluteos"], equipment: "benches_supports", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Eleva el pie trasero, baja de forma vertical y empuja desde el pie delantero." },
  { id: "push-h-incline-dumbbell", exerciseName: "Press horizontal", variantName: "Press inclinado con mancuernas", movementPattern: "push_horizontal", primaryMuscleGroup: "pecho", secondaryMuscleGroups: ["hombros", "triceps"], equipment: "benches_supports", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Ajusta una inclinación moderada y baja las mancuernas con los codos controlados." },
  { id: "push-h-chest-machine", exerciseName: "Press horizontal", variantName: "Press de pecho en máquina", movementPattern: "push_horizontal", primaryMuscleGroup: "pecho", secondaryMuscleGroups: ["triceps"], equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Ajusta el asiento para que las asas queden a la altura del pecho y empuja suave." },
  { id: "push-h-cable-fly", exerciseName: "Apertura de pecho", variantName: "Apertura en polea", movementPattern: "push_horizontal", primaryMuscleGroup: "pecho", secondaryMuscleGroups: ["hombros"], equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Da un paso estable, junta las manos delante del pecho y vuelve lentamente." },
  { id: "push-v-barbell", exerciseName: "Press vertical", variantName: "Press militar con barra", movementPattern: "push_vertical", primaryMuscleGroup: "hombros", secondaryMuscleGroups: ["triceps"], equipment: "free_weights", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Aprieta el abdomen y empuja la barra sobre la línea de hombros." },
  { id: "pull-h-barbell-row", exerciseName: "Remo horizontal", variantName: "Remo con barra", movementPattern: "pull_horizontal", primaryMuscleGroup: "espalda", secondaryMuscleGroups: ["biceps"], equipment: "free_weights", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Inclina el torso con estabilidad y lleva la barra hacia la parte baja del abdomen." },
  { id: "pull-h-machine-row", exerciseName: "Remo horizontal", variantName: "Remo en máquina con apoyo", movementPattern: "pull_horizontal", primaryMuscleGroup: "espalda", secondaryMuscleGroups: ["biceps"], equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Mantén el pecho apoyado y lleva los codos hacia atrás sin encoger los hombros.", mediaUrl: "/library/exercises/remo-sentado-maquina-v2.webp" },
  { id: "pull-v-assisted-machine", exerciseName: "Jalón vertical", variantName: "Dominada asistida en máquina", movementPattern: "pull_vertical", primaryMuscleGroup: "espalda", secondaryMuscleGroups: ["biceps"], equipment: "bodyweight_accessories", environments: ["full_gym"], loadType: "bodyweight", guide: "Elige una asistencia manejable y sube con el pecho orientado hacia la barra.", mediaUrl: "/library/exercises/dominada-asistida-v3.webp" },
  { id: "pull-v-neutral-pulldown", exerciseName: "Jalón vertical", variantName: "Jalón neutro en polea", movementPattern: "pull_vertical", primaryMuscleGroup: "espalda", secondaryMuscleGroups: ["biceps"], equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Agarra las asas neutras y llévalas al pecho manteniendo el torso estable." },
  { id: "core-cable-crunch", exerciseName: "Flexión de core", variantName: "Crunch en polea", movementPattern: "core", primaryMuscleGroup: "core", equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Arrodíllate con la cuerda junto a la frente y flexiona el tronco de forma controlada." },
  { id: "core-hanging-knee-raise", exerciseName: "Flexión de core", variantName: "Elevación de rodillas colgado", movementPattern: "core", primaryMuscleGroup: "core", equipment: "bodyweight_accessories", environments: ["full_gym", "basic_gym"], loadType: "bodyweight", guide: "Cuelga con los hombros estables y eleva las rodillas sin balancearte." },
  { id: "curl-biceps-cable", exerciseName: "Curl de bíceps", variantName: "Polea baja con barra", movementPattern: "elbow_flexion", primaryMuscleGroup: "biceps", equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Mantén los codos cerca del cuerpo y evita mover los hombros al subir." },
  { id: "extension-triceps-bar", exerciseName: "Extensión de tríceps", variantName: "Polea con barra recta", movementPattern: "elbow_extension", primaryMuscleGroup: "triceps", equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Fija los codos junto al torso y extiende sin inclinar el cuerpo hacia delante." },
  { id: "calf-raise-dumbbell", exerciseName: "Elevación de gemelo", variantName: "De pie con mancuernas", movementPattern: "plantarflexion", primaryMuscleGroup: "gemelos", equipment: "free_weights", environments: ["full_gym", "basic_gym"], loadType: "external", guide: "Sujeta las mancuernas a los lados y realiza un recorrido lento y completo." },
  { id: "face-pull-cable", exerciseName: "Tracción horizontal", variantName: "Face pull con cuerda", movementPattern: "pull_horizontal", primaryMuscleGroup: "hombros", secondaryMuscleGroups: ["espalda"], equipment: "cables_torso", environments: ["full_gym"], loadType: "external", guide: "Tira de la cuerda hacia la cara con los codos altos y sin arquear la espalda." }
];

export const EDITORIAL_VARIANTS: EditorialVariant[] = [...SEEDS, ...GYM_EXPANSION, ...CATALOG_EXPANSION_V3].map((seed) => {
  const equipment = SPECIFIC_EQUIPMENT[seed.id] ?? seed.equipment;
  return {
    id: seed.id,
    exerciseName: seed.exerciseName,
    variantName: seed.variantName,
    movementPattern: seed.movementPattern,
    targets: targetsFor(seed.primaryMuscleGroup, seed.secondaryMuscleGroups),
    requirements: requirementFor(equipment),
    environments: seed.environments,
    loadType: seed.loadType,
    trackingMode: trackingModeForEquipment(equipment),
    guide: seed.guide,
    mediaUrl: seed.mediaUrl,
    active: true
  };
});
