"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { OfflineRouteBoundary } from "@/features/offline/ui/OfflineRouteBoundary";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import {
  computeAdherenceView,
  computeWeekStatsView,
  listEnduranceActivitiesView,
  listSessionHistoryView,
  listVariantProgressView
} from "@/features/history/domain/historial-view";
import { pickAchievements } from "@/features/history/domain/history-engine";
import type { EnduranceActivityEntry, SessionHistoryEntry, VariantProgressEntry } from "@/features/history/domain/history-repository";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_LABEL, isoDate, isoWeekStart, parseIsoDateLocal, type Weekday } from "@/lib/weekdays";
import { exerciseMediaAlt, exerciseMediaSrc, findVariant } from "@/features/catalog/data/exercise-catalog";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";

const TABS = [
  { key: "registro", label: "Fuerza y cardio" },
  { key: "adherencia", label: "Adherencia y logros" }
] as const;
type TabKey = (typeof TABS)[number]["key"];

const STATUS_LABEL: Record<string, string> = { completed: "Completada", adapted: "Adaptada", partial: "Parcial", in_progress: "En curso" };
const STATUS_BAR: Record<string, string> = { completed: "completada", adapted: "adaptada", partial: "parcial", in_progress: "en_curso" };
const SPORT_LABEL: Record<string, string> = { running: "Correr", cycling: "Bici", walking: "Caminar", other: "Otra actividad" };

export default function HistorialPage() {
  return (
    <Suspense fallback={null}>
      <HistorialPageInner />
    </Suspense>
  );
}

function HistorialPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = authClient.useSession();
  const offlineData = useOfflineData();

  useEffect(() => {
    if (!session.isPending && !session.data?.user) router.replace("/login");
  }, [session.isPending, session.data?.user, router]);

  useEffect(() => {
    if (offlineData.snapshot && offlineData.snapshot.data.activePlan == null) router.replace("/onboarding");
  }, [offlineData.snapshot, router]);

  const rawTab = searchParams.get("tab") ?? undefined;
  const semana = searchParams.get("semana") ?? undefined;
  const tab: TabKey = TABS.some((item) => item.key === rawTab) ? (rawTab as TabKey) : "registro";

  return (
    <AppShell title="Trainer">
      <OfflineRouteBoundary>
        {offlineData.snapshot && offlineData.snapshot.data.activePlan != null ? (
          <HistorialContent snapshot={offlineData.snapshot} tab={tab} semana={semana} />
        ) : null}
      </OfflineRouteBoundary>
    </AppShell>
  );
}

function HistorialContent({ snapshot, tab, semana }: { snapshot: OfflineSnapshot; tab: TabKey; semana?: string }) {
  const activePlan = snapshot.data.activePlan as { id: string };

  return (
    <>
      <div className="history-heading">
        <div>
          <h1 className="view-title">Historial</h1>
          <p className="lede small">Lo que has hecho, sin métricas de relleno.</p>
        </div>
        <Link href="/importar" className="history-heading__action">Añadir actividad</Link>
      </div>

      <div className="tabs" role="tablist" aria-label="Secciones del historial">
        {TABS.map((item) => (
          <Link key={item.key} href={`/historial?tab=${item.key}`} className="tab" role="tab" aria-selected={tab === item.key} aria-controls="historyPanel" id={`historyTab-${item.key}`}>
            {item.label}
          </Link>
        ))}
      </div>

      <div id="historyPanel" className="tabpanel" role="tabpanel" aria-labelledby={`historyTab-${tab}`}>
        {tab === "registro" && <RegistroTab snapshot={snapshot} planId={activePlan.id} semana={semana} />}
        {tab === "adherencia" && <AdherenciaTab snapshot={snapshot} planId={activePlan.id} />}
      </div>
    </>
  );
}

type TimelineEntry = { id: string; kind: "fuerza" | "resistencia"; title: string; startedAt: Date; barClass: string; meta: string };

function buildTimeline(sessions: SessionHistoryEntry[], activities: EnduranceActivityEntry[]): TimelineEntry[] {
  const strength: TimelineEntry[] = sessions.map((entry) => ({
    id: entry.id,
    kind: "fuerza",
    title: entry.title,
    startedAt: entry.startedAt,
    barClass: STATUS_BAR[entry.status] ?? "planificada",
    meta: `${WEEKDAY_LABEL[entry.day as Weekday] ?? entry.day} · ${entry.startedAt.toLocaleDateString("es-ES")} · ${STATUS_LABEL[entry.status] ?? entry.status}`
  }));
  const endurance: TimelineEntry[] = activities.map((activity) => ({
    id: activity.id,
    kind: "resistencia",
    title: activity.name,
    startedAt: activity.startedAt,
    barClass: "completada",
    meta: `${activity.startedAt.toLocaleDateString("es-ES")}${activity.durationS != null ? ` · ${Math.round(activity.durationS / 60)} min` : ""} · ${SPORT_LABEL[activity.sport] ?? activity.sport}`
  }));
  return [...strength, ...endurance].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

function RegistroTab({ snapshot, planId, semana }: { snapshot: OfflineSnapshot; planId: string; semana?: string }) {
  const allSessions = listSessionHistoryView(snapshot, planId);
  const enduranceActivities = listEnduranceActivitiesView(snapshot);
  const progress = listVariantProgressView(snapshot);

  const selectedWeek = semana ?? isoWeekStart();
  const filteredSessions = allSessions.filter((session) => isoWeekStart(session.startedAt) === selectedWeek);

  const prevWeek = isoDate(addDays(parseIsoDateLocal(selectedWeek), -7));
  const nextWeek = isoDate(addDays(parseIsoDateLocal(selectedWeek), 7));

  const filteredEndurance = enduranceActivities.filter((activity) => isoWeekStart(activity.startedAt) === selectedWeek);

  const timeline = buildTimeline(filteredSessions, filteredEndurance);
  const thisWeek = isoWeekStart();
  const periodLabel = selectedWeek === thisWeek ? "Esta semana" : `Semana del ${parseIsoDateLocal(selectedWeek).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;

  return (
    <>
      <nav className="history-period" aria-label="Semana mostrada">
        <Link href={`/historial?tab=registro&semana=${prevWeek}`} aria-label="Semana anterior">←</Link>
        <Link href="/historial?tab=registro" className={selectedWeek === thisWeek ? "is-current" : ""}>{periodLabel}</Link>
        <Link href={`/historial?tab=registro&semana=${nextWeek}`} aria-label="Semana siguiente">→</Link>
      </nav>

      {timeline.length === 0 ? (
        <p className="lede small">Aún no hay actividad esta semana.</p>
      ) : (
        <ul className="log" aria-label="Cronología de actividad">
          {timeline.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`} className="log__item">
              <span className={`log__bar log__bar--${entry.barClass}`} aria-hidden="true" />
              <div className="log__body">
                <p className="log__title">{entry.kind === "fuerza" ? "Fuerza" : "Resistencia"} · {entry.title}</p>
                <p className="log__meta">{entry.meta}</p>
                <Link href={`/historial/${entry.id}`} className="chip chip--compact">Ver detalle</Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProgresoSection progress={progress} />
    </>
  );
}

function ProgresoSection({ progress }: { progress: VariantProgressEntry[] }) {
  if (progress.length === 0) return null;

  return (
    <>
      <p className="field__label">Progresión</p>
      <div aria-label="Progresión por ejercicio">
      {progress.slice(0, 2).map((entry) => (
        <div key={entry.variantId} className="progressrow">
          {findVariant(entry.variantId) ? (
            <Image className="progressrow__media" src={exerciseMediaSrc(findVariant(entry.variantId)!)} alt={exerciseMediaAlt(findVariant(entry.variantId)!)} width={44} height={44} />
          ) : (
            <Image className="progressrow__media" src="/library/groups/core-card-v1.webp" alt={`${entry.exerciseName} — ${entry.variantName}`} width={44} height={44} />
          )}
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
    </>
  );
}

function AdherenciaTab({ snapshot, planId }: { snapshot: OfflineSnapshot; planId: string }) {
  const adherence = computeAdherenceView(snapshot, planId);
  const weekStats = computeWeekStatsView(snapshot, planId);
  const totalAdherencia = adherence ? adherence.completadas + adherence.adaptadas : 0;
  const achievements = pickAchievements(totalAdherencia);
  const achievementText = achievements.alcanzado
    ? `Alcanzado: ${achievements.alcanzado.label}.`
    : achievements.cercano
      ? `${achievements.cercano.label}.`
      : null;

  return (
    <>
      {weekStats ? (
        <div className="figures" aria-label="Resumen de constancia">
          <div className="figure"><p className="figure__num">{weekStats.hechas}/{weekStats.previstas}</p><p className="figure__label">sesiones esta semana</p></div>
          <div className="figure"><p className="figure__num">{weekStats.constancia}</p><p className="figure__label">sem. de constancia</p></div>
        </div>
      ) : (
        <p className="lede small">Sin datos suficientes todavía.</p>
      )}

      {achievementText ? (
        <p className="achievement"><span className="achievement__mark" aria-hidden="true">★</span>{achievementText} Privado, solo lo ves tú.</p>
      ) : (
        <p className="lede small">Todavía no hay logros. Aparecen aquí en cuanto registres sesiones.</p>
      )}
    </>
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
