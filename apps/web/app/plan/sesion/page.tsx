"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AppShell } from "@/components/AppShell";
import { OfflineRouteBoundary } from "@/features/offline/ui/OfflineRouteBoundary";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { describeProtectedSnapshotRouteAccess } from "@/lib/offline/protected-route-auth";
import { PlanSessionEditPage } from "@/features/planning/ui/PlanSessionEditPage";
import type { PlanProposal } from "@/contracts/onboarding";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";

export default function PlanSesionPage() {
  return (
    <Suspense fallback={null}>
      <PlanSesionPageInner />
    </Suspense>
  );
}

function PlanSesionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");
  const weekStart = searchParams.get("semana");
  const sessionIndex = Number(searchParams.get("session") ?? "-1");
  const session = authClient.useSession();
  const offlineData = useOfflineData();
  const routeAccess = describeProtectedSnapshotRouteAccess({ sessionFailed: session.error != null, sessionIsPending: session.isPending, sessionUserId: session.data?.user?.id, snapshotUserId: offlineData.snapshot?.userId });

  useEffect(() => {
    if (routeAccess.redirectToLogin) router.replace("/login");
  }, [routeAccess.redirectToLogin, router]);

  useEffect(() => {
    if (offlineData.snapshot && offlineData.snapshot.data.activePlan == null) router.replace("/onboarding");
  }, [offlineData.snapshot, router]);

  const paramsValid = Boolean(planId) && Boolean(weekStart) && Number.isFinite(sessionIndex) && sessionIndex >= 0;

  return (
    <AppShell title="Editar sesión" backHref="/plan">
      <OfflineRouteBoundary>
        {routeAccess.canRender && offlineData.snapshot && paramsValid ? (
          <SesionContent snapshot={offlineData.snapshot} planId={planId as string} weekStart={weekStart as string} sessionIndex={sessionIndex} />
        ) : routeAccess.canRender && offlineData.snapshot ? (
          <p className="notice notice--warn">No encontramos esta sesión. Vuelve al plan e inténtalo de nuevo.</p>
        ) : null}
      </OfflineRouteBoundary>
    </AppShell>
  );
}

function SesionContent({ snapshot, planId, weekStart, sessionIndex }: { snapshot: OfflineSnapshot; planId: string; weekStart: string; sessionIndex: number }) {
  const activePlan = snapshot.data.activePlan as { id: string; contentJson: string } | null;
  if (!activePlan || activePlan.id !== planId) {
    return <p className="notice notice--warn">No encontramos esta sesión. Vuelve al plan e inténtalo de nuevo.</p>;
  }
  const proposal = JSON.parse(activePlan.contentJson) as PlanProposal;
  const plannedSession = proposal.week.sessions[sessionIndex];
  if (!plannedSession || plannedSession.kind !== "strength") {
    return <p className="notice notice--warn">No encontramos esta sesión. Vuelve al plan e inténtalo de nuevo.</p>;
  }
  return <PlanSessionEditPage planId={planId} weekStart={weekStart} sessionIndex={sessionIndex} session={plannedSession} />;
}
