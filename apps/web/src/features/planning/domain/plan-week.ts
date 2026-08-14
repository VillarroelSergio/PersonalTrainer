import { WEEKDAYS, isoWeekStart, neighborWeekdays, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";
import { findFreeWeekday, isLegsHeavy, LONG_OR_INTENSE_ENDURANCE_MINUTES } from "@/features/training-engine/domain/engine";

export type PlanAdjustmentRow = { sessionIndex: number; kind: string; targetDay: string | null; opsJson: string };
export type ExecutedStatus = "in_progress" | "completed" | "adapted" | "partial";

export type ExecutedSessionStatusRow = {
  sessionIndex: number;
  startedAt: Date;
  status: string;
};

/** Resolves only executions created inside the displayed week. Reusing an old
 * in-progress row for a repeating weekly template would falsely mark the new
 * occurrence as active. */
export function latestWeekStatuses(
  history: ExecutedSessionStatusRow[],
  weekStart: Date,
  weekEnd: Date
): Record<number, ExecutedStatus> {
  const statuses: Record<number, ExecutedStatus> = {};
  for (const row of history) {
    if (row.startedAt < weekStart || row.startedAt >= weekEnd) continue;
    if (!["in_progress", "completed", "adapted", "partial"].includes(row.status)) continue;
    statuses[row.sessionIndex] = row.status as ExecutedStatus;
  }
  return statuses;
}

export type WeekOccurrence = {
  sessionIndex: number;
  day: Weekday;
  title: string;
  kind: "strength" | "endurance";
  estimatedMinutes: number;
  /** "moved_away"/"moved_here" describe the same occurrence seen from its origin vs. its new day. */
  status: ExecutedStatus | "planned" | "moved_away" | "moved_here" | "skipped" | "removed";
  editable: boolean;
  movedFromDay: Weekday | null;
  movedToDay: Weekday | null;
};

/**
 * Pure read model: merges the plan's repeating weekly template with this
 * week's adjustments (move/skip/remove) and real execution status, never
 * mutating the template. `editable` is false once an execution row exists
 * for that occurrence in this week, or the week has already passed —
 * "nunca reescribir una sesión ya iniciada/cerrada".
 */
export function buildWeekView(
  proposal: PlanProposal,
  isFutureOrCurrentWeek: boolean,
  adjustments: PlanAdjustmentRow[],
  executedStatuses: Record<number, ExecutedStatus>
): WeekOccurrence[] {
  const templateSessions = proposal.week?.sessions ?? [];
  const adjustmentByIndex = new Map(adjustments.map((row) => [row.sessionIndex, row]));
  const occurrences: WeekOccurrence[] = [];

  templateSessions.forEach((session, sessionIndex) => {
    const adjustment = adjustmentByIndex.get(sessionIndex);
    const executed = executedStatuses[sessionIndex];
    const hasExecution = executed != null;
    const editable = isFutureOrCurrentWeek && !hasExecution;

    if (executed) {
      occurrences.push({ sessionIndex, day: session.day, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: executed, editable: false, movedFromDay: null, movedToDay: null });
      return;
    }

    if (adjustment?.kind === "reschedule" && adjustment.targetDay) {
      const targetDay = adjustment.targetDay as Weekday;
      occurrences.push({ sessionIndex, day: session.day, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: "moved_away", editable, movedFromDay: null, movedToDay: targetDay });
      occurrences.push({ sessionIndex, day: targetDay, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: "moved_here", editable, movedFromDay: session.day, movedToDay: null });
      return;
    }

    if (adjustment?.kind === "skipped") {
      occurrences.push({ sessionIndex, day: session.day, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: "skipped", editable, movedFromDay: null, movedToDay: null });
      return;
    }

    if (adjustment?.kind === "removed") {
      occurrences.push({ sessionIndex, day: session.day, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: "removed", editable, movedFromDay: null, movedToDay: null });
      return;
    }

    occurrences.push({ sessionIndex, day: session.day, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: "planned", editable, movedFromDay: null, movedToDay: null });
  });

  return occurrences;
}

export function occurrencesByDay(occurrences: WeekOccurrence[]): Record<Weekday, WeekOccurrence[]> {
  const byDay = Object.fromEntries(WEEKDAYS.map((day) => [day, [] as WeekOccurrence[]])) as Record<Weekday, WeekOccurrence[]>;
  for (const occurrence of occurrences) byDay[occurrence.day].push(occurrence);
  return byDay;
}

/**
 * The home screen needs the actual itinerary for a weekday, not the template
 * it started from. Recolocated-away, removed and skipped occurrences are
 * historical context for Plan, but are not an actionable "today" session.
 */
export function visibleOccurrencesForDay(occurrences: WeekOccurrence[], day: Weekday): WeekOccurrence[] {
  return occurrences.filter((occurrence) =>
    occurrence.day === day && !["moved_away", "removed", "skipped"].includes(occurrence.status)
  );
}

export function occurrenceRenderKey(occurrence: WeekOccurrence): string {
  return [
    occurrence.sessionIndex,
    occurrence.day,
    occurrence.status,
    occurrence.movedFromDay ?? "origin",
    occurrence.movedToDay ?? "target"
  ].join("-");
}

const ACTIONABLE_STATUSES = new Set(["planned", "moved_here", "in_progress"]);

export type SessionAction = { label: string; href: string };

/**
 * The single primary CTA for a day row (VISUAL-PARITY-CONTRACT.md §/plan): "Iniciar" for
 * strength, "Ver sesión"/"Continuar" for endurance/in-progress — never a CTA for rest,
 * completed, skipped, removed, or moved-away occurrences.
 */
export function sessionAction(occurrence: WeekOccurrence): SessionAction | null {
  if (!ACTIONABLE_STATUSES.has(occurrence.status)) return null;
  if (occurrence.kind === "endurance") return { label: "Ver sesión", href: `/resistencia?session=${occurrence.sessionIndex}` };
  return { label: occurrence.status === "in_progress" ? "Continuar" : "Iniciar", href: `/entrenar?session=${occurrence.sessionIndex}` };
}

type PlannedSession = PlanProposal["week"]["sessions"][number];

export type WeekSessionSummary = {
  planned: number;
  completed: number;
  inProgress: number;
  remaining: number;
  plannedMinutes: number;
};

/**
 * Compact, honest home-page snapshot. A session remains counted once even
 * when several share a weekday: the weekly plan is the source of truth, not
 * the seven visual day markers.
 */
export function summarizeWeekSessions(
  sessions: PlannedSession[],
  statuses: Record<number, string>
): WeekSessionSummary {
  const completed = sessions.reduce(
    (count, _session, index) => count + (FINISHED_SESSION_STATUSES.has(statuses[index]) ? 1 : 0),
    0
  );
  const inProgress = sessions.reduce((count, _session, index) => count + (statuses[index] === "in_progress" ? 1 : 0), 0);
  return {
    planned: sessions.length,
    completed,
    inProgress,
    remaining: Math.max(sessions.length - completed, 0),
    plannedMinutes: sessions.reduce((sum, session) => sum + session.estimatedMinutes, 0)
  };
}

export type WeeklyLoadWarning = { session: PlannedSession; conflict: PlannedSession; freeDay: Weekday | null };

/**
 * Weekly load guardrail (prototype's home.js `weeklyLoadWarning`, prioridad-hibrida-006):
 * flags a long/intense endurance session sitting next to a legs-heavy strength session.
 * Reuses the training engine's own `isLegsHeavy`/`findFreeWeekday` criteria (the same
 * ones behind the check-in's LOWER_BODY_PROXIMITY rule) instead of reimplementing the
 * "choque" rule with a second definition of "legs-heavy" or "intense".
 * ponytail: scans the base weekly template only (this week's reschedule/skip adjustments
 * aren't folded in) — the closest fit with the data already available to /hoy without
 * duplicating buildWeekView's adjustment merge for a single home-page notice.
 */
export function weeklyLoadWarning(sessions: PlannedSession[]): WeeklyLoadWarning | null {
  for (const session of sessions) {
    if (session.kind !== "endurance" || session.estimatedMinutes < LONG_OR_INTENSE_ENDURANCE_MINUTES) continue;
    for (const day of neighborWeekdays(session.day)) {
      const conflict = sessions.find((candidate) => candidate.day === day && candidate.kind === "strength" && isLegsHeavy(candidate));
      if (conflict) return { session, conflict, freeDay: findFreeWeekday(sessions, session.day) };
    }
  }
  return null;
}

/* ---- "Tu progreso" (LOTE plan tabs): pure helpers for the block-progress
 * section at the bottom of /plan. The schema has no stored "current week"
 * counter, so the week number is derived from the plan's real createdAt
 * against today — never a fabricated or client-editable value. */

export type BlockProgress = { currentWeek: number; totalWeeks: number; percent: number };

/** Clamped to [1, totalWeeks]: a plan older than its block still reads as "last week", never overflowing the bar. */
export function computeBlockProgress(createdAt: Date, totalWeeks: number, today: Date = new Date()): BlockProgress {
  const weeks = Math.max(totalWeeks, 1);
  const weeksElapsed = Math.floor((today.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const currentWeek = Math.min(Math.max(weeksElapsed + 1, 1), weeks);
  return { currentWeek, totalWeeks: weeks, percent: Math.round((currentWeek / weeks) * 100) };
}

export type FinishedSessionRow = { startedAt: Date; endedAt: Date | null; status: string };
const FINISHED_SESSION_STATUSES = new Set(["completed", "adapted", "partial"]);

/** Real minutes trained this week (endedAt - startedAt of finished sessions), never the estimate — the estimate is already shown as "previstos". */
export function computeWeekMinutes(history: FinishedSessionRow[], weekStart: Date, weekEnd: Date): number {
  return history
    .filter((row) => FINISHED_SESSION_STATUSES.has(row.status) && row.endedAt && row.startedAt >= weekStart && row.startedAt < weekEnd)
    .reduce((sum, row) => sum + Math.round((row.endedAt!.getTime() - row.startedAt.getTime()) / 60000), 0);
}

/** Distinct ISO weeks (all-time) with at least one finished session — an honest stand-in for the prototype's "constancia" streak: this account's history has no concept of a true consecutive-week streak yet. */
export function computeConsistencyWeeks(history: FinishedSessionRow[]): number {
  const weeks = new Set(history.filter((row) => FINISHED_SESSION_STATUSES.has(row.status)).map((row) => isoWeekStart(row.startedAt)));
  return weeks.size;
}

/** One clear sentence (MVP-DEFINITION §6: "no gráficos densos"), never a fabricated trend when there isn't enough data to support one. */
export function evolutionNote(history: FinishedSessionRow[]): string {
  const finished = history.filter((row) => FINISHED_SESSION_STATUSES.has(row.status));
  if (finished.length === 0) return "Todavía no hay sesiones registradas para mostrar una evolución. Aparecerá aquí en cuanto completes tu primera sesión.";
  if (finished.length < 2) return "Todavía es pronto para mostrar una evolución. Aparecerá en cuanto tengas más sesiones registradas.";
  return `Llevas ${finished.length} sesiones cerradas registradas en este plan. Tu evolución se basa en estos datos reales, sin gráficos densos.`;
}
