/**
 * Pure, snapshot-driven view model for "/recuperar". The page must not rely on
 * cached server props because those can belong to an old account/session; it
 * reconstructs the runner inputs from the active offline snapshot instead.
 */

import type { PlanProposal } from "@/contracts/onboarding";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";

type ActivePlanRow = { id: string; name?: string; contentJson: string };
type RecoverySessionRow = { id: string; planId: string; sessionIndex: number; status: string; startedAt?: string | Date };

export type RecoveryView =
  | { redirect: "/hoy" }
  | {
      redirect?: undefined;
      activePlan: ActivePlanRow;
      sessionIndex: number;
      sessionTitle: string;
      initialSessionId: string | null;
      initialStatus: string | null;
    };

export function computeRecoveryView(snapshot: OfflineSnapshot, sessionParam: string | undefined): RecoveryView {
  const activePlan = snapshot.data.activePlan as ActivePlanRow;
  const sessionIndex = Number.parseInt(sessionParam ?? "", 10);
  if (!Number.isInteger(sessionIndex)) return { redirect: "/hoy" };

  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const plannedSession = content.week?.sessions?.[sessionIndex];
  if (!plannedSession) return { redirect: "/hoy" };

  const recoverySessions = (snapshot.data.recoverySessions as RecoverySessionRow[] | undefined) ?? [];
  const latest = recoverySessions
    .filter((row) => row.planId === activePlan.id && row.sessionIndex === sessionIndex)
    .slice()
    .sort((a, b) => new Date(a.startedAt ?? 0).getTime() - new Date(b.startedAt ?? 0).getTime())
    .at(-1) ?? null;

  return {
    activePlan,
    sessionIndex,
    sessionTitle: plannedSession.title,
    initialSessionId: latest?.id ?? null,
    initialStatus: latest?.status ?? null
  };
}
