/**
 * Pure, snapshot-driven view model for "/historial" and "/historial/[id]" (Fase 5, Task 6).
 * Mirrors each `history-repository.ts` method the pages call, reading from `snapshot.data`
 * instead of the DB. `computeAdherence` (history-engine.ts) is reused as-is — it was already a
 * pure function; only its raw inputs are now assembled from the snapshot.
 *
 * Plan-scoping matters here: `listSessionHistoryView`, `computeAdherenceView` and
 * `computeWeekStatsView` (the workout_session/recovery_session half) are scoped to
 * `planId`, exactly like the DB queries they mirror. `listVariantProgressView` and
 * `listEnduranceActivitiesView` are account-wide — no planId filter at all — and
 * `computeWeekStatsView`'s endurance-activity contribution is ALSO account-wide (the real
 * `computeWeekStats` never filters `endurance_activity` by planId either): this is not a bug,
 * it mirrors `history-repository.ts` exactly.
 */

import { findVariant } from "@/features/catalog/data/exercise-catalog";
import type { Baseline } from "@/features/workouts/domain/progression";
import { computeAdherence, type AdherenceCounts, type AdjustmentOccurrence, type ExecutedOccurrence, type PlannedStrengthOccurrence } from "./history-engine";
import type { EnduranceActivityEntry, SessionDetail, SessionDetailExercise, SessionHistoryEntry, VariantProgressEntry, WeekStats } from "./history-repository";
import { isoDate, isoWeekStart, parseIsoDateLocal, type Weekday } from "@/lib/weekdays";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import type { PlanProposal } from "@/contracts/onboarding";

const FINISHED_STATUSES = new Set(["completed", "adapted", "partial"]);

type ActivePlanRow = { id: string; createdAt: string | Date; contentJson: string };
type WorkoutSessionRow = { id: string; planId: string; sessionIndex: number; status: string; startedAt: string | Date; endedAt: string | Date | null; globalEffort: number | null; comment: string | null; discomfortJson: string | null };
type SessionExerciseRow = { id: string; workoutSessionId: string; variantId: string; position: number; status: string };
type SetPerformanceRow = { id: string; sessionExerciseId: string; setNumber: number; loadKg: number | null; repetitions: number | null; difficulty: string | null };
type RecoverySessionRow = { planId: string; sessionIndex: number; status: string; startedAt: string | Date; endedAt: string | Date | null };
type PlanEditRow = { planId: string; isoWeekStart: string; sessionIndex: number; kind: string };
type EnduranceActivityRow = { id: string; planId: string | null; sport: string; name: string; source: string; startedAt: string | Date; durationS: number | null; distanceM: number | null };
type ActivityMetricRow = { activityId: string; metricType: string; value: number; unit: string };
type PerformanceBaselineRow = { variantId: string; confidence: number | null; summaryJson: string };

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function historyData(snapshot: OfflineSnapshot) {
  return (snapshot.data.history as { workoutSessions?: WorkoutSessionRow[]; sessionExercises?: SessionExerciseRow[]; setPerformances?: SetPerformanceRow[] } | undefined) ?? {};
}

function activePlanFor(snapshot: OfflineSnapshot, planId: string): { plan: ActivePlanRow; proposal: PlanProposal } | null {
  const activePlan = snapshot.data.activePlan as ActivePlanRow | null;
  if (!activePlan || activePlan.id !== planId) return null;
  return { plan: activePlan, proposal: JSON.parse(activePlan.contentJson) as PlanProposal };
}

/** Plan-scoped, most-recent first — mirrors `workout-session-repository.ts`'s `listSessionHistory` (no status filter: includes in_progress). */
export function listSessionHistoryView(snapshot: OfflineSnapshot, planId: string): SessionHistoryEntry[] {
  const loaded = activePlanFor(snapshot, planId);
  if (!loaded) return [];
  const workoutSessions = historyData(snapshot).workoutSessions ?? [];
  return workoutSessions
    .filter((row) => row.planId === planId)
    .slice()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .map((row) => {
      const planned = loaded.proposal.week?.sessions?.[row.sessionIndex];
      return {
        id: row.id, sessionIndex: row.sessionIndex, status: row.status, startedAt: new Date(row.startedAt), endedAt: row.endedAt ? new Date(row.endedAt) : null,
        globalEffort: row.globalEffort, comment: row.comment,
        title: planned?.title ?? "Sesión", day: planned?.day ?? "", kind: (planned?.kind === "endurance" ? "endurance" : "strength") as "strength" | "endurance"
      };
    });
}

/** Plan-scoped. null when the snapshot's account doesn't have `planId` as its active plan. */
export function computeAdherenceView(snapshot: OfflineSnapshot, planId: string, today: Date = new Date()): AdherenceCounts | null {
  const loaded = activePlanFor(snapshot, planId);
  if (!loaded) return null;

  const strengthSessions: PlannedStrengthOccurrence[] = (loaded.proposal.week?.sessions ?? [])
    .map((session, sessionIndex) => ({ session, sessionIndex }))
    .filter(({ session }) => session.kind === "strength" && (session.exercises?.length ?? 0) > 0)
    .map(({ session, sessionIndex }) => ({ sessionIndex, day: session.day as Weekday }));

  const workoutSessions = historyData(snapshot).workoutSessions ?? [];
  const executed: ExecutedOccurrence[] = workoutSessions
    .filter((row) => row.planId === planId && FINISHED_STATUSES.has(row.status))
    .map((row) => ({ sessionIndex: row.sessionIndex, isoWeekStart: isoWeekStart(new Date(row.startedAt)), status: row.status as "completed" | "adapted" | "partial" }));

  const recoverySessions = (snapshot.data.recoverySessions as RecoverySessionRow[] | undefined) ?? [];
  const recoveryForAdherence: ExecutedOccurrence[] = recoverySessions
    .filter((row) => row.planId === planId && row.status === "completed")
    .map((row) => ({ sessionIndex: row.sessionIndex, isoWeekStart: isoWeekStart(new Date(row.startedAt)), status: "adapted" as const, source: "recovery" as const }));

  const planEdits = (snapshot.data.planEdits as PlanEditRow[] | undefined) ?? [];
  const adjustments: AdjustmentOccurrence[] = planEdits
    .filter((row) => row.planId === planId)
    .map((row) => ({ sessionIndex: row.sessionIndex, isoWeekStart: row.isoWeekStart, kind: row.kind }));

  return computeAdherence(strengthSessions, new Date(loaded.plan.createdAt), today, [...executed, ...recoveryForAdherence], adjustments);
}

/** Account-wide (no planId filter) — mirrors `history-repository.ts`'s `listVariantProgress` exactly. */
export function listVariantProgressView(snapshot: OfflineSnapshot): VariantProgressEntry[] {
  const baselines = (snapshot.data.performanceBaselines as PerformanceBaselineRow[] | undefined) ?? [];
  return baselines
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
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

/** Account-wide (no planId filter) — mirrors `history-repository.ts`'s `listEnduranceActivities` exactly. */
export function listEnduranceActivitiesView(snapshot: OfflineSnapshot): EnduranceActivityEntry[] {
  const activities = (snapshot.data.enduranceActivities as EnduranceActivityRow[] | undefined) ?? [];
  const metrics = (snapshot.data.activityMetrics as ActivityMetricRow[] | undefined) ?? [];
  const metricsByActivity = new Map<string, ActivityMetricRow[]>();
  for (const metric of metrics) metricsByActivity.set(metric.activityId, [...(metricsByActivity.get(metric.activityId) ?? []), metric]);
  return activities
    .slice()
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .map((row) => ({
      id: row.id, sport: row.sport, name: row.name, source: row.source, startedAt: new Date(row.startedAt), durationS: row.durationS, distanceM: row.distanceM,
      metrics: (metricsByActivity.get(row.id) ?? []).map(({ metricType, value, unit }) => ({ metricType, value, unit }))
    }));
}

/** Plan-scoped for sessions/recovery; the endurance-activity contribution is account-wide, same as `history-repository.ts`'s `computeWeekStats`. null when `planId` isn't the active plan. */
export function computeWeekStatsView(snapshot: OfflineSnapshot, planId: string, today: Date = new Date()): WeekStats | null {
  const loaded = activePlanFor(snapshot, planId);
  if (!loaded) return null;
  const previstas = loaded.proposal.week?.sessions?.length ?? 0;

  const workoutSessions = historyData(snapshot).workoutSessions ?? [];
  const sessionRows = workoutSessions
    .filter((row) => row.planId === planId && FINISHED_STATUSES.has(row.status))
    .map((row) => ({ startedAt: new Date(row.startedAt), endedAt: row.endedAt ? new Date(row.endedAt) : null }));

  const recoverySessions = (snapshot.data.recoverySessions as RecoverySessionRow[] | undefined) ?? [];
  const recoveryRows = recoverySessions
    .filter((row) => row.planId === planId && row.status === "completed")
    .map((row) => ({ startedAt: new Date(row.startedAt), endedAt: row.endedAt ? new Date(row.endedAt) : null }));

  const activities = (snapshot.data.enduranceActivities as EnduranceActivityRow[] | undefined) ?? [];
  const activityRows = activities.map((row) => ({ startedAt: new Date(row.startedAt), durationS: row.durationS }));

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
  const planStart = parseIsoDateLocal(isoWeekStart(new Date(loaded.plan.createdAt)));
  while (cursor >= planStart) {
    if (statsForWeek(isoDate(cursor)).hechas === 0) break;
    constancia += 1;
    cursor = addDays(cursor, -7);
  }

  return { previstas, hechas: current.hechas, minutos: current.minutos, constancia };
}

/** Full detail of one strength session (exercises, sets, declared discomfort) for `/historial/[id]`. Owner+plan-scoped (owner scoping comes from the snapshot itself); null if not found. */
export function getSessionDetailView(snapshot: OfflineSnapshot, planId: string, sessionId: string): SessionDetail | null {
  const loaded = activePlanFor(snapshot, planId);
  if (!loaded) return null;
  const workoutSessions = historyData(snapshot).workoutSessions ?? [];
  const session = workoutSessions.find((row) => row.id === sessionId && row.planId === planId);
  if (!session) return null;

  const planned = loaded.proposal.week?.sessions?.[session.sessionIndex];
  const sessionExercises = (historyData(snapshot).sessionExercises ?? [])
    .filter((row) => row.workoutSessionId === session.id && row.status === "active")
    .slice()
    .sort((a, b) => a.position - b.position);
  const setPerformances = historyData(snapshot).setPerformances ?? [];
  const exercises: SessionDetailExercise[] = sessionExercises.map((exercise) => {
    const variant = findVariant(exercise.variantId);
    const sets = setPerformances
      .filter((row) => row.sessionExerciseId === exercise.id)
      .slice()
      .sort((a, b) => a.setNumber - b.setNumber)
      .map((row) => ({ setNumber: row.setNumber, loadKg: row.loadKg, repetitions: row.repetitions, difficulty: row.difficulty }));
    return { variantId: exercise.variantId, exerciseName: variant?.exerciseName ?? exercise.variantId, variantName: variant?.variantName ?? "", sets };
  });

  const discomfort = session.discomfortJson ? (JSON.parse(session.discomfortJson) as { zone: string; intensity: string }) : null;
  return {
    id: session.id, status: session.status, startedAt: new Date(session.startedAt), endedAt: session.endedAt ? new Date(session.endedAt) : null,
    globalEffort: session.globalEffort, comment: session.comment, discomfort,
    title: planned?.title ?? "Sesión", day: planned?.day ?? "", exercises
  };
}

/** Detail of a manual or imported endurance activity for `/historial/[id]`. Account-wide (matches `getEnduranceActivityDetail`'s owner-only scoping); null if not found. */
export function getEnduranceActivityDetailView(snapshot: OfflineSnapshot, activityId: string): EnduranceActivityEntry | null {
  const activities = (snapshot.data.enduranceActivities as EnduranceActivityRow[] | undefined) ?? [];
  const row = activities.find((activity) => activity.id === activityId);
  if (!row) return null;
  const metrics = (snapshot.data.activityMetrics as ActivityMetricRow[] | undefined) ?? [];
  return {
    id: row.id, sport: row.sport, name: row.name, source: row.source, startedAt: new Date(row.startedAt), durationS: row.durationS, distanceM: row.distanceM,
    metrics: metrics.filter((metric) => metric.activityId === row.id).map(({ metricType, value, unit }) => ({ metricType, value, unit }))
  };
}
