"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";

export function CopySharedRoutineButton({ token }: { token: string }) {
  const router = useRouter();
  const offlineData = useOfflineData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/v1/shared-routines/${token}/copy`, { method: "POST", credentials: "same-origin" });
    if (response.ok) {
      // Same reason as OnboardingRoute: /hoy bounces to /onboarding while the local
      // snapshot still has activePlan == null.
      await offlineData.refresh();
      router.push("/hoy");
      router.refresh();
      return;
    }
    const body = await response.json().catch(() => null);
    setError(body?.error?.message ?? "No pudimos crear tu copia.");
    setBusy(false);
  }

  return (
    <>
      {error ? <p className="notice notice--warn" role="alert">{error}</p> : null}
      <button type="button" className="btn btn--primary btn--block" onClick={copy} disabled={busy}>{busy ? "Creando tu copia…" : "Crear mi copia"}</button>
    </>
  );
}
