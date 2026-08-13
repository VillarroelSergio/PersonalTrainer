import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { findActivePlanForOwner, listPlansForOwner } from "@/features/planning/domain/training-plan-repository";
import { createPlanEditRepository } from "@/features/planning/domain/plan-edit-repository";
import {
  buildWeekView, occurrenceRenderKey, occurrencesByDay, sessionAction, computeBlockProgress, computeWeekMinutes, computeConsistencyWeeks, evolutionNote,
  type BlockProgress, type ExecutedStatus, type FinishedSessionRow
} from "@/features/planning/domain/plan-week";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { createHistoryRepository } from "@/features/history/domain/history-repository";
import { pickAchievements } from "@/features/history/domain/history-engine";
import { AppShell } from "@/components/AppShell";
import PlanSessionActions from "@/features/planning/ui/PlanSessionActions";
import PlanManagementActions from "@/features/planning/ui/PlanManagementActions";
import { WEEKDAY_LABEL, WEEKDAYS, isoDate, isoWeekStart, parseIsoDateLocal, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

const FINISHED_OR_ACTIVE = new Set(["in_progress", "completed", "adapted", "partial"]);

const TABS = [
  { key: "semana", label: "Semana" },
  { key: "fases", label: "Fases" },
  { key: "planes", label: "Tus planes" }
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** The schema only ever assigns "draft" | "active" | "archived" (see activation.ts) — no "paused"/"finished" state exists yet, so those prototype states never render here. Declared limitation, not an oversight. */
const PLAN_STATUS_LABEL: Record<string, string> = { draft: "Borrador", active: "Activo", archived: "Archivado" };
const PLAN_STATE_CLASS: Record<string, string> = { draft: "borrador", active: "activo", archived: "archivado" };

const STATUS_LABEL: Record<string, string> = {
  planned: "Planificada", in_progress: "En curso", completed: "Completada", adapted: "Adaptada", partial: "Parcial",
  moved_away: "Recolocada", moved_here: "Recolocada aquí", skipped: "Omitida", removed: "Eliminada"
};
const STATUS_CLASS: Record<string, string> = {
  planned: "planificada", in_progress: "en_curso", completed: "completada", adapted: "adaptada", partial: "parcial",
  moved_away: "rest", moved_here: "planificada", skipped: "omitida", removed: "omitida"
};

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Mismo asset aprobado que el mapa corporal de molestias (CheckinRunner.tsx,
// docs/PROTOTYPE-PARITY-MOBILE.md) — vista frontal, sin nueva ilustración.
const BODY_MAP_IMG = "/library/body-map/body-map-front-back-v1.webp";

/** Verde → rojo intenso, nunca una etiqueta clínica: solo intensidad relativa de series
 * registradas esta semana. Sin datos (0 series) es gris neutro, no "cero carga" alarmante.
 * ponytail: techo lineal en 10 series/semana — ajustar si los datos reales piden otro techo. */
function loadColor(seriesCount: number): string {
  if (seriesCount <= 0) return "var(--paper-2)";
  const t = Math.min(1, seriesCount / 10);
  return `hsl(${130 - t * 130}deg 60% 45%)`;
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ week?: string; vista?: TabKey }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const ownerId = session.user.id;
  const db = getDb();

  const activePlan = await findActivePlanForOwner(db, ownerId);
  if (!activePlan) redirect("/onboarding");

  const { week, vista: requestedVista } = await searchParams;
  const vista: TabKey = TABS.some((tab) => tab.key === requestedVista) ? requestedVista! : "semana";
  const offset = Math.max(0, Number.parseInt(week ?? "0", 10) || 0);
  const currentWeekStart = isoWeekStart();
  const weekStart = isoDate(addDays(parseIsoDateLocal(currentWeekStart), offset * 7));

  const proposal = JSON.parse(activePlan.contentJson) as PlanProposal;
  const editRepo = createPlanEditRepository(db);
  const workoutRepo = createWorkoutSessionRepository(db);
  const historyRepo = createHistoryRepository(db);

  const adjustments = await editRepo.listWeekAdjustments(ownerId, activePlan.id, weekStart);

  const weekStartDate = parseIsoDateLocal(weekStart);
  const weekEndDate = addDays(weekStartDate, 7);
  const fullHistory = await workoutRepo.listSessionHistory(ownerId, activePlan.id);
  const executedStatuses: Record<number, ExecutedStatus> = {};
  for (const row of fullHistory) {
    if (row.startedAt >= weekStartDate && row.startedAt < weekEndDate && FINISHED_OR_ACTIVE.has(row.status)) {
      executedStatuses[row.sessionIndex] = row.status as ExecutedStatus;
    }
  }

  const occurrences = buildWeekView(proposal, weekStart >= currentWeekStart, adjustments, executedStatuses);
  const byDay = occurrencesByDay(occurrences);

  const visibleOccurrences = occurrences.filter((occurrence) => occurrence.status !== "moved_away" && occurrence.status !== "removed");
  const weekSessionCount = visibleOccurrences.length;
  const weekPlannedMinutes = visibleOccurrences.reduce((sum, occurrence) => sum + occurrence.estimatedMinutes, 0);

  const blockProgress = computeBlockProgress(activePlan.createdAt, proposal.initialBlock?.weeks ?? 1);
  const plans = await listPlansForOwner(db, ownerId);

  return (
    <AppShell title="Trainer">
      <p className="kicker">{proposal.initialBlock?.name ?? activePlan.name}</p>
      <h1 className="view-title">Tu plan</h1>

      <div className="planrow">
        <div className="planrow__top">
          <div><p className="planrow__meta">Semana {blockProgress.currentWeek} de {blockProgress.totalWeeks}</p></div>
          <span className={`state state--${PLAN_STATE_CLASS[activePlan.status] ?? activePlan.status}`}>{PLAN_STATUS_LABEL[activePlan.status] ?? activePlan.status}</span>
        </div>
        {activePlan.status !== "active" ? (
          <p className="notice notice--info">Este plan no está activo ahora mismo. Gestiónalo desde la pestaña &ldquo;Tus planes&rdquo;.</p>
        ) : null}
      </div>

      <Link href="/compartir" className="btn btn--ghost btn--sm">Compartir plan</Link>

      <nav className="tabnav" aria-label="Vistas del plan">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/plan?vista=${tab.key}${offset ? `&week=${offset}` : ""}`}
            className={`tabnav__item${vista === tab.key ? " is-active" : ""}`}
            aria-current={vista === tab.key ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="tabpanel">
        {vista === "semana" ? (
          <>
            <p className="lede small">Total previsto: {weekSessionCount} sesiones · {weekPlannedMinutes} min previstos esta semana.</p>
            <div className="dayrow__actions" style={{ marginBottom: 12 }}>
              {offset > 0 ? <Link href={`/plan?vista=semana&week=${offset - 1}`} className="btn btn--ghost btn--sm">Semana anterior</Link> : null}
              <Link href={`/plan?vista=semana&week=${offset + 1}`} className="btn btn--ghost btn--sm">Semana siguiente</Link>
            </div>
            <p className="lede small">Semana del {WEEKDAY_LABEL.monday} {weekStart}{offset === 0 ? " · esta semana" : ""}</p>

            <ol className="daylist" aria-label="Semana del plan">
              {WEEKDAYS.map((day) => (
                <DayRow key={day} day={day as Weekday} occurrences={byDay[day as Weekday]} planId={activePlan.id} weekStart={weekStart} />
              ))}
            </ol>
          </>
        ) : null}

        {vista === "fases" ? <FasesTab proposal={proposal} blockProgress={blockProgress} /> : null}
        {vista === "planes" ? <PlanesTab plans={plans} activePlanId={activePlan.id} /> : null}

      </div>

      <h2 className="section-title">Tu progreso</h2>
      <ProgressSection
        planName={proposal.initialBlock?.name ?? activePlan.name}
        planId={activePlan.id}
        ownerId={ownerId}
        blockProgress={blockProgress}
        historyRepo={historyRepo}
        fullHistory={fullHistory}
        weekDoneCount={visibleOccurrences.filter((occurrence) => ["completed", "adapted", "partial"].includes(occurrence.status)).length}
        weekPlannedCount={visibleOccurrences.length}
        weekStartDate={weekStartDate}
        weekEndDate={weekEndDate}
      />
    </AppShell>
  );
}

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
          <li key={occurrenceRenderKey(occurrence)} className={rowClass.join(" ")}>
            <div className="dayrow__top">
              <div>
                <p className="dayrow__day">{WEEKDAY_LABEL[day]}{isToday ? " · hoy" : ""}</p>
                <p className="dayrow__title">{occurrence.status === "moved_away" ? `Se movió a ${WEEKDAY_LABEL[occurrence.movedToDay!]}` : occurrence.title}</p>
                <p className="dayrow__meta">
                  {occurrence.estimatedMinutes} min previstos
                  {occurrence.movedFromDay ? ` · recolocada desde ${WEEKDAY_LABEL[occurrence.movedFromDay].toLowerCase()}` : ""}
                </p>
              </div>
              <span className={`state state--${STATUS_CLASS[occurrence.status] ?? "planificada"}`}>{STATUS_LABEL[occurrence.status] ?? occurrence.status}</span>
            </div>
            {occurrence.editable && occurrence.status !== "moved_away" ? (
              <div className="dayrow__actions">
                {(() => {
                  const action = sessionAction(occurrence);
                  return action ? <Link href={action.href} className="chip chip--primary">{action.label}</Link> : null;
                })()}
                <PlanSessionActions planId={planId} weekStart={weekStart} sessionIndex={occurrence.sessionIndex} status={occurrence.status} currentDay={day} />
              </div>
            ) : null}
          </li>
        );
      })}
    </>
  );
}

/** Fases (nota 22 del prototipo): el modelo de datos actual solo guarda un único bloque
 * (`PlanProposal.initialBlock`), no una lista de fases con propósitos distintos
 * (adaptación/progresión/descarga/mantenimiento). Se muestra fiel a ese único bloque, sin
 * inventar fases que no existen en los datos — limitación declarada, no un recorte visual. */
function FasesTab({ proposal, blockProgress }: { proposal: PlanProposal; blockProgress: BlockProgress }) {
  const block = proposal.initialBlock;
  if (!block) {
    return <p className="lede small">Este plan no tiene un bloque generado todavía.</p>;
  }
  return (
    <>
      <div className="phasebar" role="img" aria-label={`Progresión de fases, semana ${blockProgress.currentWeek} de ${blockProgress.totalWeeks}`}>
        <div className="phaseseg phaseseg--current" style={{ flexGrow: block.weeks, flexBasis: 0 }}>{block.weeks} sem</div>
      </div>
      <ul className="phaselist">
        <li className="is-current">
          <div>
            <p className="phase__name">{block.name}</p>
            <p className="lede small">{block.purpose}</p>
          </div>
          <span className="phase__weeks">{block.weeks} semanas</span>
        </li>
      </ul>
      <p className="lede small">Este plan tiene una única fase activa: tu cuenta todavía no genera varias fases dentro de un mismo bloque.</p>
    </>
  );
}

function PlanesTab({ plans, activePlanId }: { plans: Awaited<ReturnType<typeof listPlansForOwner>>; activePlanId: string }) {
  return (
    <>
      <ul className="planlist">
        {plans.map((plan) => {
          const label = PLAN_STATUS_LABEL[plan.status] ?? plan.status;
          let meta = label;
          try {
            const planProposal = JSON.parse(plan.contentJson) as PlanProposal;
            if (planProposal.initialBlock?.weeks) meta += ` · ${planProposal.initialBlock.weeks} semanas`;
          } catch {
            // contentJson vacío o inválido para un borrador sin generar todavía: se muestra solo el estado.
          }
          return (
            <li key={plan.id} className="planrow">
              <div className="planrow__top">
                <div>
                  <p className="planrow__title">{plan.name}{plan.id === activePlanId ? " · este plan" : ""}</p>
                  <p className="planrow__meta">{meta}</p>
                </div>
                <span className={`state state--${PLAN_STATE_CLASS[plan.status] ?? plan.status}`}>{label}</span>
              </div>
              <PlanManagementActions planId={plan.id} planName={plan.name} isActive={plan.id === activePlanId} />
            </li>
          );
        })}
      </ul>
      <p className="lede small">Puedes conservar varios planes. Al activar uno nuevo, el actual quedará archivado para que las sesiones en curso sigan siendo coherentes.</p>
      <Link href="/onboarding?new=1" className="btn btn--ghost btn--block">Crear plan nuevo</Link>
    </>
  );
}

/** "Tu progreso" (nota: movido del prototipo a /plan, visible bajo cualquier pestaña):
 * progreso de bloque, figuras de la semana, carga semanal por bloque (reutiliza
 * historyRepo.computeWeeklyLoad, la misma fuente que Historial), evolución breve de una
 * frase (MVP-DEFINITION §6: "no gráficos densos"), actividad reciente y un logro. */
async function ProgressSection({
  planName, planId, ownerId, blockProgress, historyRepo, fullHistory, weekDoneCount, weekPlannedCount, weekStartDate, weekEndDate
}: {
  planName: string;
  planId: string;
  ownerId: string;
  blockProgress: BlockProgress;
  historyRepo: ReturnType<typeof createHistoryRepository>;
  fullHistory: FinishedSessionRow[];
  weekDoneCount: number;
  weekPlannedCount: number;
  weekStartDate: Date;
  weekEndDate: Date;
}) {
  const minutes = computeWeekMinutes(fullHistory, weekStartDate, weekEndDate);
  const consistencyWeeks = computeConsistencyWeeks(fullHistory);
  const weeklyLoad = await historyRepo.computeWeeklyLoad(ownerId, isoWeekStart());
  const note = evolutionNote(fullHistory);
  const recentActivity = (await historyRepo.listSessionHistory(ownerId, planId)).slice(0, 3);
  const adherence = await historyRepo.computeAdherence(ownerId, planId);
  const totalAdherencia = adherence ? adherence.completadas + adherence.adaptadas : 0;
  const achievements = pickAchievements(totalAdherencia);

  return (
    <>
      <p className="field__label">{planName}</p>
      <div className="blockprog">
        <div className="blockprog__track" role="img" aria-label={`Semana ${blockProgress.currentWeek} de ${blockProgress.totalWeeks} del ${planName.toLowerCase()}`}>
          <div className="blockprog__fill" style={{ width: `${blockProgress.percent}%` }} />
        </div>
        <p className="blockprog__label"><b>Semana {blockProgress.currentWeek}</b> de {blockProgress.totalWeeks}</p>
      </div>

      <div className="figures" aria-label="Resumen de la semana">
        <div className="figure"><p className="figure__num">{weekDoneCount}<span className="figure__of">/{weekPlannedCount}</span></p><p className="figure__label">sesiones</p></div>
        <div className="figure"><p className="figure__num">{minutes}<span className="figure__unit">min</span></p><p className="figure__label">activos</p></div>
        <div className="figure"><p className="figure__num">{consistencyWeeks}<span className="figure__unit">sem</span></p><p className="figure__label">de constancia</p></div>
      </div>

      <p className="field__label">Carga semanal por bloque</p>
      <div
        className="loadmap"
        role="img"
        aria-label={`Carga muscular de la semana: tren superior ${weeklyLoad.treSuperior} series, piernas ${weeklyLoad.piernas} series${weeklyLoad.resistenciaMinutos > 0 ? `, resistencia ${weeklyLoad.resistenciaMinutos} minutos` : ""}. No es un diagnóstico ni una medida de recuperación.`}
      >
        <div className="loadmap__crop">
          <Image className="loadmap__img" src={BODY_MAP_IMG} alt="" aria-hidden="true" width={640} height={800} priority={false} />
          <span className="loadmap__zone" style={{ top: "26%", left: "50%", background: loadColor(weeklyLoad.treSuperior), color: loadColor(weeklyLoad.treSuperior) }} aria-hidden="true" />
          <span className="loadmap__zone" style={{ top: "70%", left: "50%", background: loadColor(weeklyLoad.piernas), color: loadColor(weeklyLoad.piernas) }} aria-hidden="true" />
        </div>
        <ul className="loadmap__legend" aria-hidden="true">
          <li><span className="loadmap__dot" style={{ background: loadColor(weeklyLoad.treSuperior) }} />Tren superior · {weeklyLoad.treSuperior} series</li>
          <li><span className="loadmap__dot" style={{ background: loadColor(weeklyLoad.piernas) }} />Piernas · {weeklyLoad.piernas} series</li>
          <li className="loadmap__meta">{weeklyLoad.resistenciaMinutos > 0 ? `Resistencia · ${weeklyLoad.resistenciaMinutos} min` : "Resistencia · sin datos suficientes"}</li>
        </ul>
      </div>

      <p className="field__label">Cómo va</p>
      <p className="lede small">{note}</p>

      <p className="field__label">Actividad reciente</p>
      {recentActivity.length === 0 ? (
        <p className="lede small">Todavía no hay actividad registrada.</p>
      ) : (
        <ul className="log" aria-label="Actividad reciente">
          {recentActivity.map((entry) => (
            <li key={entry.id} className="log__item">
              <span className={`log__bar log__bar--${STATUS_CLASS[entry.status] ?? "planificada"}`} aria-hidden="true" />
              <div className="log__body">
                <p className="log__title">{entry.title}</p>
                <p className="log__meta">{WEEKDAY_LABEL[entry.day as Weekday] ?? entry.day} · {entry.startedAt.toLocaleDateString("es-ES")} · {STATUS_LABEL[entry.status] ?? entry.status}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {achievements.alcanzado ? (
        <p className="achievement"><span className="achievement__mark" aria-hidden="true">★</span>{achievements.alcanzado.label}. Logro privado, solo lo ves tú.</p>
      ) : achievements.cercano ? (
        <p className="achievement"><span className="achievement__mark" aria-hidden="true">★</span>{achievements.cercano.label}. Logro privado, solo lo ves tú.</p>
      ) : null}
    </>
  );
}
