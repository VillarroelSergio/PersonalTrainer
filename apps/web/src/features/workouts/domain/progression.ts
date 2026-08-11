export type SetDifficulty = "too_easy" | "just_right" | "too_hard";
export type SessionCloseStatus = "completed" | "adapted" | "partial";

export type ExposureSet = { loadKg: number | null; repetitions: number | null; difficulty: SetDifficulty | null };
export type Exposure = { targetSets: number; targetRepsMin: number; targetRepsMax: number; sessionStatus: SessionCloseStatus; sets: ExposureSet[] };

export type ProgressionSuggestion =
  | { type: "calibrate"; reason: string }
  | { type: "maintain"; reason: string }
  | { type: "increase_reps"; repetitions: number; reason: string }
  | { type: "increase_load"; loadKg: number; reason: string };

export type Baseline = {
  ruleVersion: "progression-v1";
  confidence: number;
  hasBaseline: boolean;
  lastLoadKg: number | null;
  lastRepetitions: number | null;
  suggestion: ProgressionSuggestion;
};

const MIN_LOAD_INCREMENT_KG = 2.5;
const MIN_COMPARABLE_EXPOSURES = 2;

/**
 * Doble progresión conservadora v1: nunca aplica el cambio, solo lo propone.
 * Sin historial → calibrar. Cierre parcial o cualquier serie "demasiado
 * dura" en la última exposición → mantener. Series objetivo completas con
 * dificultad adecuada en al menos dos exposiciones comparables (mismo rango
 * de repeticiones objetivo) → proponer una repetición más dentro de rango,
 * o el incremento mínimo de carga disponible al alcanzar el techo del rango.
 */
export function computeBaseline(exposures: Exposure[]): Baseline {
  const observationsCount = exposures.length;
  const confidence = Math.min(1, 0.3 * observationsCount);

  if (observationsCount === 0) {
    return { ruleVersion: "progression-v1", confidence: 0, hasBaseline: false, lastLoadKg: null, lastRepetitions: null, suggestion: { type: "calibrate", reason: "Sin historial todavía: calibra dentro del rango objetivo y registra el resultado real." } };
  }

  const last = exposures[exposures.length - 1];
  const lastLoadKg = lastNonNull(last.sets.map((set) => set.loadKg));
  const lastRepetitions = lastNonNull(last.sets.map((set) => set.repetitions));
  const base = { ruleVersion: "progression-v1" as const, confidence, hasBaseline: true, lastLoadKg, lastRepetitions };

  const anyTooHard = last.sets.some((set) => set.difficulty === "too_hard");
  if (last.sessionStatus !== "completed" || anyTooHard) {
    return { ...base, suggestion: { type: "maintain", reason: last.sessionStatus !== "completed" ? "La última exposición quedó parcial o adaptada: mantén la sugerencia actual." : "Alguna serie se sintió demasiado dura: mantén la carga y las repeticiones." } };
  }

  const comparable = exposures.filter((exposure) => exposure.targetRepsMin === last.targetRepsMin && exposure.targetRepsMax === last.targetRepsMax).slice(-MIN_COMPARABLE_EXPOSURES);
  const allComparableAdequate = comparable.length >= MIN_COMPARABLE_EXPOSURES && comparable.every((exposure) => exposure.sets.length >= exposure.targetSets && exposure.sets.every((set) => set.difficulty !== "too_hard"));

  if (!allComparableAdequate) {
    return { ...base, suggestion: { type: "maintain", reason: "Todavía no hay suficientes exposiciones comparables con dificultad adecuada para proponer un cambio." } };
  }

  if (lastRepetitions !== null && lastRepetitions < last.targetRepsMax) {
    return { ...base, suggestion: { type: "increase_reps", repetitions: lastRepetitions + 1, reason: "Series completas con dificultad adecuada: se propone una repetición más dentro del rango." } };
  }

  if (lastLoadKg !== null) {
    return { ...base, suggestion: { type: "increase_load", loadKg: lastLoadKg + MIN_LOAD_INCREMENT_KG, reason: "Se alcanzó el techo del rango de repeticiones con dificultad adecuada: se propone el incremento mínimo de carga." } };
  }

  return { ...base, suggestion: { type: "maintain", reason: "No hay carga registrada para proponer un incremento; mantén las repeticiones actuales." } };
}

function lastNonNull(values: Array<number | null>): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) return values[index];
  }
  return null;
}
