import { and, desc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { activityMetric, enduranceActivity, performanceBaseline, recoverySession, sessionExercise, setPerformance, trainingPlan, workoutSession } from "@/lib/db/schema";
import { findVariant } from "@/features/catalog/data/exercise-catalog";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import type { Baseline } from "@/features/workouts/domain/progression";
import { createWorkoutTrainingEngineRepository } from "@/features/training-engine/domain/repository";
import { createRecoverySessionRepository } from "@/features/recovery/domain/recovery-session-repository";
import { computeAdherence, loadCategoryForPattern, type AdherenceCounts, type PlannedStrengthOccurrence } from "./history-engine";
import { isoDate, isoWeekStart, parseIsoDateLocal } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

type Db = PostgresJsDatabase<typeof schema>;
const FINISHED_STATUSES = ["completed", "adapted", "partial"] as const;

export type EnduranceActivityEntry = {
  id: string; sport: string; name: string; source: string; startedAt: Date;
  durationS: number | null; distanceM: number | null;
  metrics: Array<{ metricType: string; value: number; unit: string }>;
};

export type SessionHistoryEntry = {
  id: string; sessionIndex: number; status: string; startedAt: Date; endedAt: Date | null;
  globalEffort: number | null; comment: string | null; title: string; day: string; kind: "strength" | "endurance";
};

export type VariantProgressEntry = {
  variantId: string; exerciseName: string; variantName: string; hasBaseline: boolean; confidence: number;
  lastLoadKg: number | null; lastRepetitions: number | null; suggestionType: string; suggestionReason: string;
};

export type WeeklyLoad = { piernas: number; treSuperior: number; resistenciaMinutos: number };
export type WeekStats = { previstas: number; hechas: number; minutos: number; constancia: number };

export type SessionDetailExercise = {
  variantId: string; exerciseName: string; variantName: string;
  sets: Array<{ setNumber: number; loadKg: number | null; repetitions: number | null; difficulty: string | null }>;
};
export type SessionDetail = {
  id: string; status: string; startedAt: Date; endedAt: Date | null; globalEffort: number | null; comment: string | null;
  discomfort: { zone: string; intensity: string } | null; title: string; day: string; exercises: SessionDetailExercise[];
};

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Fase 3: lee y agrega datos ya persistidos por Fases 0-2 (plan, sesiones,
 * ajustes, baseline por variante) sin duplicar ninguna tabla ni reescribir
 * ningún estado. Nada aquí es fixture de interfaz.
 */
export function createHistoryRepository(database: Db) {
  const workoutRepo = createWorkoutSessionRepository(database);
  const engineRepo = createWorkoutTrainingEngineRepository(database);
  const recoveryRepo = createRecoverySessionRepository(database);

  async function loadPlan(ownerId: string, planId: string) {
    const plan = (await database.select().from(trainingPlan).where(and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId)))).at(0);
    if (!plan) return null;
    return { plan, proposal: JSON.parse(plan.contentJson) as PlanProposal };
  }

  return {
    listSessionHistory: async (ownerId: string, planId: string): Promise<SessionHistoryEntry[]> => {
      const loaded = await loadPlan(ownerId, planId);
      if (!loaded) return [];
      const rows = await workoutRepo.listSessionHistory(ownerId, planId);
      return rows.map((row) => {
        const planned = loaded.proposal.week?.sessions?.[row.sessionIndex];
        return { ...row, title: planned?.title ?? "Sesión", day: planned?.day ?? "", kind: (planned?.kind === "endurance" ? "endurance" : "strength") as "strength" | "endurance" };
      });
    },

    /** null cuando la cuenta no tiene el plan indicado (nunca inventa datos de otra cuenta). */
    computeAdherence: async (ownerId: string, planId: string, today: Date = new Date()): Promise<AdherenceCounts | null> => {
      const loaded = await loadPlan(ownerId, planId);
      if (!loaded) return null;

      const strengthSessions: PlannedStrengthOccurrence[] = (loaded.proposal.week?.sessions ?? [])
        .map((session, sessionIndex) => ({ session, sessionIndex }))
        .filter(({ session }) => session.kind === "strength" && (session.exercises?.length ?? 0) > 0)
        .map(({ session, sessionIndex }) => ({ sessionIndex, day: session.day }));

      const history = await workoutRepo.listSessionHistory(ownerId, planId);
      const recoveryForAdherence = await recoveryRepo.listCompletedForAdherence(ownerId, planId);
      const executed = history
        .filter((row) => (FINISHED_STATUSES as readonly string[]).includes(row.status))
        .map((row) => ({ sessionIndex: row.sessionIndex, isoWeekStart: isoWeekStart(row.startedAt), status: row.status as "completed" | "adapted" | "partial" }))
        // A completed recovery session counts as adherence for that occurrence too (Bloqueante 3), same
        // "adapted" bucket as a softened strength/endurance close — never strength volume or progression.
        // Tagged source: "recovery" so computeAdherence can also surface it as "recuperación válida"
        // (renderAdherencia, history.js) without double-counting it against completadas/adaptadas.
        .concat(recoveryForAdherence.map((row) => ({ ...row, source: "recovery" as const })));

      const adjustments = await engineRepo.listAdjustments(ownerId, planId);

      return computeAdherence(strengthSessions, loaded.plan.createdAt, today, executed, adjustments);
    },

    listVariantProgress: async (ownerId: string): Promise<VariantProgressEntry[]> =>
      (await database
        .select()
        .from(performanceBaseline)
        .where(eq(performanceBaseline.ownerId, ownerId)))
        .map((row) => {
          const variant = findVariant(row.variantId);
          const baseline = JSON.parse(row.summaryJson) as Baseline;
          return {
            variantId: row.variantId,
            exerciseName: variant?.exerciseName ?? row.variantId,
            variantName: variant?.variantName ?? "",
            hasBaseline: baseline.hasBaseline,
            confidence: row.confidence ?? 0,
            lastLoadKg: baseline.lastLoadKg,
            lastRepetitions: baseline.lastRepetitions,
            suggestionType: baseline.suggestion.type,
            suggestionReason: baseline.suggestion.reason
          };
        })
        .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName)),

    /** Series de fuerza + minutos de resistencia (Fase 4: endurance_activity ya es una fuente real) completados en la semana ISO indicada. */
    computeWeeklyLoad: async (ownerId: string, weekStartIso: string): Promise<WeeklyLoad> => {
      const weekStart = parseIsoDateLocal(weekStartIso);
      const weekEnd = addDays(weekStart, 7);
      const rows = await database
        .select({ variantId: sessionExercise.variantId, startedAt: workoutSession.startedAt })
        .from(setPerformance)
        .innerJoin(sessionExercise, eq(setPerformance.sessionExerciseId, sessionExercise.id))
        .innerJoin(workoutSession, eq(sessionExercise.workoutSessionId, workoutSession.id))
        .where(and(eq(workoutSession.ownerId, ownerId), inArray(workoutSession.status, FINISHED_STATUSES)));

      const load: WeeklyLoad = { piernas: 0, treSuperior: 0, resistenciaMinutos: 0 };
      for (const row of rows) {
        if (row.startedAt < weekStart || row.startedAt >= weekEnd) continue;
        const variant = findVariant(row.variantId);
        if (!variant) continue;
        if (loadCategoryForPattern(variant.movementPattern) === "piernas") load.piernas += 1;
        else load.treSuperior += 1;
      }

      const activities = await database.select({ startedAt: enduranceActivity.startedAt, durationS: enduranceActivity.durationS }).from(enduranceActivity).where(eq(enduranceActivity.ownerId, ownerId));
      for (const activity of activities) {
        if (activity.startedAt < weekStart || activity.startedAt >= weekEnd || activity.durationS == null) continue;
        load.resistenciaMinutos += Math.round(activity.durationS / 60);
      }
      return load;
    },

    /** Todas las actividades de resistencia (manuales o importadas) de la cuenta, más recientes primero. Owner-scoped. */
    listEnduranceActivities: async (ownerId: string): Promise<EnduranceActivityEntry[]> => {
      const rows = await database
        .select()
        .from(enduranceActivity)
        .where(eq(enduranceActivity.ownerId, ownerId))
        .orderBy(desc(enduranceActivity.startedAt));
      const metricRows = rows.length === 0 ? [] : await database
        .select({ activityId: activityMetric.activityId, metricType: activityMetric.metricType, value: activityMetric.value, unit: activityMetric.unit })
        .from(activityMetric)
        .where(inArray(activityMetric.activityId, rows.map((row) => row.id)));
      const metricsByActivity = new Map<string, typeof metricRows>();
      for (const metric of metricRows) metricsByActivity.set(metric.activityId, [...(metricsByActivity.get(metric.activityId) ?? []), metric]);
      return rows.map((row) => ({
        id: row.id, sport: row.sport, name: row.name, source: row.source, startedAt: row.startedAt, durationS: row.durationS, distanceM: row.distanceM,
        metrics: (metricsByActivity.get(row.id) ?? []).map(({ metricType, value, unit }) => ({ metricType, value, unit }))
      }));
    },

    /**
     * "Tu semana" (renderAdherencia, history.js): sesiones hechas/previstas, minutos activos y semanas de
     * constancia — leído de workout_session + recovery_session + endurance_activity reales, nunca de un
     * fixture. "constancia" cuenta semanas consecutivas (desde la actual, hacia atrás hasta el inicio del
     * plan) con al menos una ocurrencia hecha; se corta en la primera semana vacía.
     */
    computeWeekStats: async (ownerId: string, planId: string, today: Date = new Date()): Promise<WeekStats | null> => {
      const loaded = await loadPlan(ownerId, planId);
      if (!loaded) return null;
      const previstas = loaded.proposal.week?.sessions?.length ?? 0;

      const sessionRows = await database
        .select({ startedAt: workoutSession.startedAt, endedAt: workoutSession.endedAt })
        .from(workoutSession)
        .where(and(eq(workoutSession.ownerId, ownerId), eq(workoutSession.planId, planId), inArray(workoutSession.status, FINISHED_STATUSES)));
      const recoveryRows = await database
        .select({ startedAt: recoverySession.startedAt, endedAt: recoverySession.endedAt })
        .from(recoverySession)
        .where(and(eq(recoverySession.ownerId, ownerId), eq(recoverySession.planId, planId), eq(recoverySession.status, "completed")));
      const activityRows = await database
        .select({ startedAt: enduranceActivity.startedAt, durationS: enduranceActivity.durationS })
        .from(enduranceActivity)
        .where(eq(enduranceActivity.ownerId, ownerId));

      function statsForWeek(weekIso: string): { hechas: number; minutos: number } {
        let hechas = 0;
        let minutos = 0;
        for (const row of [...sessionRows, ...recoveryRows]) {
          if (isoWeekStart(row.startedAt) !== weekIso) continue;
          hechas += 1;
          if (row.endedAt) minutos += Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 60000);
        }
        for (const row of activityRows) {
          if (isoWeekStart(row.startedAt) !== weekIso) continue;
          hechas += 1;
          if (row.durationS != null) minutos += Math.round(row.durationS / 60);
        }
        return { hechas, minutos };
      }

      const currentWeekIso = isoWeekStart(today);
      const current = statsForWeek(currentWeekIso);

      let constancia = 0;
      let cursor = parseIsoDateLocal(currentWeekIso);
      const planStart = parseIsoDateLocal(isoWeekStart(loaded.plan.createdAt));
      while (cursor >= planStart) {
        if (statsForWeek(isoDate(cursor)).hechas === 0) break;
        constancia += 1;
        cursor = addDays(cursor, -7);
      }

      return { previstas, hechas: current.hechas, minutos: current.minutos, constancia };
    },

    /** Detalle completo de una sesión de fuerza (ejercicios, series, molestia declarada al cerrar) para /historial/[id]. Owner+plan-scoped; null si no existe. */
    getSessionDetail: async (ownerId: string, planId: string, sessionId: string): Promise<SessionDetail | null> => {
      const loaded = await loadPlan(ownerId, planId);
      if (!loaded) return null;
      const session = (await database
        .select()
        .from(workoutSession)
        .where(and(eq(workoutSession.id, sessionId), eq(workoutSession.ownerId, ownerId), eq(workoutSession.planId, planId))))
        .at(0);
      if (!session) return null;

      const planned = loaded.proposal.week?.sessions?.[session.sessionIndex];
      const exerciseRows = await database
        .select()
        .from(sessionExercise)
        .where(and(eq(sessionExercise.workoutSessionId, session.id), eq(sessionExercise.status, "active")))
        .orderBy(sessionExercise.position);
      const setRows = exerciseRows.length === 0 ? [] : await database
        .select()
        .from(setPerformance)
        .where(inArray(setPerformance.sessionExerciseId, exerciseRows.map((row) => row.id)))
        .orderBy(setPerformance.setNumber);
      const setsByExercise = new Map<string, typeof setRows>();
      for (const set of setRows) setsByExercise.set(set.sessionExerciseId, [...(setsByExercise.get(set.sessionExerciseId) ?? []), set]);
      const exercises = exerciseRows.map((exercise) => {
        const variant = findVariant(exercise.variantId);
        return {
          variantId: exercise.variantId,
          exerciseName: variant?.exerciseName ?? exercise.variantId,
          variantName: variant?.variantName ?? "",
          sets: (setsByExercise.get(exercise.id) ?? []).map((set) => ({ setNumber: set.setNumber, loadKg: set.loadKg, repetitions: set.repetitions, difficulty: set.difficulty }))
        };
      });

      const discomfort = session.discomfortJson ? (JSON.parse(session.discomfortJson) as { zone: string; intensity: string }) : null;
      return {
        id: session.id, status: session.status, startedAt: session.startedAt, endedAt: session.endedAt,
        globalEffort: session.globalEffort, comment: session.comment, discomfort,
        title: planned?.title ?? "Sesión", day: planned?.day ?? "", exercises
      };
    },

    /** Detalle de una actividad de resistencia importada o manual para /historial/[id]. Owner-scoped; null si no existe. */
    getEnduranceActivityDetail: async (ownerId: string, activityId: string): Promise<EnduranceActivityEntry | null> => {
      const row = (await database.select().from(enduranceActivity).where(and(eq(enduranceActivity.id, activityId), eq(enduranceActivity.ownerId, ownerId)))).at(0);
      if (!row) return null;
      return {
        id: row.id, sport: row.sport, name: row.name, source: row.source, startedAt: row.startedAt, durationS: row.durationS, distanceM: row.distanceM,
        metrics: await database.select({ metricType: activityMetric.metricType, value: activityMetric.value, unit: activityMetric.unit }).from(activityMetric).where(eq(activityMetric.activityId, row.id))
      };
    }
  };
}
