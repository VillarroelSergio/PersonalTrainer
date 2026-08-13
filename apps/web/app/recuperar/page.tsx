import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { createRecoverySessionRepository } from "@/features/recovery/domain/recovery-session-repository";
import { AppShell } from "@/components/AppShell";
import { RecoveryRunner } from "@/features/recovery/ui/RecoveryRunner";
import type { PlanProposal } from "@/contracts/onboarding";

export default async function RecuperarPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const activePlan = await findActivePlanForOwner(getDb(), session.user.id);
  if (!activePlan) redirect("/onboarding");

  const { session: sessionParam } = await searchParams;
  const sessionIndex = Number.parseInt(sessionParam ?? "", 10);
  const proposal = JSON.parse(activePlan.contentJson) as PlanProposal;
  const plannedSession = Number.isInteger(sessionIndex) ? proposal.week?.sessions?.[sessionIndex] : null;
  if (!plannedSession) redirect("/hoy");

  const repository = createRecoverySessionRepository(getDb());
  const existing = await repository.findLatest(session.user.id, activePlan.id, sessionIndex);

  return (
    <AppShell title="Trainer" backHref="/hoy">
      <RecoveryRunner
        planId={activePlan.id}
        sessionIndex={sessionIndex}
        sessionTitle={plannedSession.title}
        initialSessionId={existing?.id ?? null}
        initialStatus={existing?.status ?? null}
      />
    </AppShell>
  );
}
