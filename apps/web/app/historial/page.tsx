import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db, sqlite } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { createHistoryRepository } from "@/features/history/domain/history-repository";
import { listOwnedBodyMetrics } from "@/features/history/domain/body-metrics-repository";
import { computeMetricTrend, pickAchievements } from "@/features/history/domain/history-engine";
import { AddMetricForm } from "@/features/history/ui/AddMetricForm";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_LABEL, isoDate, isoWeekStart, parseIsoDateLocal, type Weekday } from "@/lib/weekdays";

const TABS = [
  { key: "registro", label: "Fuerza" },
  { key: "progreso", label: "Progreso" },
  { key: "adherencia", label: "Adherencia y logros" },
  { key: "metricas", label: "Métricas" }
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATUS_LABEL: Record<string, string> = { completed: "Completada", adapted: "Adaptada", partial: "Parcial", in_progress: "En curso" };
const STATUS_BAR: Record<string, string> = { completed: "completada", adapted: "adaptada", partial: "parcial", in_progress: "en_curso" };

export default async function HistorialPage({ searchParams }: { searchParams: Promise<{ tab?: string; estado?: string; semana?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const ownerId = session.user.id;

  const activePlan = await findActivePlanForOwner(db, ownerId);
  if (!activePlan) redirect("/onboarding");

  const { tab: rawTab, estado, semana } = await searchParams;
  const tab: TabKey = TABS.some((item) => item.key === rawTab) ? (rawTab as TabKey) : "registro";

  const historyRepo = createHistoryRepository(db, sqlite);

  return (
    <AppShell title="Trainer">
      <h1 className="view-title">Historial</h1>
      <p className="lede small">Tu evolución en resúmenes concretos, sin panel analítico denso.</p>

      <div className="tabs" role="tablist" aria-label="Secciones del historial">
        {TABS.map((item) => (
          <Link key={item.key} href={`/historial?tab=${item.key}`} className="tab" role="tab" aria-selected={tab === item.key} id={`historyTab-${item.key}`}>
            {item.label}
          </Link>
        ))}
      </div>

      <div className="tabpanel" role="tabpanel" aria-labelledby={`historyTab-${tab}`}>
        {tab === "registro" && <RegistroTab ownerId={ownerId} planId={activePlan.id} estado={estado} semana={semana} historyRepo={historyRepo} />}
        {tab === "progreso" && <ProgresoTab historyRepo={historyRepo} ownerId={ownerId} />}
        {tab === "adherencia" && <AdherenciaTab historyRepo={historyRepo} ownerId={ownerId} planId={activePlan.id} />}
        {tab === "metricas" && <MetricasTab ownerId={ownerId} />}
      </div>
    </AppShell>
  );
}

function RegistroTab({ ownerId, planId, estado, semana, historyRepo }: { ownerId: string; planId: string; estado?: string; semana?: string; historyRepo: ReturnType<typeof createHistoryRepository> }) {
  const allSessions = historyRepo.listSessionHistory(ownerId, planId);
  const filteredByStatus = estado ? allSessions.filter((session) => session.status === estado) : allSessions;
  const filteredByWeek = semana ? filteredByStatus.filter((session) => isoWeekStart(session.startedAt) === semana) : filteredByStatus;

  const prevWeek = isoDate(addDays(parseIsoDateLocal(semana ?? isoWeekStart()), -7));
  const nextWeek = isoDate(addDays(parseIsoDateLocal(semana ?? isoWeekStart()), 7));

  const enduranceActivities = historyRepo.listEnduranceActivities(ownerId);
  const filteredEndurance = semana ? enduranceActivities.filter((activity) => isoWeekStart(activity.startedAt) === semana) : enduranceActivities;

  return (
    <>
      <p className="field__label">Estado</p>
      <div className="picker picker--wide" role="group" aria-label="Filtrar por estado">
        <Link href={`/historial?tab=registro${semana ? `&semana=${semana}` : ""}`} className="chip" aria-disabled={!estado}>Todos</Link>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <Link key={value} href={`/historial?tab=registro&estado=${value}${semana ? `&semana=${semana}` : ""}`} className="chip" aria-disabled={estado === value}>{label}</Link>
        ))}
      </div>

      <p className="field__label">Semana</p>
      <div className="picker" role="group" aria-label="Filtrar por semana">
        <Link href={`/historial?tab=registro${estado ? `&estado=${estado}` : ""}&semana=${prevWeek}`} className="chip">← Semana anterior</Link>
        <Link href={`/historial?tab=registro${estado ? `&estado=${estado}` : ""}&semana=${nextWeek}`} className="chip">Semana siguiente →</Link>
        {semana && <Link href={`/historial?tab=registro${estado ? `&estado=${estado}` : ""}`} className="chip">Ver todo</Link>}
      </div>

      {filteredByWeek.length === 0 ? (
        <p className="lede small">Todavía no hay sesiones registradas con estos filtros.</p>
      ) : (
        <ul className="log" aria-label="Sesiones registradas">
          {filteredByWeek.map((entry) => (
            <li key={entry.id} className="log__item">
              <span className={`log__bar log__bar--${STATUS_BAR[entry.status] ?? "planificada"}`} aria-hidden="true" />
              <div className="log__body">
                <p className="log__title">{entry.title}</p>
                <p className="log__meta">
                  {WEEKDAY_LABEL[entry.day as Weekday] ?? entry.day} · {entry.startedAt.toLocaleDateString("es-ES")} · {STATUS_LABEL[entry.status] ?? entry.status}
                  {entry.globalEffort != null ? ` · esfuerzo ${entry.globalEffort}/10` : ""}
                </p>
                {entry.comment && <p className="log__meta">{entry.comment}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="field__label">Exterior</p>
      {filteredEndurance.length === 0 ? (
        <p className="lede small">Todavía no hay actividad exterior importada con estos filtros.</p>
      ) : (
        <ul className="log" aria-label="Actividad exterior">
          {filteredEndurance.map((activity) => (
            <li key={activity.id} className="log__item">
              <span className="log__bar log__bar--completada" aria-hidden="true" />
              <div className="log__body">
                <p className="log__title">{activity.name}</p>
                <p className="log__meta">
                  {activity.startedAt.toLocaleDateString("es-ES")} · {SPORT_LABEL[activity.sport] ?? activity.sport} · {activity.source === "imported" ? "importada" : "manual"}
                  {activity.durationS != null ? ` · ${Math.round(activity.durationS / 60)} min` : ""}
                  {activity.distanceM != null ? ` · ${(activity.distanceM / 1000).toFixed(1)} km` : ""}
                </p>
                {activity.metrics.length > 0 && (
                  <p className="log__meta">{activity.metrics.map((metric) => `${METRIC_LABEL[metric.metricType] ?? metric.metricType}: ${metric.value} ${metric.unit}`).join(" · ")}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const SPORT_LABEL: Record<string, string> = { running: "Correr", cycling: "Bici", walking: "Caminar", other: "Otra actividad" };
const METRIC_LABEL: Record<string, string> = {
  avg_pace_sec_per_km: "Ritmo medio", avg_heart_rate: "FC media", max_heart_rate: "FC máx.",
  elevation_gain_m: "Desnivel", avg_cadence: "Cadencia media", avg_power: "Potencia media", estimated_load: "Carga estimada"
};

function ProgresoTab({ historyRepo, ownerId }: { historyRepo: ReturnType<typeof createHistoryRepository>; ownerId: string }) {
  const progress = historyRepo.listVariantProgress(ownerId);

  if (progress.length === 0) {
    return <p className="lede small">Todavía no hay progresión: se calcula automáticamente al cerrar sesiones de fuerza.</p>;
  }

  return (
    <div aria-label="Progresión por ejercicio">
      {progress.map((entry) => (
        <div key={entry.variantId} className="progressrow">
          <span>
            {entry.exerciseName} — {entry.variantName}
            <br />
            <span className="log__meta">
              {entry.hasBaseline ? `Última: ${entry.lastLoadKg != null ? `${entry.lastLoadKg} kg` : "peso corporal"}${entry.lastRepetitions != null ? ` × ${entry.lastRepetitions}` : ""}` : "Sin exposiciones todavía"}
            </span>
            <br />
            <span className="log__meta">{entry.suggestionReason}</span>
          </span>
          <b>{Math.round(entry.confidence)}%</b>
        </div>
      ))}
    </div>
  );
}

function AdherenciaTab({ historyRepo, ownerId, planId }: { historyRepo: ReturnType<typeof createHistoryRepository>; ownerId: string; planId: string }) {
  const adherence = historyRepo.computeAdherence(ownerId, planId);
  const weeklyLoad = historyRepo.computeWeeklyLoad(ownerId, isoWeekStart());
  const totalAdherencia = adherence ? adherence.completadas + adherence.adaptadas : 0;
  const achievements = pickAchievements(totalAdherencia);

  return (
    <>
      <h2 className="section-title">Carga semanal (esta semana)</h2>
      <p className="lede small">Series de fuerza y minutos de resistencia registrados esta semana. Resistencia solo cuenta actividad guardada (manual o importada) con duración conocida.</p>
      <div className="figures" aria-label="Carga semanal por categoría">
        <div className="figure"><p className="figure__num">{weeklyLoad.piernas}</p><p className="figure__label">series · piernas</p></div>
        <div className="figure"><p className="figure__num">{weeklyLoad.treSuperior}</p><p className="figure__label">series · tren superior</p></div>
        <div className="figure"><p className="figure__num">{weeklyLoad.resistenciaMinutos > 0 ? weeklyLoad.resistenciaMinutos : "—"}</p><p className="figure__label">{weeklyLoad.resistenciaMinutos > 0 ? "min · resistencia" : "resistencia · sin datos suficientes"}</p></div>
      </div>

      <h2 className="section-title">Adherencia (todo el historial)</h2>
      <p className="lede small">Completada y adaptada suman adherencia. Parcial y omitida se conservan en el historial, sin sumar hito. Recolocada es una sesión que aceptaste mover a otro día.</p>
      {adherence ? (
        <>
          <div className="figures" aria-label="Adherencia acumulada">
            <div className="figure"><p className="figure__num">{adherence.previstas}</p><p className="figure__label">previstas</p></div>
            <div className="figure"><p className="figure__num">{adherence.completadas}</p><p className="figure__label">completadas</p></div>
            <div className="figure"><p className="figure__num">{adherence.adaptadas}</p><p className="figure__label">adaptadas</p></div>
          </div>
          <div className="figures" aria-label="Parciales, omitidas y recolocadas">
            <div className="figure"><p className="figure__num">{adherence.parciales}</p><p className="figure__label">parciales · no suman</p></div>
            <div className="figure"><p className="figure__num">{adherence.omitidas}</p><p className="figure__label">omitidas · no suman</p></div>
            <div className="figure"><p className="figure__num">{adherence.recolocadas}</p><p className="figure__label">recolocadas</p></div>
          </div>
        </>
      ) : (
        <p className="lede small">Sin datos suficientes todavía.</p>
      )}

      <h2 className="section-title">Logros</h2>
      <p className="lede small">Privados y discretos. Nunca se basan solo en calorías o peso, y no hay rankings ni comparación con otras personas.</p>
      {achievements.alcanzado && (
        <p className="achievement"><span className="achievement__mark" aria-hidden="true">★</span>Alcanzado: {achievements.alcanzado.label}. Logro privado, solo lo ves tú.</p>
      )}
      {achievements.cercano && (
        <p className="achievement"><span className="achievement__mark" aria-hidden="true">★</span>Cercano: {achievements.cercano.label}. Logro privado, solo lo ves tú.</p>
      )}
      {!achievements.alcanzado && !achievements.cercano && <p className="lede small">Todavía no hay logros. Vuelven a aparecer aquí en cuanto registres sesiones.</p>}
    </>
  );
}

async function MetricasTab({ ownerId }: { ownerId: string }) {
  const metrics = await listOwnedBodyMetrics(db, ownerId);

  const weights = metrics.filter((metric) => metric.kind === "weight").map((metric) => ({ value: metric.value, unit: metric.unit, measuredAt: metric.measuredAt }));
  const weightTrend = computeMetricTrend(weights);

  return (
    <>
      <p className="notice notice--info">Registrar peso o medidas es opcional y no condiciona las recomendaciones de tu próxima sesión. No hay conteo de calorías, dietas ni recomendaciones de suplementos, ni IMC, grasa corporal o peso ideal.</p>

      {weightTrend && (
        <>
          <p className="field__label">Tendencia de peso</p>
          <p className="lede small">{weightTrend.text}</p>
        </>
      )}

      {metrics.length === 0 ? (
        <p className="lede small">Todavía no hay métricas registradas.</p>
      ) : (
        <ul className="log" aria-label="Métricas registradas">
          {[...metrics].reverse().map((metric) => (
            <li key={metric.id} className="log__item">
              <span className="log__bar log__bar--condatos" aria-hidden="true" />
              <div className="log__body">
                <p className="log__title">{metric.kind === "weight" ? "Peso" : `Medida${metric.zone ? ` · ${metric.zone}` : ""}`}</p>
                <p className="log__meta">{metric.value} {metric.unit} · {metric.measuredAt}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddMetricForm />
    </>
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
