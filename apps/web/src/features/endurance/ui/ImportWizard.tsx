"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { EnduranceSport, ParsedActivity } from "@/contracts/endurance";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { useOfflineSyncContext } from "@/lib/offline/OfflineSyncContext";
import { createIndexedDbImportFileStore } from "@/lib/offline/indexeddb-store";
import { readyImportToWizardState, stageActivityImportOffline, type OfflineImportFile } from "@/features/endurance/domain/activity-import-offline";

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

type EnduranceSessionOption = { sessionIndex: number; label: string; title: string; estimatedMinutes: number };

/** Browser-side integrity hash for the direct-to-Storage upload flow (Task 5): the server re-derives this from the downloaded bytes and rejects a mismatch. */
async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ImportWizard({ isoWeekStart, enduranceSessions, initialSessionIndex }: { isoWeekStart: string; enduranceSessions: EnduranceSessionOption[]; initialSessionIndex: number | null }) {
  const offlineData = useOfflineData();
  const offlineSync = useOfflineSyncContext();
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stagedFiles, setStagedFiles] = useState<Array<Pick<OfflineImportFile, "id" | "originalName" | "sizeBytes" | "createdAt" | "status" | "importData">>>([]);
  const [name, setName] = useState("");
  const [sport, setSport] = useState<EnduranceSport>("running");
  const [associatedSessionIndex, setAssociatedSessionIndex] = useState<number | null>(initialSessionIndex);
  const [committing, setCommitting] = useState(false);
  const [saved, setSaved] = useState<{ name: string; metrics: Array<{ metricType: string; value: number; unit: string }> } | null>(null);
  const [fileDeleted, setFileDeleted] = useState(false);
  const [selectedStagedFileId, setSelectedStagedFileId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileStoreRef = useRef(createIndexedDbImportFileStore());
  const userId = offlineData.snapshot?.userId ?? null;

  useEffect(() => {
    if (!userId) {
      setStagedFiles([]);
      return;
    }
    let cancelled = false;
    fileStoreRef.current.list(userId).then((files) => {
      if (!cancelled) setStagedFiles(files.map(({ id, originalName, sizeBytes, createdAt, status, importData }) => ({ id, originalName, sizeBytes, createdAt, status, importData })));
    }).catch(() => {
      if (!cancelled) setStagedFiles([]);
    });
    return () => { cancelled = true; };
  }, [userId]);

  async function deleteOriginalFile() {
    if (!importData) return;
    const response = await fetch(`/api/v1/activity-imports/${importData.id}/file`, { method: "DELETE", credentials: "same-origin" });
    if (response.ok) setFileDeleted(true);
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await stageFileForLater(file);
        return;
      }

      const arrayBuffer = await file.arrayBuffer();
      const sha256 = await sha256Hex(arrayBuffer);

      const urlResponse = await fetch("/api/v1/activity-imports/upload-url", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, sizeBytes: file.size, mimeType: file.type })
      });
      const urlBody = await urlResponse.json();
      if (!urlResponse.ok) {
        setError(urlBody?.error?.message ?? "No pudimos preparar la subida.");
        return;
      }
      const { storageKey, signedUrl } = urlBody.data as { storageKey: string; signedUrl: string };

      const putResponse = await fetch(signedUrl, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
      if (!putResponse.ok) {
        setError("No pudimos subir el archivo. Comprueba tu conexión e inténtalo de nuevo.");
        return;
      }

      const response = await fetch("/api/v1/activity-imports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storageKey, originalName: file.name, sha256, sizeBytes: file.size })
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "No pudimos analizar el archivo.");
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
      await stageFileForLater(file);
    } finally {
      setUploading(false);
    }
  }

  async function stageFileForLater(file: File) {
    if (!userId) {
      setError("Necesitas una sincronización inicial antes de preparar archivos sin conexión.");
      return;
    }
    try {
      const staged = await stageActivityImportOffline({ file, userId, fileStore: fileStoreRef.current });
      setStagedFiles((current) => [
        { id: staged.file.id, originalName: staged.file.originalName, sizeBytes: staged.file.sizeBytes, createdAt: staged.file.createdAt, status: staged.file.status, importData: staged.file.importData },
        ...current.filter((entry) => entry.id !== staged.file.id)
      ]);
      await offlineSync.enqueue(staged.operation);
      setError(null);
    } catch {
      setError("No pudimos preparar el archivo en este dispositivo.");
    }
  }

  function continueReadyImport(file: Pick<OfflineImportFile, "id" | "originalName" | "sizeBytes" | "createdAt" | "status" | "importData">) {
    const state = readyImportToWizardState({ ...file, userId: userId ?? "", blob: null, mimeType: "", sha256: "" });
    if (!state) return;
    setSelectedStagedFileId(file.id);
    setImportData(state.importData as ImportData);
    setName(state.name);
    setSport(state.sport);
    setError(null);
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
      if (selectedStagedFileId && userId) {
        await fileStoreRef.current.remove(userId, selectedStagedFileId);
        setStagedFiles((current) => current.filter((file) => file.id !== selectedStagedFileId));
        setSelectedStagedFileId(null);
      }
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
    setSelectedStagedFileId(null);
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
        <Link href="/plan" className="btn btn--ghost btn--block">Revisar plan</Link>
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
          id="activityFile"
          className="sr-only"
          type="file"
          accept=".fit,.tcx,.gpx"
          disabled={uploading}
          onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file); }}
        />
        <label htmlFor="activityFile" className="btn btn--primary btn--block">{uploading ? "Subiendo y analizando…" : "Elegir archivo"}</label>
        {uploading && <p className="lede small">Subiendo y analizando…</p>}
        {stagedFiles.length > 0 && (
          <>
            <p className="field__label">Preparado en este dispositivo</p>
            <div className="import-filelist" aria-label="Archivos pendientes de sincronizar">
              {stagedFiles.map((file) => (
                <div className="import-file" key={file.id}>
                  <p className="import-file__name">{file.originalName}</p>
                  <p className="import-file__meta">{formatFileSize(file.sizeBytes)} · {file.status === "ready_to_save" ? "listo para guardar" : "pendiente de conexión"}</p>
                  {file.status === "ready_to_save" ? (
                    <button type="button" className="btn btn--ghost btn--block" onClick={() => continueReadyImport(file)}>Completar importación</button>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
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
  const associatedSession = associatedSessionIndex != null ? (enduranceSessions.find((entry) => entry.sessionIndex === associatedSessionIndex) ?? null) : null;

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

      <div className="import-compare">
        {associatedSession == null ? (
          <p className="lede small">Sin asociar: se guardará como actividad independiente. Ninguna sesión planificada cambia de estado.</p>
        ) : (
          <>
            <p className="field__label">Comparación con lo previsto (aproximada)</p>
            <ul className="cues">
              <li>Sesión prevista: {associatedSession.title}</li>
              {/* ponytail: el plan no guarda un entorno previsto por sesión (solo día/título/duración estimada), así que este campo del prototipo se omite en vez de inventarlo */}
              {analysis.durationS != null && (
                <li>
                  Duración prevista: {associatedSession.estimatedMinutes} min · real: {Math.round(analysis.durationS / 60)} min (
                  {(() => { const diff = Math.round(analysis.durationS / 60) - associatedSession.estimatedMinutes; return `${diff >= 0 ? "+" : ""}${diff} min`; })()}
                  )
                </li>
              )}
            </ul>
          </>
        )}
      </div>

      <button type="button" className="btn btn--primary btn--block" disabled={committing || !name.trim()} onClick={() => commit(importData.status === "duplicate")}>
        {importData.status === "duplicate" ? "Importar de todos modos" : "Guardar actividad"}
      </button>
      <button type="button" className="btn btn--ghost btn--block" onClick={reset}>Cancelar</button>
    </section>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
