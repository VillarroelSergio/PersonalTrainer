"use client";

import { useRouter } from "next/navigation";
import { OnboardingFlow } from "./OnboardingFlow";

/** Thin route wrapper: OnboardingFlow already activates via RealOnboardingDataSource, this just navigates to Hoy afterward. */
export function OnboardingRoute() {
  const router = useRouter();

  async function onActivate(proposalId: string) {
    const response = await fetch("/api/v1/plans/activate", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message ?? "No pudimos activar tu plan.");
    }
    router.push("/hoy");
    router.refresh();
  }

  return <OnboardingFlow onActivate={onActivate} />;
}
