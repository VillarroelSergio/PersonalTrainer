import type { OfflineSnapshot } from "@/lib/offline/snapshot";

type ActivePlanRow = { id: string; contentJson: string };

export type CheckinView = { redirect: "/onboarding" } | { redirect?: undefined; activePlan: ActivePlanRow };

export function computeCheckinView(snapshot: OfflineSnapshot): CheckinView {
  const activePlan = snapshot.data.activePlan as ActivePlanRow | null | undefined;
  if (!activePlan) return { redirect: "/onboarding" };
  return { activePlan };
}
