/**
 * Pure, snapshot-driven view model for "/plan" (Fase 5, Task 6). No React, no fetch: given the
 * current OfflineSnapshot plus the "week"/"vista" query params, computes everything the page's
 * JSX needs — identical to what the former server component derived from `session`/`db` on every
 * request. `buildWeekView`/`occurrencesByDay`/`computeBlockProgress`/`computeWeekMinutes`/
 * `computeConsistencyWeeks`/`evolutionNote` are already pure (plan-week.ts) and reused as-is;
 * `computeAdherenceView`/`computeWeeklyLoadView`/`listSessionHistoryView` are reused from
 * historial-view.ts (history-repository.ts's real scoping, not reimplemented).
 *
 * "Tus planes" (the plans list) needs every plan the owner has ever had, not just the active one
 * — the snapshot now carries a raw `plans` dump (offline-snapshot/handler.ts) for exactly this,
 * same pattern already used for enduranceActivities/performanceBaselines.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import {
  buildWeekView,
  computeBlockProgress,
  computeConsistencyWeeks,
  computeWeekMinutes,
  evolutionNote,
  occurrencesByDay,
  type BlockProgress,
  type ExecutedStatus,
  type FinishedSessionRow,
  type WeekOccurrence
} from "./plan-week";
import { computeAdherenceView, computeWeeklyLoadView, listSessionHistoryView } from "@/features/history/domain/historial-view";
import { pickAchievements } from "@/features/history/domain/history-engine";
import type { AdherenceCounts } from "@/features/history/domain/history-engine";
import type { SessionHistoryEntry, WeeklyLoad } from "@/features/history/domain/history-repository";
import { isoDate, isoWeekStart, parseIsoDateLocal, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

export const TABS = [
  { key: "semana", label: "Semana" },
  { key: "fases", label: "Fases" },
  { key: "planes", label: "Tus planes" }
] as const;
export type TabKey = (typeof TABS)[number]["key"];

const FINISHED_OR_ACTIVE = new Set(["in_progress", "completed", "adapted", "partial"]);

type ActivePlanRow = { id: string; name: string; status: string; contentJson: string; createdAt: string | Date };
export type PlanRow = { id: string; name: string; status: string; contentJson: string };
type WorkoutSessionRow = { planId: string; sessionIndex: number; startedAt: string | Date; endedAt: string | Date | null; status: string };
type PlanEditRow = { planId: string; isoWeekStart: string; sessionIndex: number; kind: string; targetDay: string | null; opsJson: string };

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export type PlanProgress = {
  minutes: number;
  consistencyWeeks: number;
  weeklyLoad: WeeklyLoad;
  adherence: AdherenceCounts | null;
  recentActivity: SessionHistoryEntry[];
  note: string;
  achievements: ReturnType<typeof pickAchievements>;
  weekDoneCount: number;
  weekPlannedCount: number;
};

export type PlanView = {
  activePlan: ActivePlanRow;
  proposal: PlanProposal;
  vista: TabKey;
  offset: number;
  weekStart: string;
  currentWeekStart: string;
  occurrences: WeekOccurrence[];
  byDay: Record<Weekday, WeekOccurrence[]>;
  visibleOccurrences: WeekOccurrence[];
  weekSessionCount: number;
  weekPlannedMinutes: number;
  blockProgress: BlockProgress;
  plans: PlanRow[];
  progress: PlanProgress;
};

/** Computes the full `/plan` view model from a snapshot whose `activePlan` is known to be non-null — callers redirect to `/onboarding` before calling this. */
export function computePlanView(snapshot: OfflineSnapshot, weekParam: string | null, vistaParam: string | null): PlanView {
  const activePlan = snapshot.data.activePlan as ActivePlanRow;
  const proposal = JSON.parse(activePlan.contentJson) as PlanProposal;

  const vista: TabKey = TABS.some((tab) => tab.key === vistaParam) ? (vistaParam as TabKey) : "semana";
  const offset = Math.max(0, Number.parseInt(weekParam ?? "0", 10) || 0);
  const currentWeekStart = isoWeekStart();
  const weekStart = isoDate(addDays(parseIsoDateLocal(currentWeekStart), offset * 7));
  const weekStartDate = parseIsoDateLocal(weekStart);
  const weekEndDate = addDays(weekStartDate, 7);

  const planEdits = (snapshot.data.planEdits as PlanEditRow[] | undefined) ?? [];
  const adjustments = planEdits.filter((row) => row.planId === activePlan.id && row.isoWeekStart === weekStart);

  const history = snapshot.data.history as { workoutSessions?: WorkoutSessionRow[] } | undefined;
  const planHistory = (history?.workoutSessions ?? []).filter((row) => row.planId === activePlan.id);
  const fullHistory: FinishedSessionRow[] = planHistory.map((row) => ({
    startedAt: new Date(row.startedAt),
    endedAt: row.endedAt ? new Date(row.endedAt) : null,
    status: row.status
  }));

  const executedStatuses: Record<number, ExecutedStatus> = {};
  for (const row of planHistory) {
    const startedAt = new Date(row.startedAt);
    if (startedAt >= weekStartDate && startedAt < weekEndDate && FINISHED_OR_ACTIVE.has(row.status)) {
      executedStatuses[row.sessionIndex] = row.status as ExecutedStatus;
    }
  }

  const occurrences = buildWeekView(proposal, weekStart >= currentWeekStart, adjustments, executedStatuses);
  const byDay = occurrencesByDay(occurrences);
  const visibleOccurrences = occurrences.filter((occurrence) => occurrence.status !== "moved_away" && occurrence.status !== "removed");
  const weekSessionCount = visibleOccurrences.length;
  const weekPlannedMinutes = visibleOccurrences.reduce((sum, occurrence) => sum + occurrence.estimatedMinutes, 0);

  const blockProgress = computeBlockProgress(new Date(activePlan.createdAt), proposal.initialBlock?.weeks ?? 1);
  const plans = (snapshot.data.plans as PlanRow[] | undefined) ?? [];

  // ProgressSection always reads the *current* real week for weeklyLoad, independent of the
  // navigated week offset — matches the original server component (`historyRepo.computeWeeklyLoad(ownerId, isoWeekStart())`).
  const weeklyLoad = computeWeeklyLoadView(snapshot, isoWeekStart());
  const adherence = computeAdherenceView(snapshot, activePlan.id);
  const recentActivity = listSessionHistoryView(snapshot, activePlan.id).slice(0, 3);
  const minutes = computeWeekMinutes(fullHistory, weekStartDate, weekEndDate);
  const consistencyWeeks = computeConsistencyWeeks(fullHistory);
  const note = evolutionNote(fullHistory);
  const totalAdherencia = adherence ? adherence.completadas + adherence.adaptadas : 0;
  const achievements = pickAchievements(totalAdherencia);
  const weekDoneCount = visibleOccurrences.filter((occurrence) => ["completed", "adapted", "partial"].includes(occurrence.status)).length;
  const weekPlannedCount = visibleOccurrences.length;

  return {
    activePlan,
    proposal,
    vista,
    offset,
    weekStart,
    currentWeekStart,
    occurrences,
    byDay,
    visibleOccurrences,
    weekSessionCount,
    weekPlannedMinutes,
    blockProgress,
    plans,
    progress: { minutes, consistencyWeeks, weeklyLoad, adherence, recentActivity, note, achievements, weekDoneCount, weekPlannedCount }
  };
}
