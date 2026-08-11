import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db, sqlite } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { createEnduranceDesignRepository } from "@/features/endurance/domain/design-repository";
import { EnduranceDesigner } from "@/features/endurance/ui/EnduranceDesigner";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_LABEL, isoWeekStart, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

export default async function ResistenciaPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (!activePlan) redirect("/onboarding");

  const { session: sessionParam } = await searchParams;
  const sessionIndex = Number(sessionParam ?? "0");
  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const plannedSession = content.week?.sessions?.[sessionIndex];
  if (!plannedSession || plannedSession.kind !== "endurance") redirect("/hoy");

  const weekStart = isoWeekStart();
  const designRepo = createEnduranceDesignRepository(db, sqlite);
  const design = designRepo.getDesign(session.user.id, activePlan.id, weekStart, sessionIndex);

  return (
    <AppShell title="Resistencia" backHref="/hoy">
      <p className="kicker">{WEEKDAY_LABEL[plannedSession.day as Weekday]} · {plannedSession.estimatedMinutes} min aproximados</p>
      <h1 className="view-title">{plannedSession.title}</h1>
      <EnduranceDesigner
        sessionIndex={sessionIndex}
        isoWeekStart={weekStart}
        initialDesign={
          design
            ? { id: design.id, objective: design.objective as never, environment: design.environment as never, optionalLayers: design.optionalLayersJson ? JSON.parse(design.optionalLayersJson) : {}, watchPreparedAt: design.watchPreparedAt ? design.watchPreparedAt.toISOString() : null }
            : null
        }
      />
    </AppShell>
  );
}
