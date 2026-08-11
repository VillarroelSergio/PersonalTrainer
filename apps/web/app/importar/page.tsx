import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { ImportWizard } from "@/features/endurance/ui/ImportWizard";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_LABEL, isoWeekStart, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

export default async function ImportarPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (!activePlan) redirect("/onboarding");

  const { session: sessionParam } = await searchParams;
  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const enduranceSessions = (content.week?.sessions ?? [])
    .map((entry, sessionIndex) => ({ sessionIndex, day: entry.day, title: entry.title, kind: entry.kind }))
    .filter((entry) => entry.kind === "endurance")
    .map((entry) => ({ sessionIndex: entry.sessionIndex, label: `${entry.title} (${WEEKDAY_LABEL[entry.day as Weekday]})` }));

  return (
    <AppShell title="Importar actividad" backHref="/hoy">
      <ImportWizard isoWeekStart={isoWeekStart()} enduranceSessions={enduranceSessions} initialSessionIndex={sessionParam != null ? Number(sessionParam) : null} />
    </AppShell>
  );
}
