"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { EnduranceSport, ParsedActivity } from "@/contracts/endurance";

type ImportStatus = "received" | "analyzed" | "duplicate" | "saved" | "failed";
type ImportData = { id: string; status: ImportStatus; format: string; errorCode: string | null; analysis: ParsedActivity | { message: string } | null; duplicateOfActivityId: string | null };

const SPORT_OPTIONS: Array<{ value: EnduranceSport; label: string }> = [
  { value: "running", label: "Correr" }, { value: "cycling", label: "Bici" }, { value: "walking", label: "Caminar" }, { value: "other", label: "Otra" }
];
const METRIC_LABEL: Record<string, string> = {
  avg_pace_sec_per_km: "Ritmo medio", avg_heart_rate: "FC media", max_heart_rate: "FC máx.",
  elevation_gain_m: "Desnivel", avg_cadence: "Cadencia media", avg_power: "Potencia media", estimated_load: "Carga estimada"
};
const NOT_AVAILABLE = ["distancia", "ritmo", "frecuencia cardiaca", "cadencia", "potencia", "desnivel"];

function formatMetric(metricType: string, value: number, unit: string): string {
  if (metricType === "avg_pace_sec_per_km") {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")} min/km`;
  }
  return `${value} ${unit}`;
}

export function ImportWizard({ isoWeekStart, enduranceSessions, initialSessionIndex }: { isoWeekStart: string; enduranceSessions: Array<{ sessionIndex: number; label: string }>; initialSessionIndex: number | null }) {
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sport, setSport] = useState<EnduranceSport>("running");
  const [associatedSessionIndex, setAssociatedSessionIndex] = useState<number | null>(initialSessionIndex);
  const [committing, setCommitting] = useState(false);
  const [saved, setSaved] = useState<{ name: string; metrics: Array<{ metricType: string; value: number; unit: string }> } | null>(null);
  const [fileDeleted, setFileDeleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function deleteOriginalFile() {
    if (!importData) return;
    const response = await fetch(`/api/v1/activity-imports/${importData.id}/file`, { method: "DELETE", credentials: "same-origin" });
    if (response.ok) setFileDeleted(true);
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/v1/activity-imports", { method: "POST", credentials: "same-origin", body: formData });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "No pudimos subir el archivo.");
        return;
      }
      const data = body.data as ImportData;
      setImportData(data);
      if (data.status === "analyzed" || data.status === "duplicate") {
        setName(file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "));
        const analysis = data.analysis as ParsedActivity;
        if (analysis.sport !== "other") setSport(analysis.sport);
      }
    } catch {
      setError("No pudimos subir el archivo. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  async function commit(force: boolean) {
    if (!importData) return;
    setCommitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/activity-imports/${importData.id}/commit`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, sport, isoWeekStart: associatedSessionIndex != null ? isoWeekStart : null, sessionIndex: associatedSessionIndex, force })
      });
      const body = await response.json();
      if (!response.ok) {
        if (body?.error?.code === "DUPLICATE_ACTIVITY") { setImportData((current) => (current ? { ...current, status: "duplicate", duplicateOfActivityId: body.error.details.duplicateOfActivityId } : current)); return; }
        setError(body?.error?.message ?? "No pudimos guardar la actividad.");
        return;
      }
      setSaved({ name, metrics: body.data.metrics });
    } catch {
      setError("No pudimos guardar la actividad. Comprueba tu conexión e inténtalo de nuevo.");
    } finally {
      setCommitting(false);
    }
  }

  function reset() {
    setImportData(null);
    setError(null);
    setSaved(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (saved) {
    const availableLabels = saved.metrics.map((metric) => `${METRIC_LABEL[metric.metricType] ?? metric.metricType}: ${formatMetric(metric.metricType, metric.value, metric.unit)}`);
    const missing = NOT_AVAILABLE.filter((label) => !availableLabels.some((available) => available.toLowerCase().includes(label)));
    return (
      <section className="view-import">
        <h1 className="view-title">Análisis breve</h1>
        <div className="badge-row"><span className="state state--completada">Procedencia: importado</span></div>
        <p className="lede">{saved.name} se guardó en tu historial.</p>
        <p className="field__label">Datos de esta actividad</p>
        {availableLabels.length > 0 ? (
          <ul className="cues">{availableLabels.map((label) => <li key={label}>{label}</li>)}</ul>
        ) : (
          <p className="lede small">Este archivo no trae más datos analizables además de duración/distancia.</p>
        )}
        <p className="lede small">No disponibles en este archivo: {missing.join(", ")}. No se muestran valores inventados.</p>
        <p className="notice notice--info">Esta actividad no cambia tu plan automáticamente. Podrás verla en tu historial y en el contexto de tus próximas sugerencias.</p>
        {fileDeleted ? (
          <p className="lede small">Archivo original eliminado. El análisis guardado en tu historial no cambia.</p>
        ) : (
          <button type="button" className="btn btn--ghost btn--block" onClick={deleteOriginalFile}>Eliminar archivo original (conserva el análisis)</button>
        )}
        <Link href="/historial" className="btn btn--primary btn--block">Ver en historial</Link>
        <Link href="/hoy" className="btn btn--ghost btn--block">Volver a Hoy</Link>
      </section>
    );
  }

  if (!importData) {
    return (
      <section className="view-import">
        <p className="kicker">Importar actividad</p>
        <h1 className="view-title">Elige un archivo</h1>
        <p className="lede small">Admite .FIT, .TCX y .GPX de tu reloj (Garmin u otro). Sirve para registrar el resultado real de una actividad ya hecha fuera de la app.</p>
        {error && <p className="notice notice--warn" role="alert">{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept=".fit,.tcx,.gpx"
          disabled={uploading}
          onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file); }}
        />
        {uploading && <p className="lede small">Subiendo y analizando…</p>}
      </section>
    );
  }

  if (importData.status === "failed") {
    const message = (importData.analysis as { message: string } | null)?.message ?? "No se pudo interpretar el archivo.";
    return (
      <section className="view-import">
        <h1 className="view-title">Archivo inválido</h1>
        <p className="notice notice--warn">{message}</p>
        <button type="button" className="btn btn--ghost btn--block" onClick={reset}>Elegir otro archivo</button>
      </section>
    );
  }

  const analysis = importData.analysis as ParsedActivity;

  return (
    <section className="view-import">
      <h1 className="view-title">Análisis breve</h1>

      {importData.status === "duplicate" && (
        <p className="notice notice--warn">Esta actividad se parece a una que ya tienes guardada. Puedes importarla de todos modos o cancelar.</p>
      )}

      <div className="import-analysis">
        <p className="import-analysis__row">Duración: {analysis.durationS != null ? `${Math.round(analysis.durationS / 60)} min` : "no disponible"}</p>
        <p className="import-analysis__row">Distancia: {analysis.distanceM != null ? `${(analysis.distanceM / 1000).toFixed(1)} km` : "no disponible"}</p>
        {analysis.metrics.length > 0 ? (
          analysis.metrics.map((metric) => (
            <p className="import-analysis__row" key={metric.metricType}>{METRIC_LABEL[metric.metricType] ?? metric.metricType}: {formatMetric(metric.metricType, metric.value, metric.unit)}</p>
          ))
        ) : (
          <p className="import-analysis__row">Este archivo no incluye más métricas: no se muestra un valor inventado.</p>
        )}
      </div>

      {error && <p className="notice notice--warn" role="alert">{error}</p>}

      <p className="field__label">Editar antes de guardar</p>
      <div className="field">
        <label className="field__label" htmlFor="importName">Nombre</label>
        <input id="importName" type="text" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="field">
        <p className="field__label">Tipo de actividad</p>
        <div className="picker picker--wide" role="group" aria-label="Tipo de actividad">
          {SPORT_OPTIONS.map((option) => (
            <button key={option.value} type="button" className="picker__btn" aria-pressed={sport === option.value} onClick={() => setSport(option.value)}>{option.label}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="importSession">Asociar a sesión de resistencia prevista</label>
        <select id="importSession" value={associatedSessionIndex ?? ""} onChange={(event) => setAssociatedSessionIndex(event.target.value === "" ? null : Number(event.target.value))}>
          <option value="">Ninguna (actividad independiente)</option>
          {enduranceSessions.map((entry) => <option key={entry.sessionIndex} value={entry.sessionIndex}>{entry.label}</option>)}
        </select>
      </div>

      <button type="button" className="btn btn--primary btn--block" disabled={committing || !name.trim()} onClick={() => commit(importData.status === "duplicate")}>
        {importData.status === "duplicate" ? "Importar de todos modos" : "Guardar actividad"}
      </button>
      <button type="button" className="btn btn--ghost btn--block" onClick={reset}>Cancelar</button>
    </section>
  );
}
