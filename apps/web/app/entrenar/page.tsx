import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { listOwnedFavoriteVariantIds } from "@/features/catalog/domain/favorite-repository";
import { WorkoutRunner } from "@/features/workouts/ui/WorkoutRunner";
import { AppShell } from "@/components/AppShell";
import { WEEKDAY_LABEL, type Weekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

export default async function EntrenarPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const db = getDb();
  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (!activePlan) redirect("/onboarding");

  const { session: sessionParam } = await searchParams;
  const sessionIndex = Number(sessionParam ?? "0");
  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const plannedSession = content.week?.sessions?.[sessionIndex];
  if (!plannedSession || plannedSession.kind !== "strength" || !plannedSession.exercises?.length) redirect("/hoy");

  // Vista previa (P0-1): la lista y los favoritos/recientes se resuelven aquí, en el
  // servidor, con los mismos repositorios que ya usa /ejercicios — la sesión real
  // (POST /api/v1/workouts) no se crea hasta que la persona pulsa "Empezar sesión".
  const workoutRepo = createWorkoutSessionRepository(db);
  const [favoriteVariantIds, recentVariantIds, statuses] = await Promise.all([
    listOwnedFavoriteVariantIds(db, session.user.id),
    workoutRepo.listRecentVariantIds(session.user.id, 6),
    workoutRepo.listLatestStatuses(session.user.id, activePlan.id)
  ]);
  // "Continuar sesión" en /hoy enlaza aquí igual que "Empezar sesión": si ya existe una
  // sesión in_progress para este índice, se entra directo a ella sin pasar por la vista
  // previa ni exigir un segundo toque en "Empezar sesión".
  const isResuming = statuses[sessionIndex] === "in_progress";

  return (
    <AppShell title="Entrenar" backHref="/hoy">
      <p className="kicker">{WEEKDAY_LABEL[plannedSession.day as Weekday]}</p>
      <h1 className="view-title">{plannedSession.title}</h1>
      <WorkoutRunner
        planId={activePlan.id}
        sessionIndex={sessionIndex}
        previewExercises={plannedSession.exercises}
        previewBlocks={plannedSession.blocks ?? []}
        favoriteVariantIds={favoriteVariantIds}
        recentVariantIds={recentVariantIds}
        autoStart={isResuming}
      />
    </AppShell>
  );
}
