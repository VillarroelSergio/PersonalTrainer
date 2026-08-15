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

  useEffect(() => {
    if (!session.isPending && !session.data?.user) router.replace("/login");
  }, [session.isPending, session.data?.user, router]);

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
