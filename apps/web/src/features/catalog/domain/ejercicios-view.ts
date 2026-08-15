/**
 * Pure, snapshot-driven view model for "/ejercicios" (Fase 5, Task 6). No React, no fetch: reads
 * account favorites and the 5 most-recently-used variant ids from `snapshot.data`, mirroring what
 * the former server component read via `listOwnedFavoriteVariantIds` and
 * `workoutRepo.listRecentVariantIds(userId, 5)`. The static catalog itself (`EXERCISE_CATALOG`,
 * `findVariant`) has no per-account variation, so the page keeps importing it directly from
 * exercise-catalog.ts instead of reading `snapshot.data.catalog` — same choice already made by
 * `entrenar-view.ts`.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { recentVariantIdsFrom } from "@/features/workouts/domain/entrenar-view";

type FavoriteRow = { variantId: string };
type WorkoutSessionRow = { id: string; planId: string; sessionIndex: number; status: string; startedAt: string | Date };
type SessionExerciseRow = { id: string; workoutSessionId: string; variantId: string };

export type EjerciciosView = {
  favoriteVariantIds: string[];
  recentVariantIds: string[];
};

export function computeEjerciciosView(snapshot: OfflineSnapshot): EjerciciosView {
  const favorites = (snapshot.data.favorites as FavoriteRow[] | undefined) ?? [];
  const favoriteVariantIds = favorites.map((row) => row.variantId);

  const history = snapshot.data.history as { workoutSessions?: WorkoutSessionRow[]; sessionExercises?: SessionExerciseRow[] } | undefined;
  const workoutSessions = history?.workoutSessions ?? [];
  const sessionExercises = history?.sessionExercises ?? [];
  const recentVariantIds = recentVariantIdsFrom(workoutSessions, sessionExercises, 5);

  return { favoriteVariantIds, recentVariantIds };
}
