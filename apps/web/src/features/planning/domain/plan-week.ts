import { WEEKDAYS, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

/** Virtual sessionIndex space reserved for sessions added directly from /plan for a single week — never collides with a real template index (a week template realistically has well under 1000 sessions). ponytail: fixed offset, move to a dedicated id space if that assumption ever breaks. */
export const ADDED_SESSION_INDEX_BASE = 1000;

export type PlanAdjustmentRow = { sessionIndex: number; kind: string; targetDay: string | null; opsJson: string };
export type ExecutedStatus = "in_progress" | "completed" | "adapted" | "partial";

export type WeekOccurrence = {
  sessionIndex: number;
  day: Weekday;
  title: string;
  kind: "strength" | "endurance";
  estimatedMinutes: number;
  /** "moved_away"/"moved_here" describe the same occurrence seen from its origin vs. its new day. */
  status: ExecutedStatus | "planned" | "moved_away" | "moved_here" | "skipped" | "removed";
  editable: boolean;
  isAdded: boolean;
  movedFromDay: Weekday | null;
  movedToDay: Weekday | null;
};

type AddedOps = { title: string; kind: "strength" | "endurance"; estimatedMinutes: number };

/**
 * Pure read model: merges the plan's repeating weekly template with this
 * week's adjustments (move/skip/remove/add) and real execution status, never
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
      occurrences.push({ sessionIndex, day: session.day, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: executed, editable: false, isAdded: false, movedFromDay: null, movedToDay: null });
      return;
    }

    if (adjustment?.kind === "reschedule" && adjustment.targetDay) {
      const targetDay = adjustment.targetDay as Weekday;
      occurrences.push({ sessionIndex, day: session.day, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: "moved_away", editable, isAdded: false, movedFromDay: null, movedToDay: targetDay });
      occurrences.push({ sessionIndex, day: targetDay, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: "moved_here", editable, isAdded: false, movedFromDay: session.day, movedToDay: null });
      return;
    }

    if (adjustment?.kind === "skipped") {
      occurrences.push({ sessionIndex, day: session.day, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: "skipped", editable, isAdded: false, movedFromDay: null, movedToDay: null });
      return;
    }

    if (adjustment?.kind === "removed") {
      occurrences.push({ sessionIndex, day: session.day, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: "removed", editable, isAdded: false, movedFromDay: null, movedToDay: null });
      return;
    }

    occurrences.push({ sessionIndex, day: session.day, title: session.title, kind: session.kind, estimatedMinutes: session.estimatedMinutes, status: "planned", editable, isAdded: false, movedFromDay: null, movedToDay: null });
  });

  for (const adjustment of adjustments) {
    if (adjustment.kind !== "added") continue;
    const ops = JSON.parse(adjustment.opsJson) as AddedOps;
    const day = (adjustment.targetDay ?? WEEKDAYS[0]) as Weekday;
    occurrences.push({ sessionIndex: adjustment.sessionIndex, day, title: ops.title, kind: ops.kind, estimatedMinutes: ops.estimatedMinutes, status: "planned", editable: isFutureOrCurrentWeek, isAdded: true, movedFromDay: null, movedToDay: null });
  }

  return occurrences;
}

export function occurrencesByDay(occurrences: WeekOccurrence[]): Record<Weekday, WeekOccurrence[]> {
  const byDay = Object.fromEntries(WEEKDAYS.map((day) => [day, [] as WeekOccurrence[]])) as Record<Weekday, WeekOccurrence[]>;
  for (const occurrence of occurrences) byDay[occurrence.day].push(occurrence);
  return byDay;
}
