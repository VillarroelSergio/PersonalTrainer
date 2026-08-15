"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { OfflineRouteBoundary } from "@/features/offline/ui/OfflineRouteBoundary";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { AppShell } from "@/components/AppShell";
import { ShareLinkManager } from "@/features/planning/ui/ShareLinkManager";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import type { ShareLinkRow } from "@/features/planning/domain/share-link-offline";

type ActivePlanRow = { id: string; name: string };

export default function CompartirPage() {
  const router = useRouter();
  const session = authClient.useSession();
  const offlineData = useOfflineData();

  useEffect(() => {
    if (!session.isPending && !session.data?.user && navigator.onLine) router.replace("/login");
  }, [session.isPending, session.data?.user, router]);

  useEffect(() => {
    if (offlineData.snapshot && offlineData.snapshot.data.activePlan == null) router.replace("/onboarding");
  }, [offlineData.snapshot, router]);

  return (
    <AppShell title="Compartir" backHref="/plan">
      <OfflineRouteBoundary>
        {offlineData.snapshot && offlineData.snapshot.data.activePlan != null ? <CompartirContent snapshot={offlineData.snapshot} /> : null}
      </OfflineRouteBoundary>
    </AppShell>
  );
}

function CompartirContent({ snapshot }: { snapshot: OfflineSnapshot }) {
  const activePlan = snapshot.data.activePlan as ActivePlanRow;
  const links = ((snapshot.data.shareLinks as ShareLinkRow[] | undefined) ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <>
      <h1 className="view-title">Compartir rutina</h1>
      <p className="lede small">Comparte tu plan como una plantilla; quien la abra crea una copia independiente. Nunca comparte tus cargas, tu historial ni tus cambios posteriores.</p>

      <h2 className="section-title">Tu rutina activa</h2>
      <div className="refblock">
        <p className="field__label">{activePlan.name}</p>
        <p className="small">{links.length === 0 ? "Todavía no has generado ningún enlace." : `${links.filter((link) => !link.revokedAt).length} enlace(s) activo(s).`}</p>
      </div>

      <ShareLinkManager planId={activePlan.id} initialLinks={links.map((link) => ({ id: link.id, createdAt: new Date(link.createdAt).toISOString(), revoked: Boolean(link.revokedAt) }))} />
    </>
  );
}
