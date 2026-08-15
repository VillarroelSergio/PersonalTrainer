"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { OfflineRouteBoundary } from "@/features/offline/ui/OfflineRouteBoundary";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { AppShell } from "@/components/AppShell";
import { RecoveryRunner } from "@/features/recovery/ui/RecoveryRunner";
import { computeRecoveryView } from "@/features/recovery/domain/recovery-view";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";

export default function RecuperarPage() {
  return (
    <Suspense fallback={null}>
      <RecuperarPageInner />
    </Suspense>
  );
}

function RecuperarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session") ?? undefined;
  const session = authClient.useSession();
  const offlineData = useOfflineData();

  useEffect(() => {
    if (!session.isPending && !session.data?.user) router.replace("/login");
  }, [session.isPending, session.data?.user, router]);

  useEffect(() => {
    if (offlineData.snapshot && offlineData.snapshot.data.activePlan == null) router.replace("/onboarding");
  }, [offlineData.snapshot, router]);

  return (
    <AppShell title="Trainer" backHref="/hoy">
      <OfflineRouteBoundary>
        {offlineData.snapshot && offlineData.snapshot.data.activePlan != null ? (
          <RecoveryContent snapshot={offlineData.snapshot} sessionParam={sessionParam} />
        ) : null}
      </OfflineRouteBoundary>
    </AppShell>
  );
}

function RecoveryContent({ snapshot, sessionParam }: { snapshot: OfflineSnapshot; sessionParam: string | undefined }) {
  const router = useRouter();
  const view = computeRecoveryView(snapshot, sessionParam);

  useEffect(() => {
    if (view.redirect) router.replace(view.redirect);
  }, [view.redirect, router]);

  if (view.redirect) return null;

  return (
    <RecoveryRunner
      planId={view.activePlan.id}
      sessionIndex={view.sessionIndex}
      sessionTitle={view.sessionTitle}
      initialSessionId={view.initialSessionId}
      initialStatus={view.initialStatus}
    />
  );
}
