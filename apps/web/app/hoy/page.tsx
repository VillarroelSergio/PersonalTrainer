import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db, sqlite } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { createWorkoutTrainingEngineRepository } from "@/features/training-engine/domain/repository";
import { createRecoverySessionRepository } from "@/features/recovery/domain/recovery-session-repository";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_ABBREV, WEEKDAY_LABEL, WEEKDAYS, isoWeekStart, todayWeekday, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

const DONE_STATUSES = new Set(["completed", "adapted", "partial"]);

export default async function HoyPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (!activePlan) redirect("/onboarding");

  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const sessions = content.week?.sessions ?? [];
  const repository = createWorkoutSessionRepository(db, sqlite);
  const statuses = repository.listLatestStatuses(session.user.id, activePlan.id);

  const today = todayWeekday();
  const todayIndex = sessions.findIndex((item) => item.day === today);
  const todaySession = todayIndex >= 0 ? sessions[todayIndex] : null;
  const engineRepository = createWorkoutTrainingEngineRepository(db, sqlite);
  const adjustment = todayIndex >= 0 ? engineRepository.getAdjustment(session.user.id, activePlan.id, isoWeekStart(), todayIndex) : undefined;
  const recoveryRepository = createRecoverySessionRepository(db, sqlite);
  const recoveryStatus = todayIndex >= 0 && adjustment?.kind === "recovery" ? recoveryRepository.findLatest(session.user.id, activePlan.id, todayIndex)?.status ?? null : null;

  return (
    <AppShell title="Trainer">
      <p className="kicker">{content.initialBlock?.name ?? activePlan.name}</p>
      <h1 className="view-title">Hoy</h1>

      <h2 className="section-title">Entrenamiento de hoy</h2>
      <TodayHero session={todaySession} sessionIndex={todayIndex} status={todayIndex >= 0 ? statuses[todayIndex] : undefined} adjustment={adjustment} recoveryStatus={recoveryStatus} />
      <Link href="/checkin" className="btn btn--ghost btn--block">Hacer check-in de hoy</Link>

      <h2 className="section-title">Plan de la semana</h2>
      <ol className="weekrail" aria-label="Tu semana">
        {WEEKDAYS.map((day) => {
          const index = sessions.findIndex((item) => item.day === day);
          const daySession = index >= 0 ? sessions[index] : null;
          const status = index >= 0 ? statuses[index] : undefined;
          const isToday = day === today;
          const classNames = ["weekrail__day"];
          if (!daySession) classNames.push("is-rest");
          else if (status && DONE_STATUSES.has(status)) classNames.push("is-done");
          else if (isToday) classNames.push("is-today");
          else classNames.push("is-planned");
          if (daySession?.kind === "endurance") classNames.push("is-cardio");

          return (
            <li key={day}>
              <span className={classNames.join(" ")}>
                <span className="weekrail__label">{WEEKDAY_ABBREV[day as Weekday]}</span>
                <span className="weekrail__mark" />
                <span className="weekrail__name">{daySession ? daySession.title : "descanso"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="rail-legend">Relleno = completada · naranja = hoy · hueco = planificada · punto = descanso.</p>
      <Link href="/importar" className="btn btn--ghost btn--block">Importar actividad exterior</Link>
      <Link href="/compartir" className="btn btn--ghost btn--block">Compartir rutina</Link>
    </AppShell>
  );
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
        <Link href={`/recuperar?session=${sessionIndex}`} className="btn btn--primary btn--block">
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
      </article>
    );
  }

  if (session.kind === "endurance") {
    return (
      <article className="today today--cardio" aria-labelledby="todayTitle">
        <p className="today__eyebrow">Hoy · resistencia</p>
        <h2 className="today__title" id="todayTitle">{session.title}</h2>
        <p className="today__why">Prevista para hoy · {session.estimatedMinutes} min aproximados. Trainer diseña los bloques; tú la creas en tu reloj y la haces fuera de la app.</p>
        <Link href={`/resistencia?session=${sessionIndex}`} className="btn btn--primary btn--block">Preparar sesión de resistencia</Link>
      </article>
    );
  }

  return (
    <article className="today" aria-labelledby="todayTitle">
      <p className="today__eyebrow">Hoy · {WEEKDAY_LABEL[session.day as Weekday]}</p>
      <h2 className="today__title" id="todayTitle">{session.title}</h2>
      <p className="today__why">Prevista para hoy · {session.estimatedMinutes} min aproximados.</p>
      <Link href={`/entrenar?session=${sessionIndex}`} className="btn btn--primary btn--block">
        {status === "in_progress" ? "Continuar sesión" : "Empezar sesión"}
      </Link>
    </article>
  );
}
