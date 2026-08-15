"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { authClient } from "@/lib/auth-client";
import { OfflineRouteBoundary } from "@/features/offline/ui/OfflineRouteBoundary";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
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

  useEffect(() => {
    if (!session.isPending && !session.data?.user && navigator.onLine) router.replace("/login");
  }, [session.isPending, session.data?.user, router]);

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
