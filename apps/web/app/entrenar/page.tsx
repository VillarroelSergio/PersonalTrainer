import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { WorkoutRunner } from "@/features/workouts/ui/WorkoutRunner";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_LABEL, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

export default async function EntrenarPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (!activePlan) redirect("/onboarding");

  const { session: sessionParam } = await searchParams;
  const sessionIndex = Number(sessionParam ?? "0");
  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const plannedSession = content.week?.sessions?.[sessionIndex];
  if (!plannedSession || plannedSession.kind !== "strength") redirect("/hoy");

  return (
    <AppShell title="Entrenar" backHref="/hoy">
      <p className="kicker">{WEEKDAY_LABEL[plannedSession.day as Weekday]}</p>
      <h1 className="view-title">{plannedSession.title}</h1>
      <WorkoutRunner planId={activePlan.id} sessionIndex={sessionIndex} />
    </AppShell>
  );
}
