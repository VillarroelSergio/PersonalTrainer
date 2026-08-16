"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { OfflineRouteBoundary } from "@/features/offline/ui/OfflineRouteBoundary";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { computeEntrenarView } from "@/features/workouts/domain/entrenar-view";
import { WorkoutRunner } from "@/features/workouts/ui/WorkoutRunner";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_LABEL, type Weekday } from "@/lib/weekdays";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { describeProtectedSnapshotRouteAccess } from "@/lib/offline/protected-route-auth";

export default function EntrenarPage() {
  return (
    <Suspense fallback={null}>
      <EntrenarPageInner />
    </Suspense>
  );
}

function EntrenarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIndex = Number(searchParams.get("session") ?? "0");
  const addons = searchParams.get("addons");
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
    <AppShell title="Entrenar" backHref="/hoy">
      <OfflineRouteBoundary>
        {routeAccess.canRender && offlineData.snapshot && offlineData.snapshot.data.activePlan != null ? (
          <EntrenarContent snapshot={offlineData.snapshot} sessionIndex={sessionIndex} addons={addons} />
        ) : null}
      </OfflineRouteBoundary>
    </AppShell>
  );
}

function EntrenarContent({ snapshot, sessionIndex, addons }: { snapshot: OfflineSnapshot; sessionIndex: number; addons: string | null }) {
  const router = useRouter();
  const view = computeEntrenarView(snapshot, sessionIndex);

  useEffect(() => {
    if (view.redirect) router.replace(view.redirect);
  }, [view.redirect, router]);

  if (view.redirect) return null;

  const { plannedSession, favoriteVariantIds, recentVariantIds, isResuming } = view;

  return (
    <>
      <p className="kicker">{WEEKDAY_LABEL[plannedSession.day as Weekday]}</p>
      <h1 className="view-title">{plannedSession.title}</h1>
      <WorkoutRunner
        planId={view.activePlan.id}
        sessionIndex={sessionIndex}
        previewExercises={plannedSession.exercises ?? []}
        previewBlocks={addons === "1" ? plannedSession.blocks ?? [] : []}
        favoriteVariantIds={favoriteVariantIds}
        recentVariantIds={recentVariantIds}
        autoStart={isResuming}
      />
    </>
  );
}
