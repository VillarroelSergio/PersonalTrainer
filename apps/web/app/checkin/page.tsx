"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AppShell } from "@/components/AppShell";
import { OfflineRouteBoundary } from "@/features/offline/ui/OfflineRouteBoundary";
import { CheckinRunner } from "@/features/training-engine/ui/CheckinRunner";
import { computeCheckinView } from "@/features/training-engine/domain/checkin-view";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { describeProtectedSnapshotRouteAccess } from "@/lib/offline/protected-route-auth";

export default function CheckinPage() {
  return (
    <Suspense fallback={null}>
      <CheckinPageInner />
    </Suspense>
  );
}

function CheckinPageInner() {
  const router = useRouter();
  const session = authClient.useSession();
  const offlineData = useOfflineData();
  const routeAccess = describeProtectedSnapshotRouteAccess({ isOnline: typeof navigator === "undefined" ? true : navigator.onLine, sessionIsPending: session.isPending, sessionUserId: session.data?.user?.id, snapshotUserId: offlineData.snapshot?.userId });

  useEffect(() => {
    if (routeAccess.redirectToLogin) router.replace("/login");
  }, [routeAccess.redirectToLogin, router]);

  return (
    <AppShell title="Check-in" backHref="/hoy">
      <OfflineRouteBoundary>
        {offlineData.snapshot ? <CheckinContent snapshot={offlineData.snapshot} /> : null}
      </OfflineRouteBoundary>
    </AppShell>
  );
}

function CheckinContent({ snapshot }: { snapshot: OfflineSnapshot }) {
  const router = useRouter();
  const view = computeCheckinView(snapshot);

  useEffect(() => {
    if (view.redirect) router.replace(view.redirect);
  }, [view.redirect, router]);

  if (view.redirect) return null;
  return <CheckinRunner />;
}
