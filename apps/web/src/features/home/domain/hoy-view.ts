/**
 * Pure, snapshot-driven view model for "/hoy" (Fase 5, Task 6). No React, no fetch: given the
 * current OfflineSnapshot, computes everything the page's JSX needs — identical to what the
 * former server component derived from `session`/`db` on every request, but read entirely from
 * `snapshot.data` so the same computation runs offline. `buildWeekView`/`latestWeekStatuses`/
 * `visibleOccurrencesForDay`/`summarizeWeekSessions`/`weeklyLoadWarning` are already pure
 * functions (plan-week.ts) that work identically client- or server-side — reused as-is.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import {
  buildWeekView,
  latestWeekStatuses,
  summarizeWeekSessions,
  visibleOccurrencesForDay,
  weeklyLoadWarning,
  type ExecutedStatus,
  type WeekOccurrence,
  type WeekSessionSummary,
  type WeeklyLoadWarning
} from "@/features/planning/domain/plan-week";
import { isoWeekStart, parseIsoDateLocal, todayWeekday, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

type ActivePlanRow = { id: string; name: string; contentJson: string };

export type PlanEditRow = {
  planId: string;
  isoWeekStart: string;
  sessionIndex: number;
  kind: string;
  targetDay: string | null;
  opsJson: string;
};

type WorkoutSessionRow = { planId: string; sessionIndex: number; startedAt: string | Date; status: string };
type RecoverySessionRow = { planId: string; sessionIndex: number; status: string; startedAt: string | Date };

export type HoyView = {
  activePlan: ActivePlanRow;
  content: PlanProposal;
  sessions: PlanProposal["week"]["sessions"];
  kickerLabel: string;
  today: Weekday;
  todaySession: PlanProposal["week"]["sessions"][number] | null;
  todayIndex: number;
  statuses: Record<number, ExecutedStatus>;
  weekOccurrences: WeekOccurrence[];
  todayOccurrences: WeekOccurrence[];
  extraOccurrences: WeekOccurrence[];
  todayAdjustment: PlanEditRow | undefined;
  extraOccurrenceAdjustments: (PlanEditRow | undefined)[];
  recoveryStatus: string | null;
  warn: WeeklyLoadWarning | null;
  weekSummary: WeekSessionSummary;
};

function adjustmentFor(planEdits: PlanEditRow[], planId: string, weekStart: string, sessionIndex: number): PlanEditRow | undefined {
  return planEdits.find((row) => row.planId === planId && row.isoWeekStart === weekStart && row.sessionIndex === sessionIndex);
}

/** Computes the full `/hoy` view model from a snapshot whose `activePlan` is known to be non-null — callers redirect to `/onboarding` before calling this. */
export function computeHoyView(snapshot: OfflineSnapshot): HoyView {
  const activePlan = snapshot.data.activePlan as ActivePlanRow;
  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const sessions = content.week?.sessions ?? [];
  const planEdits = (snapshot.data.planEdits as PlanEditRow[] | undefined) ?? [];
  const history = snapshot.data.history as { workoutSessions?: WorkoutSessionRow[] } | undefined;
  const workoutSessions = history?.workoutSessions ?? [];
  const recoverySessions = (snapshot.data.recoverySessions as RecoverySessionRow[] | undefined) ?? [];

  const today = todayWeekday();
  const weekStart = isoWeekStart();
  const weekStartDate = parseIsoDateLocal(weekStart);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);

  const fullHistory = workoutSessions
    .filter((row) => row.planId === activePlan.id)
    .map((row) => ({ sessionIndex: row.sessionIndex, startedAt: new Date(row.startedAt), status: row.status }));
  const statuses = latestWeekStatuses(fullHistory, weekStartDate, weekEndDate);

  const adjustments = planEdits.filter((row) => row.planId === activePlan.id && row.isoWeekStart === weekStart);
  const weekOccurrences = buildWeekView(content, true, adjustments, statuses);
  const todayOccurrences = visibleOccurrencesForDay(weekOccurrences, today);
  const todayIndex = todayOccurrences[0]?.sessionIndex ?? -1;
  const todaySession = todayIndex >= 0 ? sessions[todayIndex] : null;
  const extraOccurrences = todayOccurrences.slice(1);

  const allAdjustments = todayOccurrences.map((occurrence) => adjustmentFor(planEdits, activePlan.id, weekStart, occurrence.sessionIndex));
  const todayAdjustment = allAdjustments[0];
  const extraOccurrenceAdjustments = allAdjustments.slice(1);

  const latestRecovery = todayIndex >= 0 && todayAdjustment?.kind === "recovery"
    ? [...recoverySessions]
        .filter((row) => row.planId === activePlan.id && row.sessionIndex === todayIndex)
        .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
        .at(-1) ?? null
    : null;
  const recoveryStatus = latestRecovery?.status ?? null;

  const warn = weeklyLoadWarning(sessions);
  const weekSummary = summarizeWeekSessions(sessions, statuses);

  return {
    activePlan,
    content,
    sessions,
    kickerLabel: content.initialBlock?.name ?? activePlan.name,
    today,
    todaySession,
    todayIndex,
    statuses,
    weekOccurrences,
    todayOccurrences,
    extraOccurrences,
    todayAdjustment,
    extraOccurrenceAdjustments,
    recoveryStatus,
    warn,
    weekSummary
  };
}
