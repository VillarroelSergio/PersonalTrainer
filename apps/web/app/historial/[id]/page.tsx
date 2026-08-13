import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db, sqlite } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { createHistoryRepository } from "@/features/history/domain/history-repository";
import { AppShell } from "@/components/AppShell";
import { DISCOMFORT_INTENSITY_OPTIONS, DISCOMFORT_ZONE_OPTIONS } from "@/features/onboarding/presentation/constants";

const STATUS_LABEL: Record<string, string> = { completed: "Completada", adapted: "Adaptada", partial: "Parcial", in_progress: "En curso" };
const ZONE_LABEL: Record<string, string> = Object.fromEntries(DISCOMFORT_ZONE_OPTIONS.map((option) => [option.value, option.label]));
const INTENSITY_LABEL: Record<string, string> = Object.fromEntries(DISCOMFORT_INTENSITY_OPTIONS.map((option) => [option.value, option.label]));
const SPORT_LABEL: Record<string, string> = { running: "Correr", cycling: "Bici", walking: "Caminar", other: "Otra actividad" };
const METRIC_LABEL: Record<string, string> = {
  avg_pace_sec_per_km: "Ritmo medio", avg_heart_rate: "FC media", max_heart_rate: "FC máx.",
  elevation_gain_m: "Desnivel", avg_cadence: "Cadencia media", avg_power: "Potencia media", estimated_load: "Carga estimada"
};

// C4 (checkin.js / history.js): mismo aviso literal de molestia importante, reutilizado tal cual aquí.
// La molestia es señal declarada por la persona, nunca un diagnóstico: nunca se infiere intensidad, zona ni causa.
const SAFETY_TEXT = "Molestia importante: esto no es un diagnóstico. Si la molestia persiste o es intensa, " +
  "considera detener o adaptar la sesión y consultar a un profesional de salud.";

export default async function HistoryEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const ownerId = session.user.id;

  const activePlan = await findActivePlanForOwner(db, ownerId);
  if (!activePlan) redirect("/onboarding");

  const { id } = await params;
  const historyRepo = createHistoryRepository(db, sqlite);

  const sessionDetail = historyRepo.getSessionDetail(ownerId, activePlan.id, id);
  if (sessionDetail) return <StrengthDetail detail={sessionDetail} />;

  const activityDetail = historyRepo.getEnduranceActivityDetail(ownerId, id);
  if (activityDetail) return <EnduranceDetail activity={activityDetail} />;

  notFound();
}

function StrengthDetail({ detail }: { detail: NonNullable<ReturnType<ReturnType<typeof createHistoryRepository>["getSessionDetail"]>> }) {
  return (
    <AppShell title="Trainer" backHref="/historial">
      <p className="kicker">Fuerza · {detail.startedAt.toLocaleDateString("es-ES")}</p>
      <h1 className="view-title">{detail.title}</h1>
      <p className="lede small">{STATUS_LABEL[detail.status] ?? detail.status}{detail.day ? ` · ${detail.day}` : ""}</p>

      {detail.exercises.length === 0 ? (
        <p className="lede small">Sin ejercicios registrados para esta sesión.</p>
      ) : (
        <>
          <h2 className="section-title">Ejercicio / variante — carga, repeticiones y series</h2>
          <ul className="cues">
            {detail.exercises.map((exercise) => (
              <li key={exercise.variantId}>
                {exercise.exerciseName}{exercise.variantName ? ` — ${exercise.variantName}` : ""}: {exercise.sets.length === 0 ? "sin series registradas" : exercise.sets.map((set) => `${set.loadKg != null ? `${set.loadKg} kg` : "peso corporal"} × ${set.repetitions ?? "—"} reps`).join(", ")}
              </li>
            ))}
          </ul>
        </>
      )}

      {detail.comment && (
        <>
          <h2 className="section-title">Comentario al cerrar</h2>
          <p className="lede small">{detail.comment}</p>
        </>
      )}

      {detail.discomfort && (
        <>
          <h2 className="section-title">Molestia declarada al cerrar</h2>
          <p className="lede small">{ZONE_LABEL[detail.discomfort.zone] ?? detail.discomfort.zone} · {INTENSITY_LABEL[detail.discomfort.intensity] ?? detail.discomfort.intensity}</p>
          {detail.discomfort.intensity === "important" && <p className="notice notice--warn" role="alert">{SAFETY_TEXT}</p>}
        </>
      )}

      {/* ponytail: "Corregir registro" (history.js openCorrectionSheet) exige guardar una versión nueva
         conservando la original. workout_session no tiene esquema de versionado (ver schema.ts): no se
         inventa aquí. Pendiente — requiere un cambio de contrato de datos fuera de alcance. */}
      <p className="lede small">Corrección versionada: pendiente. El modelo de datos actual no guarda versiones anteriores de una sesión, así que corregir un registro requeriría un cambio de contrato de datos fuera del alcance de este cambio.</p>

      <p className="lede small"><Link href="/historial">← Volver al historial</Link></p>
    </AppShell>
  );
}

function EnduranceDetail({ activity }: { activity: NonNullable<ReturnType<ReturnType<typeof createHistoryRepository>["getEnduranceActivityDetail"]>> }) {
  const durationMin = activity.durationS != null ? Math.round(activity.durationS / 60) : null;
  const distanceKm = activity.distanceM != null ? (activity.distanceM / 1000).toFixed(1) : null;

  return (
    <AppShell title="Trainer" backHref="/historial">
      <p className="kicker">Cardio · {activity.startedAt.toLocaleDateString("es-ES")}</p>
      <h1 className="view-title">{activity.name}</h1>
      <p className="lede small">{SPORT_LABEL[activity.sport] ?? activity.sport} · {activity.source === "imported" ? "Importada del reloj" : "Registrada en la app"}</p>

      <h2 className="section-title">Actividad</h2>
      {durationMin == null && distanceKm == null && activity.metrics.length === 0 ? (
        <p className="lede small">No hay más datos disponibles de este registro (nunca se inventan).</p>
      ) : (
        <ul className="cues">
          {durationMin != null && <li>Duración: {durationMin} min</li>}
          {distanceKm != null && <li>Distancia: {distanceKm} km</li>}
          {activity.metrics.map((metric) => (
            <li key={metric.metricType}>{METRIC_LABEL[metric.metricType] ?? metric.metricType}: {metric.value} {metric.unit}</li>
          ))}
        </ul>
      )}

      <p className="lede small">Corrección versionada: pendiente. El modelo de datos actual no guarda versiones anteriores de una actividad, así que corregir un registro requeriría un cambio de contrato de datos fuera del alcance de este cambio.</p>

      <p className="lede small"><Link href="/historial">← Volver al historial</Link></p>
    </AppShell>
  );
}
