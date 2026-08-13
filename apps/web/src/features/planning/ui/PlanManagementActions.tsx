"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PlanManagementActionsProps = { planId: string; planName: string; isActive: boolean };

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

export default function PlanManagementActions({ planId, planName, isActive }: PlanManagementActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(planName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    const nextName = name.trim();
    if (!nextName) { setError("Escribe un nombre para el plan."); return; }
    setPending(true); setError(null);
    const response = await fetch(`/api/v1/plans/${planId}`, { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: nextName }) });
    setPending(false);
    if (!response.ok) { setError(await responseError(response, "No pudimos guardar el nombre.")); return; }
    setEditing(false); router.refresh();
  }

  async function deletePlan() {
    const message = isActive
      ? "Eliminarás este plan activo y las sesiones que contiene. Después podrás crear otro. Esta acción no se puede deshacer."
      : "Eliminarás este plan y las sesiones que contiene. Esta acción no se puede deshacer.";
    if (!window.confirm(message)) return;
    setPending(true); setError(null);
    const response = await fetch(`/api/v1/plans/${planId}`, { method: "DELETE", credentials: "same-origin" });
    setPending(false);
    if (!response.ok) { setError(await responseError(response, "No pudimos eliminar el plan.")); return; }
    if (isActive) { router.replace("/onboarding?new=1"); router.refresh(); return; }
    router.refresh();
  }

  return (
    <div className="planmanage">
      {error ? <p className="field__error" role="alert">{error}</p> : null}
      {editing ? (
        <div className="planmanage__edit">
          <label className="sr-only" htmlFor={`plan-name-${planId}`}>Nombre del plan</label>
          <input id={`plan-name-${planId}`} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} disabled={pending} />
          <button type="button" className="btn btn--primary btn--sm" disabled={pending} onClick={saveName}>Guardar</button>
          <button type="button" className="btn btn--ghost btn--sm" disabled={pending} onClick={() => { setName(planName); setEditing(false); setError(null); }}>Cancelar</button>
        </div>
      ) : (
        <div className="planrow__actions">
          {isActive ? <a href="/plan?vista=semana" className="btn btn--ghost btn--sm">Editar sesiones</a> : null}
          <button type="button" className="btn btn--ghost btn--sm" disabled={pending} onClick={() => setEditing(true)}>Editar nombre</button>
          <button type="button" className="btn btn--danger btn--sm" disabled={pending} onClick={deletePlan}>Eliminar</button>
        </div>
      )}
    </div>
  );
}
