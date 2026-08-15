"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";

/** Self-service GDPR-style deletion: irreversible, so it needs an explicit second confirmation step — never a single click. */
export function AccountDeletionControl() {
  const router = useRouter();
  const { clear } = useOfflineData();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/v1/me", { method: "DELETE", credentials: "same-origin" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "No pudimos eliminar tu cuenta.");
      setBusy(false);
      return;
    }
    // Clear the local snapshot before signing out so a different account on
    // this device never hydrates this now-deleted account's cached data.
    await clear();
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <section aria-label="Eliminar cuenta y datos">
      <h2 className="section-title">Eliminar cuenta y mis datos</h2>
      <p className="lede small">Borra tu cuenta, tu plan, tu historial, tus check-ins, tus medidas y cualquier archivo importado. No se puede deshacer.</p>
      {error ? <p className="notice notice--warn" role="alert">{error}</p> : null}
      {!confirming ? (
        <button type="button" className="btn btn--ghost btn--block" onClick={() => setConfirming(true)}>Eliminar mi cuenta y mis datos</button>
      ) : (
        <>
          <p className="notice notice--warn" role="alert">Esto elimina tu cuenta y todos tus datos de forma permanente. ¿Seguro?</p>
          <button type="button" className="btn btn--primary btn--block" onClick={confirmDelete} disabled={busy}>{busy ? "Eliminando…" : "Sí, eliminar definitivamente"}</button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setConfirming(false)} disabled={busy}>Cancelar</button>
        </>
      )}
    </section>
  );
}
