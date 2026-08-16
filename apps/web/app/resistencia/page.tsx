"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { OfflineRouteBoundary } from "@/features/offline/ui/OfflineRouteBoundary";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { computeResistenciaView } from "@/features/endurance/domain/resistencia-view";
import { EnduranceDesigner } from "@/features/endurance/ui/EnduranceDesigner";
import { EnduranceEmptyState } from "@/features/endurance/ui/EnduranceEmptyState";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_LABEL, type Weekday } from "@/lib/weekdays";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { describeProtectedSnapshotRouteAccess } from "@/lib/offline/protected-route-auth";

export default function ResistenciaPage() {
  return (
    <Suspense fallback={null}>
      <ResistenciaPageInner />
    </Suspense>
  );
}

function ResistenciaPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session") ?? undefined;
  const session = authClient.useSession();
  const offlineData = useOfflineData();
  const routeAccess = describeProtectedSnapshotRouteAccess({ sessionFailed: session.error != null, sessionIsPending: session.isPending, sessionUserId: session.data?.user?.id, snapshotUserId: offlineData.snapshot?.userId });

  useEffect(() => {
    if (routeAccess.redirectToLogin) router.replace("/login");
  }, [routeAccess.redirectToLogin, router]);

  useEffect(() => {
    if (offlineData.snapshot && offlineData.snapshot.data.activePlan == null) router.replace("/onboarding");
  }, [offlineData.snapshot, router]);

  return (
    <AppShell title="Resistencia" backHref="/hoy">
      <OfflineRouteBoundary>
        {routeAccess.canRender && offlineData.snapshot && offlineData.snapshot.data.activePlan != null ? (
          <ResistenciaContent snapshot={offlineData.snapshot} sessionParam={sessionParam} />
        ) : null}
      </OfflineRouteBoundary>
    </AppShell>
  );
}

function ResistenciaContent({ snapshot, sessionParam }: { snapshot: OfflineSnapshot; sessionParam: string | undefined }) {
  const router = useRouter();
  const view = computeResistenciaView(snapshot, sessionParam);

  useEffect(() => {
    if (view.redirect) router.replace(view.redirect);
  }, [view.redirect, router]);

  if (view.redirect) return null;

  if (view.empty) {
    return (
      <>
        <h1 className="view-title">Resistencia</h1>
        <EnduranceEmptyState />
      </>
    );
  }

  return (
    <>
      <p className="kicker">{WEEKDAY_LABEL[view.plannedSession.day as Weekday]} · {view.plannedSession.estimatedMinutes} min aproximados</p>
      <h1 className="view-title">{view.plannedSession.title}</h1>
      <EnduranceDesigner
        planId={view.activePlan.id}
        sessionIndex={view.sessionIndex}
        isoWeekStart={view.weekStart}
        conflictText={view.conflictText}
        initialDesign={view.initialDesign}
      />
    </>
  );
}
