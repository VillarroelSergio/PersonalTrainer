import type {
  DiscomfortIntensity,
  DiscomfortKind,
  DiscomfortSide,
  DiscomfortZone,
  EnduranceKind,
  EnvironmentKind,
  EquipmentCategory,
  Experience,
  Goal,
  MuscleFocus,
  Weekday
} from "./types";

export const GOAL_OPTIONS: Array<{ value: Goal; label: string }> = [
  { value: "muscle_gain", label: "Ganar músculo" },
  { value: "strength", label: "Ganar fuerza" },
  { value: "fat_loss", label: "Quemar grasa" },
  { value: "endurance", label: "Mejorar rendimiento exterior" },
  { value: "active_lifestyle", label: "Mantenerse activo" }
];

export const EXPERIENCE_OPTIONS: Array<{ value: Experience; label: string }> = [
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedia" },
  { value: "advanced", label: "Avanzada" }
];

export const WEEKDAY_OPTIONS: Array<{ value: Weekday; label: string; short: string }> = [
  { value: "monday", label: "Lunes", short: "L" },
  { value: "tuesday", label: "Martes", short: "M" },
  { value: "wednesday", label: "Miércoles", short: "X" },
  { value: "thursday", label: "Jueves", short: "J" },
  { value: "friday", label: "Viernes", short: "V" },
  { value: "saturday", label: "Sábado", short: "S" },
  { value: "sunday", label: "Domingo", short: "D" }
];

export const ENDURANCE_KIND_OPTIONS: Array<{ value: EnduranceKind; label: string }> = [
  { value: "running", label: "Correr" },
  { value: "cycling", label: "Ciclismo" },
  { value: "walking", label: "Caminar" }
];

export const DURATION_OPTIONS: Array<{ value: 20 | 40 | 60 | 90; label: string }> = [
  { value: 20, label: "20 min" },
  { value: 40, label: "40 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" }
];

export const ENVIRONMENT_OPTIONS: Array<{ value: EnvironmentKind; label: string }> = [
  { value: "full_gym", label: "Gimnasio completo" },
  { value: "basic_gym", label: "Gimnasio básico" },
  { value: "home", label: "Casa" },
  { value: "outdoors", label: "Exterior" }
];

export const EQUIPMENT_OPTIONS: Array<{ value: EquipmentCategory; label: string }> = [
  { value: "free_weights", label: "Pesas y barras" },
  { value: "benches_supports", label: "Bancos y soportes" },
  { value: "racks_smith", label: "Rack y multipower" },
  { value: "cables_torso", label: "Poleas y torso" },
  { value: "leg_machines", label: "Máquinas de pierna" },
  { value: "bodyweight_accessories", label: "Peso corporal y accesorios" },
  { value: "pullup_dip_station", label: "Dominadas y fondos" },
  { value: "resistance_bands", label: "Bandas elasticas" },
  { value: "indoor_cardio", label: "Cardio interior" }
];

export const EQUIPMENT_IMAGE: Record<EquipmentCategory, string> = {
  free_weights: "/library/exercises/press-banca-mancuernas-v3.webp",
  benches_supports: "/library/exercises/press-banca-barra-v2.webp",
  racks_smith: "/library/exercises/sentadilla-barra-v2.webp",
  cables_torso: "/library/exercises/jalon-polea-agarre-ancho-v2.webp",
  leg_machines: "/library/exercises/elevacion-gemelo-maquina-v2.webp",
  pullup_dip_station: "/library/exercises/dominada-asistida-v3.webp",
  resistance_bands: "/library/exercises/plancha-v3.webp",
  bodyweight_accessories: "/library/exercises/plancha-v3.webp",
  indoor_cardio: "/library/exercises/sentadilla-goblet-v3.webp"
};

// Matriz de preselección confirmada por docs/CODEX-ONBOARDING-INTEGRATION-PROMPT.md
// (tabla "Aplicar la matriz de equipamiento inicial"). Sustituye el mapeo
// provisional anterior, marcado como pendiente en CLAUDE-ONBOARDING-NOTES.md.
export const ENVIRONMENT_COMPATIBLE_EQUIPMENT: Record<EnvironmentKind, EquipmentCategory[]> = {
  full_gym: ["free_weights", "benches_supports", "racks_smith", "cables_torso", "leg_machines", "pullup_dip_station", "resistance_bands", "bodyweight_accessories", "indoor_cardio"],
  basic_gym: ["free_weights", "benches_supports", "racks_smith", "cables_torso", "leg_machines", "pullup_dip_station", "resistance_bands", "indoor_cardio"],
  home: ["free_weights", "benches_supports", "pullup_dip_station", "resistance_bands", "bodyweight_accessories"],
  outdoors: []
};

export const MUSCLE_FOCUS_OPTIONS: Array<{ value: MuscleFocus; label: string }> = [
  { value: "upper_body", label: "Pecho" },
  { value: "lower_body", label: "Brazos" },
  { value: "push", label: "Piernas" },
  { value: "pull", label: "Tracción" },
  { value: "full_body", label: "Espalda" }
];

export const DISCOMFORT_ZONE_OPTIONS: Array<{ value: DiscomfortZone; label: string; top: number; left: number }> = [
  { value: "neck", label: "Cuello", top: 10, left: 50 },
  { value: "shoulder", label: "Hombro", top: 20, left: 28 },
  { value: "back", label: "Espalda", top: 32, left: 50 },
  { value: "elbow", label: "Codo", top: 42, left: 20 },
  { value: "wrist", label: "Muñeca", top: 54, left: 15 },
  { value: "hip", label: "Cadera", top: 55, left: 50 },
  { value: "knee", label: "Rodilla", top: 75, left: 43 },
  { value: "ankle", label: "Tobillo", top: 93, left: 43 }
];

export const DISCOMFORT_SIDE_OPTIONS: Array<{ value: DiscomfortSide; label: string }> = [
  { value: "left", label: "Izquierda" },
  { value: "right", label: "Derecha" },
  { value: "center", label: "Centro" }
];

export const DISCOMFORT_INTENSITY_OPTIONS: Array<{ value: DiscomfortIntensity; label: string }> = [
  { value: "mild", label: "Leve" },
  { value: "moderate", label: "Moderada" },
  { value: "important", label: "Importante" }
];

export const DISCOMFORT_KIND_OPTIONS: Array<{ value: DiscomfortKind; label: string }> = [
  { value: "pain", label: "Dolor" },
  { value: "stiffness", label: "Rigidez" },
  { value: "fatigue", label: "Fatiga" }
];

export const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function range(from: number, to: number): number[] {
  const values: number[] = [];
  for (let value = from; value <= to; value += 1) values.push(value);
  return values;
}
