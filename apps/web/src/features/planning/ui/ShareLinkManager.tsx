"use client";

import { useState } from "react";
import { createShareLinkOffline, revokeShareLinkOffline } from "@/features/planning/domain/share-link-offline";
import { createClientId } from "@/lib/client-id";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { useOfflineSyncContext } from "@/lib/offline/OfflineSyncContext";

type Link = { id: string; createdAt: string; revoked: boolean };

export function ShareLinkManager({ planId, initialLinks }: { planId: string; initialLinks: Link[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offlineData = useOfflineData();
  const sync = useOfflineSyncContext();

  async function generate() {
    setBusy(true);
    setError(null);
    let response: Response;
    try {
      response = await fetch(`/api/v1/plans/${planId}/share-links`, { method: "POST", credentials: "same-origin" });
    } catch {
      // Network failure (not a server rejection): create the link locally and queue it — the
      // link IS created, just not synced yet, same treatment as CheckinRunner/PlanSessionActions.
      // Its id is a local placeholder until the outbox flush and next snapshot refresh replace it
      // with the real server-issued token.
      setBusy(false);
      if (offlineData.snapshot) {
        const result = createShareLinkOffline(offlineData.snapshot, planId, createClientId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
        setLinks((current) => [{ id: result.row.id, createdAt: result.row.createdAt, revoked: false }, ...current]);
      } else {
        setError("No pudimos generar el enlace.");
      }
      return;
    }
    setBusy(false);
    const body = await response.json();
    if (!response.ok) {
      setError(body?.error?.message ?? "No pudimos generar el enlace.");
      return;
    }
    setLinks((current) => [{ id: body.data.token, createdAt: new Date().toISOString(), revoked: false }, ...current]);
  }

  async function revoke(linkId: string) {
    let response: Response;
    try {
      response = await fetch(`/api/v1/share-links/${linkId}`, { method: "DELETE", credentials: "same-origin" });
    } catch {
      if (offlineData.snapshot) {
        const result = revokeShareLinkOffline(offlineData.snapshot, linkId, createClientId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
        setLinks((current) => current.map((link) => (link.id === linkId ? { ...link, revoked: true } : link)));
      } else {
        setError("No pudimos revocar el enlace.");
      }
      return;
    }
    if (response.ok) setLinks((current) => current.map((link) => (link.id === linkId ? { ...link, revoked: true } : link)));
    else setError("No pudimos revocar el enlace.");
  }

  const shareUrl = (token: string) => (typeof window === "undefined" ? `/compartir/${token}` : `${window.location.origin}/compartir/${token}`);

  return (
    <section aria-label="Generar y gestionar enlaces">
      <h2 className="section-title">Generar enlace de copia</h2>
      {error ? <p className="notice notice--warn" role="alert">{error}</p> : null}
      <button type="button" className="btn btn--primary btn--sm btn--block" onClick={generate} disabled={busy}>{busy ? "Generando…" : "Generar enlace"}</button>

      <h2 className="section-title">Enlaces generados</h2>
      {links.length === 0 ? (
        <p className="lede small share-empty">Todavía no has generado ningún enlace.</p>
      ) : (
        <ul className="catalog-list catalog-list--compact">
          {links.map((link) => (
            <li key={link.id} className="catalog-card catalog-card--compact">
              <div className="catalog-card__top">
                <div className="catalog-card__body">
                  <p className="small mono">{shareUrl(link.id)}</p>
                  <p className="catalog-card__meta">{link.revoked ? "Revocado" : "Activo"} · creado el {new Date(link.createdAt).toLocaleDateString("es-ES")}</p>
                </div>
              </div>
              {!link.revoked ? <button type="button" className="btn btn--ghost btn--sm" onClick={() => revoke(link.id)}>Revocar</button> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
