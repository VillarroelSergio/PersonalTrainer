/**
 * Pure, snapshot-driven view model for "/entrenar" (Fase 5, Task 6). No React, no fetch: mirrors
 * what the former server component derived from `session`/`db` — favorites, recent variants,
 * latest per-session statuses and the planned strength session — read entirely from
 * `snapshot.data`. Pure functions can't call `redirect()`, so an invalid/missing session is
 * reported as `{ redirect: "/hoy" }` for the page component to act on.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import type { PlanProposal } from "@/contracts/onboarding";

type ActivePlanRow = { id: string; name: string; contentJson: string };
type FavoriteRow = { variantId: string };
type WorkoutSessionRow = { id: string; planId: string; sessionIndex: number; status: string; startedAt: string | Date };
type SessionExerciseRow = { id: string; workoutSessionId: string; variantId: string };

type PlannedSession = PlanProposal["week"]["sessions"][number];

export type EntrenarView =
  | { redirect: "/hoy" }
  | {
      redirect?: undefined;
      activePlan: ActivePlanRow;
      plannedSession: PlannedSession;
      favoriteVariantIds: string[];
      recentVariantIds: string[];
      isResuming: boolean;
    };

/** Mirrors `workout-session-repository.ts`'s `listLatestStatuses`: all-time latest status per
 * session index for this plan (ordered ascending by startedAt, last write wins) — not week-scoped,
 * unlike `/hoy`'s `latestWeekStatuses`. */
function latestStatusesForPlan(workoutSessions: WorkoutSessionRow[], planId: string): Record<number, string> {
  const rows = workoutSessions
    .filter((row) => row.planId === planId)
    .slice()
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  const byIndex: Record<number, string> = {};
  for (const row of rows) byIndex[row.sessionIndex] = row.status;
  return byIndex;
}

/** Mirrors `workout-session-repository.ts`'s `listRecentVariantIds`: most-recently-used distinct
 * variant ids across this account's real history, newest first. */
export function recentVariantIdsFrom(workoutSessions: WorkoutSessionRow[], sessionExercises: SessionExerciseRow[], limit: number): string[] {
  const startedAtByWorkout = new Map(workoutSessions.map((row) => [row.id, new Date(row.startedAt).getTime()]));
  const rows = sessionExercises
    .map((row) => ({ variantId: row.variantId, startedAt: startedAtByWorkout.get(row.workoutSessionId) ?? 0 }))
    .sort((a, b) => a.startedAt - b.startedAt)
    .reverse();
  const seen = new Set<string>();
  const recent: string[] = [];
  for (const row of rows) {
    if (seen.has(row.variantId)) continue;
    seen.add(row.variantId);
    recent.push(row.variantId);
    if (recent.length >= limit) break;
  }
  return recent;
}

export function computeEntrenarView(snapshot: OfflineSnapshot, sessionIndex: number): EntrenarView {
  const activePlan = snapshot.data.activePlan as ActivePlanRow;
  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const plannedSession = content.week?.sessions?.[sessionIndex];
  if (!plannedSession || plannedSession.kind !== "strength" || !plannedSession.exercises?.length) return { redirect: "/hoy" };

  const favorites = (snapshot.data.favorites as FavoriteRow[] | undefined) ?? [];
  const favoriteVariantIds = favorites.map((row) => row.variantId);

  const history = snapshot.data.history as { workoutSessions?: WorkoutSessionRow[]; sessionExercises?: SessionExerciseRow[] } | undefined;
  const workoutSessions = history?.workoutSessions ?? [];
  const sessionExercises = history?.sessionExercises ?? [];
  const recentVariantIds = recentVariantIdsFrom(workoutSessions, sessionExercises, 6);
  const statuses = latestStatusesForPlan(workoutSessions, activePlan.id);
  const isResuming = statuses[sessionIndex] === "in_progress";

  return { activePlan, plannedSession, favoriteVariantIds, recentVariantIds, isResuming };
}
