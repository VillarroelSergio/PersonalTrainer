"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "weight" | "measurement";

export function AddMetricForm() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("weight");
  const [zone, setZone] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("kg");
  const [measuredAt, setMeasuredAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function selectKind(next: Kind) {
    setKind(next);
    setUnit(next === "weight" ? "kg" : "cm");
  }

  async function submit() {
    setError(null);
    const parsedValue = parseFloat(value);
    if (Number.isNaN(parsedValue) || parsedValue <= 0) { setError("Introduce un valor numérico mayor que cero."); return; }
    if (!measuredAt) { setError("Elige una fecha."); return; }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/body-metrics", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, zone: kind === "measurement" && zone.trim() ? zone.trim() : null, value: parsedValue, unit: unit.trim() || (kind === "weight" ? "kg" : "cm"), measuredAt })
      });
      const responseBody = await response.json();
      if (!response.ok) throw new Error(responseBody?.error?.message ?? "No pudimos guardar la métrica.");
      setValue("");
      setZone("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar la métrica.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="field">
      <p className="field__label">Registrar métrica (opcional)</p>
      {error && <p className="field__error" role="alert">{error}</p>}
      <div className="picker" role="group" aria-label="Tipo de métrica">
        <button type="button" className="picker__btn" aria-pressed={kind === "weight"} onClick={() => selectKind("weight")}>Peso</button>
        <button type="button" className="picker__btn" aria-pressed={kind === "measurement"} onClick={() => selectKind("measurement")}>Medida corporal</button>
      </div>

      {kind === "measurement" && (
        <>
          <label className="field__label" htmlFor="metricZone">Zona</label>
          <input id="metricZone" type="text" placeholder="Por ejemplo: cintura" value={zone} onChange={(event) => setZone(event.target.value)} />
        </>
      )}

      <label className="field__label" htmlFor="metricValue">Valor</label>
      <input id="metricValue" type="number" step="0.1" value={value} onChange={(event) => setValue(event.target.value)} />

      <label className="field__label" htmlFor="metricUnit">Unidad</label>
      <input id="metricUnit" type="text" value={unit} onChange={(event) => setUnit(event.target.value)} />

      <label className="field__label" htmlFor="metricDate">Fecha</label>
      <input id="metricDate" type="date" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} />

      <button type="button" className="btn btn--ghost btn--block" disabled={submitting} onClick={submit}>
        {submitting ? "Guardando…" : "Guardar métrica"}
      </button>
    </div>
  );
}
