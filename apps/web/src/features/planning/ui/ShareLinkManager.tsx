"use client";

import { useState } from "react";

type Link = { id: string; createdAt: string; revoked: boolean };

export function ShareLinkManager({ planId, initialLinks }: { planId: string; initialLinks: Link[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/plans/${planId}/share-links`, { method: "POST", credentials: "same-origin" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "No pudimos generar el enlace.");
      setLinks((current) => [{ id: body.data.token, createdAt: new Date().toISOString(), revoked: false }, ...current]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos generar el enlace.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(linkId: string) {
    const response = await fetch(`/api/v1/share-links/${linkId}`, { method: "DELETE", credentials: "same-origin" });
    if (response.ok) setLinks((current) => current.map((link) => (link.id === linkId ? { ...link, revoked: true } : link)));
  }

  const shareUrl = (token: string) => (typeof window === "undefined" ? `/compartir/${token}` : `${window.location.origin}/compartir/${token}`);

  return (
    <section aria-label="Generar y gestionar enlaces">
      <h2 className="section-title">Generar enlace de copia</h2>
      {error ? <p className="notice notice--warn" role="alert">{error}</p> : null}
      <button type="button" className="btn btn--primary btn--block" onClick={generate} disabled={busy}>{busy ? "Generando…" : "Generar enlace"}</button>

      <h2 className="section-title">Enlaces generados</h2>
      {links.length === 0 ? (
        <p className="lede small">Todavía no has generado ningún enlace.</p>
      ) : (
        <ul className="catalog-list">
          {links.map((link) => (
            <li key={link.id} className="catalog-card">
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
