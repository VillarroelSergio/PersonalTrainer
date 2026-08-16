"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { authClient } from "@/lib/auth-client";
import { OfflineRouteBoundary } from "@/features/offline/ui/OfflineRouteBoundary";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { describeProtectedSnapshotRouteAccess } from "@/lib/offline/protected-route-auth";
import { OnboardingRoute } from "@/features/onboarding/ui/OnboardingRoute";

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageInner />
    </Suspense>
  );
}

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createNew = searchParams.get("new");
  const session = authClient.useSession();
  const offlineData = useOfflineData();

  const routeAccess = describeProtectedSnapshotRouteAccess({ sessionFailed: session.error != null, sessionIsPending: session.isPending, sessionUserId: session.data?.user?.id, snapshotUserId: offlineData.snapshot?.userId });

  useEffect(() => {
    if (routeAccess.redirectToLogin) router.replace("/login");
  }, [routeAccess.redirectToLogin, router]);

  useEffect(() => {
    if (offlineData.snapshot && offlineData.snapshot.data.activePlan != null && createNew !== "1") router.replace("/hoy");
  }, [offlineData.snapshot, createNew, router]);

  const skip = offlineData.snapshot && offlineData.snapshot.data.activePlan != null && createNew !== "1";

  return (
    <OfflineRouteBoundary>
      {offlineData.snapshot && !skip ? <OnboardingRoute /> : null}
    </OfflineRouteBoundary>
  );
}
