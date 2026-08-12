import { WEEKDAYS, isoDate, isoWeekStart, parseIsoDateLocal, type Weekday } from "@/lib/weekdays";
import type { MovementPattern } from "@/features/catalog/data/exercise-catalog";
import type { SessionCloseStatus } from "@/features/workouts/domain/progression";

/**
 * Adherencia real, derivada del plan semanal + las sesiones realmente
 * registradas + los ajustes aceptados — nunca de un fixture de interfaz.
 * "previstas" solo cuenta ocurrencias cuyo día ya llegó (no adelanta la
 * semana en curso). Una ocurrencia sin ejecución y sin ajuste de tipo
 * "reschedule" se cuenta como omitida; esto incluye deliberadamente las
 * conversiones a "recovery" (Fase 2 no genera un registro de sesión real
 * para esa versión suave todavía — deuda declarada, no un error de cómputo).
 */
export type AdherenceCounts = { previstas: number; completadas: number; adaptadas: number; parciales: number; omitidas: number; recolocadas: number; recuperacionValida: number };

export type PlannedStrengthOccurrence = { sessionIndex: number; day: Weekday };
/** `source: "recovery"` marks an occurrence closed via a recovery session (never strength volume) so the presentation layer can show "recuperación válida" as the subset of completadas/adaptadas it already is — never counted twice. */
export type ExecutedOccurrence = { sessionIndex: number; isoWeekStart: string; status: SessionCloseStatus; source?: "recovery" };
export type AdjustmentOccurrence = { sessionIndex: number; isoWeekStart: string; kind: string };

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
function midnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function computeAdherence(plannedSessions: PlannedStrengthOccurrence[], planStartedAt: Date, today: Date, executed: ExecutedOccurrence[], adjustments: AdjustmentOccurrence[]): AdherenceCounts {
  const counts: AdherenceCounts = { previstas: 0, completadas: 0, adaptadas: 0, parciales: 0, omitidas: 0, recolocadas: 0, recuperacionValida: 0 };
  if (plannedSessions.length === 0) return counts;

  const todayMidnight = midnight(today);
  let weekStart = parseIsoDateLocal(isoWeekStart(planStartedAt));
  const lastWeekStart = parseIsoDateLocal(isoWeekStart(today));

  while (weekStart <= lastWeekStart) {
    const weekStartIso = isoDate(weekStart);
    for (const planned of plannedSessions) {
      const plannedDate = addDays(weekStart, WEEKDAYS.indexOf(planned.day));
      if (plannedDate > todayMidnight) continue;

      counts.previstas += 1;
      const execution = executed.find((row) => row.sessionIndex === planned.sessionIndex && row.isoWeekStart === weekStartIso);
      if (execution) {
        if (execution.status === "completed") counts.completadas += 1;
        else if (execution.status === "adapted") counts.adaptadas += 1;
        else counts.parciales += 1;
        if (execution.source === "recovery") counts.recuperacionValida += 1;
        continue;
      }

      const adjustment = adjustments.find((row) => row.sessionIndex === planned.sessionIndex && row.isoWeekStart === weekStartIso);
      if (adjustment?.kind === "reschedule") counts.recolocadas += 1;
      else counts.omitidas += 1;
    }
    weekStart = addDays(weekStart, 7);
  }

  return counts;
}

/** Piernas = squat/hinge/lunge (mismo criterio que el guardarraíl de Fase 2); el resto de patrones de fuerza cuenta como tren superior. Resistencia no tiene fuente de datos todavía (Fase 4): se declara "sin datos suficientes" en la capa de presentación, no aquí. */
const LEG_PATTERNS = new Set<MovementPattern>(["squat", "hinge", "lunge"]);
export function loadCategoryForPattern(pattern: MovementPattern): "piernas" | "tren_superior" {
  return LEG_PATTERNS.has(pattern) ? "piernas" : "tren_superior";
}

export type Achievement = { threshold: number; label: string };
const ACHIEVEMENT_THRESHOLDS = [1, 5, 10, 25, 50, 100];

/**
 * Hitos privados y discretos: solo cuentan sesiones que suman adherencia
 * (completadas + adaptadas) del propio historial, nunca calorías, peso ni
 * comparación con otras personas. Sin ranking.
 */
export function pickAchievements(totalAdherencia: number): { alcanzado: Achievement | null; cercano: Achievement | null } {
  let alcanzado: Achievement | null = null;
  let cercano: Achievement | null = null;
  for (const threshold of ACHIEVEMENT_THRESHOLDS) {
    if (totalAdherencia >= threshold) alcanzado = { threshold, label: `${threshold} ${threshold === 1 ? "sesión suma" : "sesiones suman"} tu adherencia` };
    else if (!cercano) cercano = { threshold, label: `A ${threshold - totalAdherencia} ${threshold - totalAdherencia === 1 ? "sesión" : "sesiones"} de llegar a ${threshold}` };
  }
  return { alcanzado, cercano };
}

export type MetricEntry = { value: number; unit: string; measuredAt: string };
export type MetricTrend = { diff: number; text: string };

/** Tendencia simple entre el primer y el último registro del mismo tipo+zona. Informativa y privada, nunca un objetivo ni una meta. */
export function computeMetricTrend(entries: MetricEntry[]): MetricTrend | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => (a.measuredAt < b.measuredAt ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const diff = Math.round((last.value - first.value) * 100) / 100;
  const sign = diff > 0 ? "+" : "";
  return { diff, text: `${sign}${diff} ${last.unit} desde tu primer registro (${first.measuredAt} → ${last.measuredAt}). Tendencia informativa y privada, no un objetivo.` };
}
