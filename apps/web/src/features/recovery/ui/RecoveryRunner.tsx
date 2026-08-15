"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RECOVERY_TEMPLATE, RECOVERY_TOTAL_MINUTES, RECOVERY_WELLBEING_NOTE } from "@/features/recovery/data/recovery-template";
import { finishRecoveryOffline, startRecoveryOffline } from "@/features/recovery/domain/recovery-offline";
import { createClientId } from "@/lib/client-id";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { useOfflineSyncContext } from "@/lib/offline/OfflineSyncContext";

type Props = { planId: string; sessionIndex: number; sessionTitle: string; initialSessionId: string | null; initialStatus: string | null };

export function RecoveryRunner({ planId, sessionIndex, sessionTitle, initialSessionId, initialStatus }: Props) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [status, setStatus] = useState(initialStatus);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offlineData = useOfflineData();
  const sync = useOfflineSyncContext();

  async function start() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/recovery-sessions", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, sessionIndex })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "No se pudo empezar la recuperación.");
      setSessionId(body.data.id);
      setStatus(body.data.status);
    } catch (cause) {
      // No coverage: start the recovery session locally with a "local-recovery-N" id; the
      // outbox reconciles it with the real server id once back online.
      if (offlineData.snapshot) {
        const result = startRecoveryOffline(offlineData.snapshot, { planId, sessionIndex }, createClientId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
        setSessionId(result.session.id);
        setStatus(result.session.status);
      } else {
        setError(cause instanceof Error ? cause.message : "No se pudo empezar la recuperación.");
      }
    } finally {
      setPending(false);
    }
  }

  async function finish() {
    if (!sessionId) return;
    setPending(true);
    setError(null);
    const payload = { comment: comment.trim() || null };
    try {
      const response = await fetch(`/api/v1/recovery-sessions/${sessionId}/finish`, {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "No se pudo cerrar la recuperación.");
      setStatus("completed");
      router.refresh();
    } catch (cause) {
      if (offlineData.snapshot) {
        const result = finishRecoveryOffline(offlineData.snapshot, sessionId, payload, createClientId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
        setStatus("completed");
      } else {
        setError(cause instanceof Error ? cause.message : "No se pudo cerrar la recuperación.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="view-recovery">
      <p className="kicker">Recuperación</p>
      <h1 className="view-title">{sessionTitle}</h1>
      <p className="lede small">Versión suave de hoy · {RECOVERY_TOTAL_MINUTES} min aproximados.</p>
      <p className="notice notice--info">{RECOVERY_WELLBEING_NOTE}</p>

      <ol className="segments">
        {RECOVERY_TEMPLATE.map((block) => (
          <li key={block.title} className="segment segment--recuperacion">
            <div className="segment__head"><span className="segment__name">{block.title}</span></div>
            <p className="segment__meta">{block.durationMinutes} min · {block.instruction}</p>
          </li>
        ))}
      </ol>

      {error ? <p className="notice notice--warn" role="alert">{error}</p> : null}

      {status === "completed" ? (
        <p className="notice notice--info">Recuperación registrada. Cuenta como adherencia de esta sesión.</p>
      ) : status === "in_progress" ? (
        <>
          <div className="field">
            <label className="field__label" htmlFor="recoveryComment">Comentario (opcional)</label>
            <input id="recoveryComment" type="text" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} />
          </div>
          <button type="button" className="btn btn--primary btn--block" onClick={finish} disabled={pending}>Terminar recuperación</button>
        </>
      ) : (
        <button type="button" className="btn btn--primary btn--block" onClick={start} disabled={pending}>Empezar recuperación</button>
      )}
    </section>
  );
}
