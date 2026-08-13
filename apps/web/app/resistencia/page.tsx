import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { createEnduranceDesignRepository } from "@/features/endurance/domain/design-repository";
import { EnduranceDesigner } from "@/features/endurance/ui/EnduranceDesigner";
import { EnduranceEmptyState } from "@/features/endurance/ui/EnduranceEmptyState";
import { weeklyLoadWarning } from "@/features/planning/domain/plan-week";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_LABEL, isoWeekStart, todayWeekday, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

export default async function ResistenciaPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const db = getDb();
  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (!activePlan) redirect("/onboarding");

  const { session: sessionParam } = await searchParams;
  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const sessions = content.week?.sessions ?? [];

  // No explicit ?session= given: resolve like the prototype's resolveSession — today's
  // session if it's endurance, otherwise no session (never default to index 0).
  const sessionIndex = sessionParam !== undefined ? Number(sessionParam) : sessions.findIndex((entry) => entry.day === todayWeekday());
  const plannedSession = sessionIndex >= 0 ? sessions[sessionIndex] : undefined;

  if (!plannedSession || plannedSession.kind !== "endurance") {
    // An explicit link pointed at a non-endurance/invalid session (e.g. a strength session id):
    // no dedicated screen for that case here, send to /hoy. Only the "nothing planned today"
    // case (no ?session= param) gets the six-objectives empty state.
    if (sessionParam !== undefined) redirect("/hoy");
    return (
      <AppShell title="Resistencia" backHref="/hoy">
        <h1 className="view-title">Resistencia</h1>
        <EnduranceEmptyState />
      </AppShell>
    );
  }

  const weekStart = isoWeekStart();
  const designRepo = createEnduranceDesignRepository(db);
  const design = await designRepo.getDesign(session.user.id, activePlan.id, weekStart, sessionIndex);

  // Load-clash notice (prototype endurance.js L133-146): reuses the same weeklyLoadWarning
  // the /hoy page already uses, so "choque de carga" means one thing across the app.
  const warning = weeklyLoadWarning(sessions);
  const conflictText =
    warning && warning.session === plannedSession
      ? `${plannedSession.title} es una sesión intensa y está junto a ${warning.conflict.title.toLowerCase()} (piernas), lo que puede sumar fatiga. Puedes ajustarla o seguir tal como está: tú decides.`
      : null;

  return (
    <AppShell title="Resistencia" backHref="/hoy">
      <p className="kicker">{WEEKDAY_LABEL[plannedSession.day as Weekday]} · {plannedSession.estimatedMinutes} min aproximados</p>
      <h1 className="view-title">{plannedSession.title}</h1>
      <EnduranceDesigner
        planId={activePlan.id}
        sessionIndex={sessionIndex}
        isoWeekStart={weekStart}
        conflictText={conflictText}
        initialDesign={
          design
            ? { id: design.id, objective: design.objective as never, environment: design.environment as never, optionalLayers: design.optionalLayersJson ? JSON.parse(design.optionalLayersJson) : {}, watchPreparedAt: design.watchPreparedAt ? design.watchPreparedAt.toISOString() : null }
            : null
        }
      />
    </AppShell>
  );
}
