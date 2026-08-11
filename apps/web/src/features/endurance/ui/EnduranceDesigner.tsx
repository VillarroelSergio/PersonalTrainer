"use client";

import { useState } from "react";
import Link from "next/link";
import { ENDURANCE_OBJECTIVES, findEnduranceObjective } from "@/features/endurance/data/objectives";
import type { EnduranceEnvironment, EnduranceObjective } from "@/contracts/endurance";

type DesignState = { id: string; objective: EnduranceObjective; environment: EnduranceEnvironment | null; optionalLayers: Record<string, string>; watchPreparedAt: string | null };

const ENVIRONMENTS: Array<{ value: EnduranceEnvironment; label: string }> = [
  { value: "outdoors", label: "Exterior" }, { value: "treadmill", label: "Cinta" }, { value: "stationary_bike", label: "Bici estática" }, { value: "home", label: "Casa" }
];
const OPTIONAL_FIELDS: Array<[string, string]> = [
  ["duracionMin", "Duración (min)"], ["distanciaKm", "Distancia (km)"], ["ritmo", "Ritmo"],
  ["rpe", "RPE (1-10)"], ["desnivel", "Desnivel (m)"], ["superficie", "Superficie"], ["fcZona", "Zona de FC"]
];

export function EnduranceDesigner({ sessionIndex, isoWeekStart, initialDesign }: { sessionIndex: number; isoWeekStart: string; initialDesign: DesignState | null }) {
  const [design, setDesign] = useState<DesignState | null>(initialDesign);
  const [pickingObjective, setPickingObjective] = useState(!initialDesign);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chooseObjective(objective: EnduranceObjective) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/endurance-designs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isoWeekStart, sessionIndex, objective })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "No pudimos guardar tu propuesta.");
      setDesign({ id: body.data.id, objective: body.data.objective, environment: body.data.environment, optionalLayers: {}, watchPreparedAt: null });
      setPickingObjective(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar tu propuesta.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEnvironment(environment: EnduranceEnvironment) {
    if (!design) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/endurance-designs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isoWeekStart, sessionIndex, objective: design.objective, environment, optionalLayers: design.optionalLayers })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "No pudimos guardar el entorno.");
      setDesign((current) => (current ? { ...current, environment, watchPreparedAt: null } : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar el entorno.");
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

  return (
    <section className="view-endurance">
      {errorNotice}
      <div className="endurance-brief">
        <p className="endurance-brief__line">Objetivo: {template.name}</p>
        <p className="endurance-brief__line">Duración total estimada: {template.durationText}</p>
        <p className="endurance-brief__line">Intensidad: {template.intensityText}</p>
        <p className="endurance-brief__line">Para qué sirve: {template.purpose}</p>
      </div>

      {template.structure ? (
        <ol className="segments">
          {template.structure.map((entry, index) =>
            entry.type === "group" ? (
              <li key={index} className="segment segment--grupo">
                <p className="segment__name">Repite {entry.repeat} veces</p>
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

      {design.watchPreparedAt ? (
        <p className="notice notice--info">Ya marcaste esta sesión como creada en tu reloj.</p>
      ) : (
        <button type="button" className="btn btn--primary btn--block" disabled={saving} onClick={confirmWatchPrep}>Ya está creado en mi reloj</button>
      )}

      <div className="endurance-import-entry">
        <Link href={`/importar?session=${sessionIndex}`} className="btn btn--ghost btn--block">Importar actividad</Link>
        <p className="lede small">Admite .FIT, .TCX y .GPX de tu reloj. Trainer nunca crea ni envía nada al dispositivo: la actividad la haces fuera de la app y la importas después.</p>
      </div>
    </section>
  );
}
