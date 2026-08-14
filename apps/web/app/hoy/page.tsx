import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { createPlanEditRepository } from "@/features/planning/domain/plan-edit-repository";
import { buildWeekView, latestWeekStatuses, summarizeWeekSessions, visibleOccurrencesForDay, weeklyLoadWarning, type ExecutedStatus } from "@/features/planning/domain/plan-week";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { createWorkoutTrainingEngineRepository } from "@/features/training-engine/domain/repository";
import { createRecoverySessionRepository } from "@/features/recovery/domain/recovery-session-repository";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_ABBREV, WEEKDAY_LABEL, WEEKDAYS, isoWeekStart, parseIsoDateLocal, todayWeekday, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";
import { logRouteTiming } from "@/lib/observability/route-timing";

const DONE_STATUSES = new Set(["completed", "adapted", "partial"]);
const STATUS_LABEL: Record<string, string> = { completed: "completada", adapted: "adaptada", partial: "parcial", in_progress: "en curso" };

export default async function HoyPage() {
  const startedAt = Date.now();
  const requestHeaders = await headers();
  const requestId = requestHeaders.get("x-vercel-id");
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) redirect("/login");

  const db = getDb();
  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (!activePlan) redirect("/onboarding");

  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const sessions = content.week?.sessions ?? [];
  const repository = createWorkoutSessionRepository(db);
  const today = todayWeekday();
  const weekStart = isoWeekStart();
  const editRepository = createPlanEditRepository(db);
  const [fullHistory, adjustments] = await Promise.all([
    repository.listSessionHistory(session.user.id, activePlan.id),
    editRepository.listWeekAdjustments(session.user.id, activePlan.id, weekStart)
  ]);
  const weekStartDate = parseIsoDateLocal(weekStart);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const statuses = latestWeekStatuses(fullHistory, weekStartDate, weekEndDate);
  const weekOccurrences = buildWeekView(content, true, adjustments, statuses as Record<number, ExecutedStatus>);
  const todayOccurrences = visibleOccurrencesForDay(weekOccurrences, today);
  const todayIndex = todayOccurrences[0]?.sessionIndex ?? -1;
  const todaySession = todayIndex >= 0 ? sessions[todayIndex] : null;
  const engineRepository = createWorkoutTrainingEngineRepository(db);
  const extraOccurrences = todayOccurrences.slice(1);
  const allAdjustments = await Promise.all(
    todayOccurrences.map((occurrence) => engineRepository.getAdjustment(session.user.id, activePlan.id, weekStart, occurrence.sessionIndex))
  );
  const adjustment = allAdjustments[0];
  const recoveryRepository = createRecoverySessionRepository(db);
  const recoveryStatus = todayIndex >= 0 && adjustment?.kind === "recovery" ? (await recoveryRepository.findLatest(session.user.id, activePlan.id, todayIndex))?.status ?? null : null;

  const warn = weeklyLoadWarning(sessions);
  const weekSummary = summarizeWeekSessions(sessions, statuses);
  const extraOccurrenceAdjustments = allAdjustments.slice(1);

  logRouteTiming("/hoy", requestId, startedAt, { data: Date.now() - startedAt });

  return (
    <AppShell title="Trainer">
      <p className="kicker">{content.initialBlock?.name ?? activePlan.name}</p>
      <h1 className="view-title">Tu camino</h1>

      <h2 className="section-title">Entrenamiento de hoy</h2>
      <div className="today-stack">
        <TodayHero session={todaySession} sessionIndex={todayIndex} status={todayIndex >= 0 ? statuses[todayIndex] : undefined} adjustment={adjustment} recoveryStatus={recoveryStatus} />
        {extraOccurrences.map((occurrence, index) => (
          <TodayHero key={`${occurrence.sessionIndex}-${occurrence.day}`} session={sessions[occurrence.sessionIndex]} sessionIndex={occurrence.sessionIndex} status={statuses[occurrence.sessionIndex]} adjustment={extraOccurrenceAdjustments[index]} recoveryStatus={null} />
        ))}
      </div>

      <section className="week-pulse" aria-label="Ritmo de la semana">
        <div className="week-pulse__main">
          <p className="week-pulse__eyebrow">Ritmo de la semana</p>
          <p className="week-pulse__value"><strong>{weekSummary.completed}</strong><span>/{weekSummary.planned} sesiones</span></p>
          <p className="week-pulse__copy">
            {weekSummary.planned === 0
              ? "Aún no hay sesiones previstas."
              : weekSummary.inProgress > 0
                ? `Tienes ${weekSummary.inProgress} sesión${weekSummary.inProgress === 1 ? "" : "es"} en marcha.`
                : weekSummary.remaining === 0
                  ? "Semana completada. Buen trabajo."
                  : `${weekSummary.remaining} por delante para cerrar la semana.`}
          </p>
        </div>
        <div className="week-pulse__minutes" aria-label={`${weekSummary.plannedMinutes} minutos previstos`}>
          <strong>{weekSummary.plannedMinutes}</strong>
          <span>min previstos</span>
        </div>
      </section>

      <h2 className="section-title">Plan de la semana</h2>
      <ol className="weekrail" aria-label="Tu semana">
        {WEEKDAYS.map((day) => {
          const dayOccurrences = visibleOccurrencesForDay(weekOccurrences, day);
          const index = dayOccurrences[0]?.sessionIndex ?? -1;
          const daySession = index >= 0 ? sessions[index] : null;
          const status = dayOccurrences[0]?.status;
          const isToday = day === today;
          const classNames = ["weekrail__day"];
          if (!daySession) classNames.push("is-rest");
          else if (status && DONE_STATUSES.has(status)) classNames.push("is-done");
          else if (status === "in_progress") classNames.push("is-today");
          else if (isToday) classNames.push("is-today");
          else classNames.push("is-planned");
          if (daySession?.kind === "endurance") classNames.push("is-cardio");

          const href = !daySession
            ? "/plan"
            : status && DONE_STATUSES.has(status)
              ? "/historial"
              : daySession.kind === "endurance"
                ? `/resistencia?session=${index}`
                : `/entrenar?session=${index}`;
          const described = !daySession
            ? "descanso"
            : `${daySession.title}, ${status && status !== "planned" ? STATUS_LABEL[status] ?? status : isToday ? "hoy" : "planificada"}`;

          return (
            <li key={day}>
              <Link href={href} className={classNames.join(" ")} aria-label={`${WEEKDAY_LABEL[day as Weekday]}: ${described}`}>
                <span className="weekrail__label" aria-hidden="true">{WEEKDAY_ABBREV[day as Weekday]}</span>
                <span className="weekrail__bar" aria-hidden="true" />
                {dayOccurrences.length > 1 ? <span className="weekrail__count" aria-label={`${dayOccurrences.length} sesiones`}>{dayOccurrences.length}</span> : null}
              </Link>
            </li>
          );
        })}
      </ol>
      {warn && <p className="notice notice--warn">{loadWarningPhrase(warn)}</p>}

      {!todaySession || todayOccurrences.every((occurrence) => statuses[occurrence.sessionIndex] && DONE_STATUSES.has(statuses[occurrence.sessionIndex])) ? null : (
        <>
          <h2 className="section-title">Cómo llegas hoy</h2>
          <p className="lede small">Opcional y rápido: cuéntanos cómo llegas hoy (20 s) para ajustar la sesión si hace falta.</p>
          <Link href="/checkin" className="btn btn--ghost btn--block btn--compact">Hacer check-in de hoy</Link>
        </>
      )}
    </AppShell>
  );
}

/** One short, honest sentence replacing the removed rail-legend paragraph — derived from
 * the same real statuses already computed above, never a fabricated count. */
function weekStoryLine(sessions: PlanProposal["week"]["sessions"], statuses: Record<number, string>): string {
  const total = sessions.length;
  if (total === 0) return "Esta semana no tienes sesiones planificadas.";
  const done = sessions.reduce((count, _session, index) => count + (statuses[index] && DONE_STATUSES.has(statuses[index]) ? 1 : 0), 0);
  if (done === 0) return `${total} sesión${total === 1 ? "" : "es"} por delante esta semana, ninguna hecha todavía.`;
  if (done === total) return `Semana completa: las ${total} sesiones hechas.`;
  return `${done} de ${total} sesiones hechas esta semana.`;
}

/** Same phrase shape as the prototype's loadWarningPhrase (home.js), simplified: always
 * "queda junto a" instead of computing hour-gaps, since neighborWeekdays only ever returns
 * adjacent days (the exact gap is never more informative than "adjacent"). */
function loadWarningPhrase(warn: NonNullable<ReturnType<typeof weeklyLoadWarning>>): string {
  const freeLabel = warn.freeDay ? WEEKDAY_LABEL[warn.freeDay] : null;
  const phrase = `${warn.session.title} el ${WEEKDAY_LABEL[warn.session.day as Weekday].toLowerCase()} queda junto a ${warn.conflict.title.toLowerCase()} (${WEEKDAY_LABEL[warn.conflict.day as Weekday].toLowerCase()}).`;
  return phrase + (freeLabel
    ? ` Si la mueves, ${freeLabel.toLowerCase()} queda libre esta semana.`
    : " No hay día libre esta semana para moverla: revisa las opciones desde Plan.");
}

function TodayHero({
  session,
  sessionIndex,
  status,
  adjustment,
  recoveryStatus
}: {
  session: PlanProposal["week"]["sessions"][number] | null;
  sessionIndex: number;
  status?: string;
  adjustment?: { kind: string; targetDay: string | null };
  recoveryStatus?: string | null;
}) {
  if (session && adjustment?.kind === "reschedule" && adjustment.targetDay) {
    return (
      <article className="today today--recovery" aria-labelledby="todayTitle">
        <p className="today__eyebrow">Hoy · movida</p>
        <h2 className="today__title" id="todayTitle">{session.title}</h2>
        <p className="today__why">Aceptaste moverla a {WEEKDAY_LABEL[adjustment.targetDay as Weekday]}. Hoy no aparece como prevista.</p>
      </article>
    );
  }

  if (session && adjustment?.kind === "recovery") {
    return (
      <article className="today today--recovery" aria-labelledby="todayTitle">
        <p className="today__eyebrow">Hoy · recuperación</p>
        <h2 className="today__title" id="todayTitle">Versión de recuperación</h2>
        <p className="today__why">Aceptaste cambiar {session.title.toLowerCase()} por una versión más suave hoy. Vuelves al plan normal en la próxima sesión prevista.</p>
        <Link href={`/recuperar?session=${sessionIndex}`} className="btn btn--primary btn--block btn--compact">
          {recoveryStatus === "completed" ? "Ver recuperación registrada" : recoveryStatus === "in_progress" ? "Continuar recuperación" : "Empezar recuperación"}
        </Link>
      </article>
    );
  }

  if (!session) {
    return (
      <article className="today today--recovery" aria-labelledby="todayTitle">
        <p className="today__eyebrow">Hoy · descanso</p>
        <h2 className="today__title" id="todayTitle">Día libre</h2>
        <p className="today__why">No hay ninguna sesión planificada hoy.</p>
      </article>
    );
  }

  if (status && DONE_STATUSES.has(status)) {
    return (
      <article className="today today--done" aria-labelledby="todayTitle">
        <p className="today__eyebrow">Hoy · {status === "completed" ? "sesión completada" : status === "adapted" ? "versión adaptada terminada" : "sesión parcial"}</p>
        <h2 className="today__title" id="todayTitle">{session.title}</h2>
        <p className="today__why">Registrada: {session.estimatedMinutes} min activos aproximados.</p>
        <div className="today__alts">
          <TodayAlt kind="recovery" title="Cambiar a recuperación" meta="10–15 min, sin carga" href={`/recuperar?session=${sessionIndex}`} />
        </div>
      </article>
    );
  }

  if (session.kind === "endurance") {
    return (
      <article className="today today--cardio" aria-labelledby="todayTitle">
        <p className="today__eyebrow">Hoy · resistencia</p>
        <h2 className="today__title" id="todayTitle">{session.title}</h2>
        <p className="today__why">Prevista para hoy · {session.estimatedMinutes} min aproximados. Trainer diseña los bloques; tú la creas en tu reloj y la haces fuera de la app.</p>
        <Link href={`/resistencia?session=${sessionIndex}`} className="btn btn--primary btn--block btn--compact">Preparar sesión de resistencia</Link>
        <div className="today__alts">
          <TodayAlt kind="adapt" title="Ajustar a cómo llego hoy" meta="Check-in de 20 s · propone y confirmas" href="/checkin" />
          <TodayAlt kind="recovery" title="Cambiar a recuperación" meta="Movilidad suave, 10–15 min" href={`/recuperar?session=${sessionIndex}`} />
        </div>
      </article>
    );
  }

  return (
    <article className="today" aria-labelledby="todayTitle">
      <p className="today__eyebrow">Hoy · {WEEKDAY_LABEL[session.day as Weekday]}</p>
      <h2 className="today__title" id="todayTitle">{session.title}</h2>
      <p className="today__why">Prevista para hoy · {session.estimatedMinutes} min aproximados.</p>
      <Link href={`/entrenar?session=${sessionIndex}`} className="btn btn--primary btn--block btn--compact">
        {status === "in_progress" ? "Continuar sesión" : "Empezar sesión"}
      </Link>
      {status !== "in_progress" && (
        <div className="today__alts">
          <TodayAlt kind="adapt" title="Ajustar a cómo llego hoy" meta="Check-in de 20 s · propone y confirmas" href="/checkin" />
          <TodayAlt kind="recovery" title="Cambiar a recuperación" meta="Movilidad suave, 10–15 min" href={`/recuperar?session=${sessionIndex}`} />
        </div>
      )}
    </article>
  );
}

function TodayAlt({ kind, title, meta, href }: { kind: "adapt" | "recovery"; title: string; meta: string; href: string }) {
  return (
    <Link href={href} className={`alt alt--${kind}`}>
      <span className="alt__mark" aria-hidden="true" />
      <span className="alt__body">
        <span className="alt__title">{title}</span>
        <span className="alt__meta">{meta}</span>
      </span>
      <span className="alt__arrow" aria-hidden="true">→</span>
    </Link>
  );
}
