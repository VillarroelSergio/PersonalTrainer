import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db, sqlite } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { createPlanEditRepository } from "@/features/planning/domain/plan-edit-repository";
import { buildWeekView, occurrencesByDay, type ExecutedStatus } from "@/features/planning/domain/plan-week";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { AppShell } from "@/components/AppShell";
import { PlanSessionActions } from "@/features/planning/ui/PlanSessionActions";
import { WEEKDAY_LABEL, WEEKDAYS, isoDate, isoWeekStart, parseIsoDateLocal, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

const FINISHED_OR_ACTIVE = new Set(["in_progress", "completed", "adapted", "partial"]);

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (!activePlan) redirect("/onboarding");

  const { week } = await searchParams;
  const offset = Math.max(0, Number.parseInt(week ?? "0", 10) || 0);
  const currentWeekStart = isoWeekStart();
  const weekStart = isoDate(addDays(parseIsoDateLocal(currentWeekStart), offset * 7));

  const proposal = JSON.parse(activePlan.contentJson) as PlanProposal;
  const editRepo = createPlanEditRepository(db, sqlite);
  const workoutRepo = createWorkoutSessionRepository(db, sqlite);

  const adjustments = editRepo.listWeekAdjustments(session.user.id, activePlan.id, weekStart);

  const weekStartDate = parseIsoDateLocal(weekStart);
  const weekEndDate = addDays(weekStartDate, 7);
  const executedStatuses: Record<number, ExecutedStatus> = {};
  for (const row of workoutRepo.listSessionHistory(session.user.id, activePlan.id)) {
    if (row.startedAt >= weekStartDate && row.startedAt < weekEndDate && FINISHED_OR_ACTIVE.has(row.status)) {
      executedStatuses[row.sessionIndex] = row.status as ExecutedStatus;
    }
  }

  const occurrences = buildWeekView(proposal, weekStart >= currentWeekStart, adjustments, executedStatuses);
  const byDay = occurrencesByDay(occurrences);

  return (
    <AppShell title="Trainer">
      <p className="kicker">{proposal.initialBlock?.name ?? activePlan.name}</p>
      <h1 className="view-title">Tu plan</h1>
      <p className="lede small">{proposal.initialBlock?.purpose} · {proposal.initialBlock?.weeks} semanas</p>

      <div className="dayrow__actions" style={{ marginBottom: 12 }}>
        {offset > 0 ? <Link href={`/plan?week=${offset - 1}`} className="btn btn--ghost btn--sm">Semana anterior</Link> : null}
        <Link href={`/plan?week=${offset + 1}`} className="btn btn--ghost btn--sm">Semana siguiente</Link>
      </div>
      <p className="lede small">Semana del {WEEKDAY_LABEL.monday} {weekStart}{offset === 0 ? " · esta semana" : ""}</p>

      <ol className="daylist" aria-label="Semana del plan">
        {WEEKDAYS.map((day) => (
          <DayRow key={day} day={day as Weekday} occurrences={byDay[day as Weekday]} planId={activePlan.id} weekStart={weekStart} />
        ))}
      </ol>

      <h2 className="section-title">Añadir sesión esta semana</h2>
      <PlanSessionActions.AddForm planId={activePlan.id} weekStart={weekStart} />
    </AppShell>
  );
}

const STATUS_LABEL: Record<string, string> = {
  planned: "Planificada", in_progress: "En curso", completed: "Completada", adapted: "Adaptada", partial: "Parcial",
  moved_away: "Recolocada", moved_here: "Recolocada aquí", skipped: "Omitida", removed: "Eliminada"
};
const STATUS_CLASS: Record<string, string> = {
  planned: "planificada", in_progress: "en_curso", completed: "completada", adapted: "adaptada", partial: "parcial",
  moved_away: "rest", moved_here: "planificada", skipped: "omitida", removed: "omitida"
};

function DayRow({ day, occurrences, planId, weekStart }: { day: Weekday; occurrences: ReturnType<typeof occurrencesByDay>[Weekday]; planId: string; weekStart: string }) {
  const isToday = day === (WEEKDAYS[(new Date().getDay() + 6) % 7] as Weekday);

  if (occurrences.length === 0) {
    return (
      <li className={`dayrow dayrow--descanso${isToday ? " dayrow--hoy" : ""}`}>
        <div className="dayrow__top">
          <div><p className="dayrow__day">{WEEKDAY_LABEL[day]}{isToday ? " · hoy" : ""}</p><p className="dayrow__title">Descanso</p></div>
        </div>
      </li>
    );
  }

  return (
    <>
      {occurrences.map((occurrence) => {
        const rowClass = ["dayrow"];
        if (occurrence.kind === "endurance") rowClass.push("dayrow--cardio");
        if (occurrence.status === "moved_away") rowClass.push("dayrow--ghost");
        else if (["completed", "adapted", "partial"].includes(occurrence.status)) rowClass.push("dayrow--completada");
        else if (occurrence.status === "skipped" || occurrence.status === "removed") rowClass.push("dayrow--omitida");
        else if (isToday) rowClass.push("dayrow--hoy");
        else rowClass.push("dayrow--planificada");

        return (
          <li key={`${occurrence.sessionIndex}-${occurrence.day}`} className={rowClass.join(" ")}>
            <div className="dayrow__top">
              <div>
                <p className="dayrow__day">{WEEKDAY_LABEL[day]}{isToday ? " · hoy" : ""}</p>
                <p className="dayrow__title">{occurrence.status === "moved_away" ? `Se movió a ${WEEKDAY_LABEL[occurrence.movedToDay!]}` : occurrence.title}</p>
                <p className="dayrow__meta">
                  {occurrence.estimatedMinutes} min previstos
                  {occurrence.movedFromDay ? ` · recolocada desde ${WEEKDAY_LABEL[occurrence.movedFromDay].toLowerCase()}` : ""}
                  {occurrence.isAdded ? " · añadida" : ""}
                </p>
              </div>
              <span className={`state state--${STATUS_CLASS[occurrence.status] ?? "planificada"}`}>{STATUS_LABEL[occurrence.status] ?? occurrence.status}</span>
            </div>
            {occurrence.editable && occurrence.status !== "moved_away" ? (
              <PlanSessionActions.RowActions planId={planId} weekStart={weekStart} sessionIndex={occurrence.sessionIndex} status={occurrence.status} isAdded={occurrence.isAdded} />
            ) : null}
          </li>
        );
      })}
    </>
  );
}
