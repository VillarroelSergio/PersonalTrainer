"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ENDURANCE_OBJECTIVES, findEnduranceObjective } from "@/features/endurance/data/objectives";
import { ImportActivityEntry } from "@/features/endurance/ui/ImportActivityEntry";
import { saveEnduranceDesignOffline } from "@/features/endurance/domain/endurance-design-offline";
import { createClientId } from "@/lib/client-id";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { useOfflineSyncContext } from "@/lib/offline/OfflineSyncContext";
import type { EnduranceEnvironment, EnduranceObjective } from "@/contracts/endurance";
import { WEEKDAY_LABEL, WEEKDAYS, type Weekday } from "@/lib/weekdays";

type DesignState = { id: string; objective: EnduranceObjective; environment: EnduranceEnvironment | null; optionalLayers: Record<string, string>; watchPreparedAt: string | null };

const ENVIRONMENTS: Array<{ value: EnduranceEnvironment; label: string }> = [
  { value: "outdoors", label: "Exterior" }, { value: "treadmill", label: "Cinta" }, { value: "stationary_bike", label: "Bici estática" }, { value: "home", label: "Casa" }
];
const OPTIONAL_FIELDS: Array<[string, string]> = [
  ["duracionMin", "Duración (min)"], ["distanciaKm", "Distancia (km)"], ["ritmo", "Ritmo"],
  ["rpe", "RPE (1-10)"], ["desnivel", "Desnivel (m)"], ["superficie", "Superficie"], ["fcZona", "Zona de FC"]
];

/** Default minutes to reduce/extend from when no `duracionMin` optional layer is set yet — first number in the objective's editorial duration range (e.g. "30-50 min" -> 30). */
function baselineMinutes(durationText: string): number {
  const match = durationText.match(/\d+/);
  return match ? Number(match[0]) : 30;
}

export function EnduranceDesigner({
  planId,
  sessionIndex,
  isoWeekStart,
  initialDesign,
  conflictText
}: {
  planId: string;
  sessionIndex: number;
  isoWeekStart: string;
  initialDesign: DesignState | null;
  /** Prose from `weeklyLoadWarning` (features/planning/domain/plan-week.ts) when this session sits next to a legs-heavy strength day, or null. */
  conflictText: string | null;
}) {
  const router = useRouter();
  const [design, setDesign] = useState<DesignState | null>(initialDesign);
  const [pickingObjective, setPickingObjective] = useState(!initialDesign);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustSheet, setAdjustSheet] = useState<"closed" | "root" | "environment" | "move">("closed");
  const offlineData = useOfflineData();
  const sync = useOfflineSyncContext();

  async function persistDesign(next: { objective: EnduranceObjective; environment?: EnduranceEnvironment | null; optionalLayers?: Record<string, string> }) {
    setSaving(true);
    setError(null);
    const input = { isoWeekStart, sessionIndex, objective: next.objective, environment: next.environment ?? undefined, optionalLayers: next.optionalLayers ?? {} };
    let response: Response;
    try {
      response = await fetch("/api/v1/endurance-designs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });
    } catch {
      // Network failure (not a server rejection): apply the design locally and queue it — the
      // change IS saved, just not synced yet, same treatment as CheckinRunner/PlanSessionActions.
      setSaving(false);
      if (offlineData.snapshot) {
        const result = saveEnduranceDesignOffline(offlineData.snapshot, input, createClientId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
        const saved: DesignState = {
          id: result.row.id,
          objective: result.row.objective as EnduranceObjective,
          environment: result.row.environment as EnduranceEnvironment | null,
          optionalLayers: next.optionalLayers ?? {},
          watchPreparedAt: null
        };
        setDesign(saved);
        return saved;
      }
      setError("No pudimos guardar tu propuesta.");
      return null;
    }
    setSaving(false);
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "No pudimos guardar tu propuesta.");
      return null;
    }
    const saved: DesignState = { id: body.data.id, objective: body.data.objective, environment: body.data.environment, optionalLayers: next.optionalLayers ?? {}, watchPreparedAt: null };
    setDesign(saved);
    return saved;
  }

  async function chooseObjective(objective: EnduranceObjective) {
    const saved = await persistDesign({ objective, environment: design?.environment ?? undefined });
    if (saved) setPickingObjective(false);
  }

  async function saveEnvironment(environment: EnduranceEnvironment) {
    if (!design) return;
    await persistDesign({ objective: design.objective, environment, optionalLayers: design.optionalLayers });
    setAdjustSheet("closed");
  }

  async function reduceDuration() {
    if (!design) return;
    const template = findEnduranceObjective(design.objective)!;
    const current = Number(design.optionalLayers.duracionMin) || baselineMinutes(template.durationText);
    const reduced = Math.max(10, Math.round(current * 0.6));
    await persistDesign({ objective: design.objective, environment: design.environment, optionalLayers: { ...design.optionalLayers, duracionMin: String(reduced) } });
    setAdjustSheet("closed");
  }

  async function addRepetition() {
    if (!design) return;
    const template = findEnduranceObjective(design.objective)!;
    const currentDuration = Number(design.optionalLayers.duracionMin) || baselineMinutes(template.durationText);
    const currentReps = Number(design.optionalLayers.repeticionesExtra) || 0;
    await persistDesign({
      objective: design.objective,
      environment: design.environment,
      optionalLayers: { ...design.optionalLayers, duracionMin: String(currentDuration + 5), repeticionesExtra: String(currentReps + 1) }
    });
    setAdjustSheet("closed");
  }

  async function changeToRecovery() {
    if (!design) return;
    await persistDesign({ objective: "recovery", environment: design.environment, optionalLayers: {} });
    setAdjustSheet("closed");
  }

  async function moveToDay(targetDay: Weekday) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/plans/${planId}/session-edits`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "move", isoWeekStart, sessionIndex, targetDay })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "No pudimos mover la sesión.");
      setAdjustSheet("closed");
      router.push("/plan");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos mover la sesión.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmWatchPrep() {
    if (!design) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/endurance-designs/${design.id}/watch-prep`, { method: "POST", credentials: "same-origin" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "No pudimos confirmar la preparación.");
      setDesign((current) => (current ? { ...current, watchPreparedAt: body.data.watchPreparedAt } : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos confirmar la preparación.");
    } finally {
      setSaving(false);
    }
  }

  const errorNotice = error ? <p className="notice notice--warn" role="alert">{error}</p> : null;

  if (pickingObjective || !design) {
    return (
      <section className="view-endurance">
        {errorNotice}
        <p className="lede small">Elige un objetivo. Trainer diseña los bloques; tú la creas manualmente en tu reloj y la haces fuera de la app.</p>
        {ENDURANCE_OBJECTIVES.map((objective) => (
          <button key={objective.id} type="button" className="opt" disabled={saving} onClick={() => chooseObjective(objective.id)}>
            <span className="opt__name">{objective.name}</span>
            <span className="opt__meta">{objective.durationText} · {objective.intensityText}</span>
          </button>
        ))}
      </section>
    );
  }

  const template = findEnduranceObjective(design.objective)!;
  const hasStructure = !!template.structure;
  const durationOverride = design.optionalLayers.duracionMin;
  const repeticionesExtra = Number(design.optionalLayers.repeticionesExtra) || 0;

  return (
    <section className="view-endurance">
      {errorNotice}

      {conflictText ? (
        <div className="notice notice--warn">
          <p>{conflictText}</p>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setAdjustSheet("root")}>Ver alternativa explicada</button>
        </div>
      ) : null}

      <div className="endurance-brief">
        <p className="endurance-brief__line">Objetivo: {template.name}</p>
        <p className="endurance-brief__line">Duración total estimada: {durationOverride ? `${durationOverride} min` : template.durationText}</p>
        <p className="endurance-brief__line">Intensidad: {template.intensityText}</p>
        <p className="endurance-brief__line">Para qué sirve: {template.purpose}</p>
        {repeticionesExtra > 0 ? <p className="endurance-brief__line">Repeticiones añadidas: {repeticionesExtra}</p> : null}
      </div>

      {template.structure ? (
        <ol className="segments">
          {template.structure.map((entry, index) =>
            entry.type === "group" ? (
              <li key={index} className="segment segment--grupo">
                <p className="segment__name">Repite {entry.repeat}{repeticionesExtra > 0 ? ` + ${repeticionesExtra}` : ""} veces</p>
                <p className="segment__meta">{entry.work.label}: {entry.work.durationMin} min · {entry.work.intensityText}</p>
                <p className="segment__meta">{entry.recovery.label}: {entry.recovery.durationMin} min · {entry.recovery.intensityText}</p>
              </li>
            ) : (
              <li key={index} className={`segment segment--${entry.kind}`}>
                <div className="segment__head">
                  <span className="segment__name">{entry.label}</span>
                </div>
                <p className="segment__meta">{entry.durationMin} min · {entry.intensityText}</p>
              </li>
            )
          )}
        </ol>
      ) : (
        <div className="endurance-continuous">
          <p className="field__label">Sesión continua: sin tramos</p>
          <p className="lede">{template.intensityText}</p>
        </div>
      )}

      <p className="field__label">Entorno</p>
      <div className="picker picker--wide" role="group" aria-label="Entorno">
        {ENVIRONMENTS.map((env) => (
          <button key={env.value} type="button" className="picker__btn" aria-pressed={design.environment === env.value} disabled={saving} onClick={() => saveEnvironment(env.value)}>
            {env.label}
          </button>
        ))}
      </div>

      <details className="endurance-optional">
        <summary>Datos opcionales (nunca obligatorios)</summary>
        {OPTIONAL_FIELDS.map(([key, label]) => (
          <div className="field" key={key}>
            <label className="field__label" htmlFor={`opt-${key}`}>{label}</label>
            <input
              id={`opt-${key}`}
              type="text"
              value={design.optionalLayers[key] ?? ""}
              onChange={(event) => setDesign((current) => (current ? { ...current, optionalLayers: { ...current.optionalLayers, [key]: event.target.value } } : current))}
            />
          </div>
        ))}
      </details>

      <button type="button" className="btn btn--quiet" onClick={() => setPickingObjective(true)}>Cambiar objetivo</button>

      <button type="button" className="btn btn--ghost btn--block" onClick={() => setAdjustSheet("root")}>Ajustar propuesta</button>

      {design.watchPreparedAt ? (
        <p className="notice notice--info">Ya marcaste esta sesión como creada en tu reloj.</p>
      ) : (
        <button type="button" className="btn btn--primary btn--block" disabled={saving} onClick={confirmWatchPrep}>Ya está creado en mi reloj</button>
      )}

      <ImportActivityEntry sessionIndex={sessionIndex} />

      {adjustSheet !== "closed" ? (
        <div className="sheet-overlay" role="presentation" onClick={() => setAdjustSheet("closed")}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="adjustSheetTitle" onClick={(event) => event.stopPropagation()}>
            <div className="sheet__header">
              <h2 id="adjustSheetTitle">
                {adjustSheet === "environment" ? "Cambiar entorno" : adjustSheet === "move" ? "Mover a otro día" : "Ajustar propuesta"}
              </h2>
              <button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => setAdjustSheet("closed")}>×</button>
            </div>
            <div className="sheet__body">
              {adjustSheet === "root" ? (
                <>
                  <p className="lede small">Elige qué ajustar. El objetivo de la sesión se mantiene en todas las opciones salvo que cambies por recuperación.</p>
                  <button type="button" className="opt" disabled={saving} onClick={reduceDuration}>
                    <span className="opt__name">Reducir duración</span>
                    <span className="opt__meta">Baja la duración prevista a ~60%. Se conserva el propósito.</span>
                  </button>
                  {hasStructure ? (
                    <button type="button" className="opt" disabled={saving} onClick={addRepetition}>
                      <span className="opt__name">Añadir una repetición más</span>
                      <span className="opt__meta">Suma un ciclo de trabajo + recuperación (~5 min más).</span>
                    </button>
                  ) : null}
                  <button type="button" className="opt" disabled={saving} onClick={() => setAdjustSheet("environment")}>
                    <span className="opt__name">Cambiar entorno</span>
                    <span className="opt__meta">Mismo objetivo, distinto sitio: {ENVIRONMENTS.map((env) => env.label).join(" · ")}.</span>
                  </button>
                  <button type="button" className="opt" disabled={saving} onClick={changeToRecovery}>
                    <span className="opt__name">Cambiar por recuperación</span>
                    <span className="opt__meta">Cambia el objetivo a continua suave, sin tramos.</span>
                  </button>
                  <button type="button" className="opt" disabled={saving} onClick={() => setAdjustSheet("move")}>
                    <span className="opt__name">Mover a otro día</span>
                    <span className="opt__meta">Crea un ajuste de esta semana para reubicar la sesión.</span>
                  </button>
                  <button type="button" className="btn btn--ghost btn--block" onClick={() => setAdjustSheet("closed")}>Mantener sesión prevista</button>
                </>
              ) : null}

              {adjustSheet === "environment" ? (
                <>
                  <p className="lede small">El objetivo se mantiene; solo cambia dónde la haces.</p>
                  {ENVIRONMENTS.map((env) => (
                    <button key={env.value} type="button" className="opt" disabled={saving} onClick={() => saveEnvironment(env.value)}>
                      <span className="opt__name">{env.label}</span>
                    </button>
                  ))}
                </>
              ) : null}

              {adjustSheet === "move" ? (
                <>
                  <p className="lede small">Se registra como un ajuste de esta semana, igual que mover una sesión desde Plan.</p>
                  {WEEKDAYS.map((day) => (
                    <button key={day} type="button" className="opt" disabled={saving} onClick={() => moveToDay(day as Weekday)}>
                      <span className="opt__name">{WEEKDAY_LABEL[day as Weekday]}</span>
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
