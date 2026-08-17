"use client";

import { useRouter } from "next/navigation";
import { OnboardingFlow } from "./OnboardingFlow";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import type { PlanProposal } from "@/contracts/onboarding";

/** Thin route wrapper: OnboardingFlow already activates via RealOnboardingDataSource, this just navigates to Hoy afterward. */
export function OnboardingRoute() {
  const router = useRouter();
  const offlineData = useOfflineData();

  async function onActivate(proposal: PlanProposal) {
    const response = await fetch("/api/v1/plans/activate", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId: proposal.proposalId, proposalJson: JSON.stringify(proposal) })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message ?? "No pudimos activar tu plan.");
    }
    // /hoy renders from the local snapshot, and bounces back to /onboarding (restarting at
    // step 1) while that snapshot still says activePlan == null. router.refresh() only
    // revalidates RSC, not the snapshot, so it has to be pulled before navigating.
    await offlineData.refresh();
    router.push("/hoy");
    router.refresh();
  }

  return <OnboardingFlow onActivate={onActivate} />;
}
