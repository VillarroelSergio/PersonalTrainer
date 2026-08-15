import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { EXERCISE_CATALOG } from "@/features/catalog/data/exercise-catalog";
import { listPlansForOwner } from "@/features/planning/domain/training-plan-repository";
import type * as schema from "@/lib/db/schema";
import {
  activityImport,
  activityMetric,
  checkin,
  enduranceActivity,
  favoriteVariant,
  importFile,
  onboardingDraft,
  performanceBaseline,
  recommendation,
  recoverySession,
  sessionAdjustment,
  sessionExercise,
  setPerformance,
  trainingPlan,
  user,
  workoutSession
} from "@/lib/db/schema";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";

type SessionUser = { id: string } | null;
type Db = PostgresJsDatabase<typeof schema>;

/**
 * Read model for local-first offline rendering (Fase 5, Task 2). Every query is scoped to
 * `user.id` only — never selects the `account`/`session` tables (credentials, tokens) and
 * never selects `import_file.storage_key` or any signed/upload URL, per the plan's invariants.
 */
export async function createOfflineSnapshotResponse(request: Request, user_: SessionUser, database: Db): Promise<Response> {
  if (!user_) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Necesitas iniciar sesión.", details: {} } }, { status: 401 });
  const ownerId = user_.id;

  const [profileRow] = await database.select({ id: user.id, name: user.name, email: user.email }).from(user).where(eq(user.id, ownerId));
  const [draft] = await database.select({ formJson: onboardingDraft.formJson, updatedAt: onboardingDraft.updatedAt }).from(onboardingDraft).where(eq(onboardingDraft.ownerId, ownerId));
  const [activePlan] = await database.select().from(trainingPlan).where(and(eq(trainingPlan.ownerId, ownerId), eq(trainingPlan.status, "active")));
  // Every plan the owner has ever had (draft/active/archived), not just the active one — "/plan"'s
  // "Tus planes" tab (Fase 5, Task 6) needs the full list to read offline, same raw owner-scoped
  // dump pattern already used for enduranceActivities/performanceBaselines below.
  const plans = await listPlansForOwner(database, ownerId);

  const planEdits = await database.select().from(sessionAdjustment).where(eq(sessionAdjustment.ownerId, ownerId));
  const checkins = await database.select().from(checkin).where(eq(checkin.ownerId, ownerId));
  const recommendations = await database.select().from(recommendation).where(eq(recommendation.ownerId, ownerId));
  const recoverySessions = await database.select().from(recoverySession).where(eq(recoverySession.ownerId, ownerId));
  const favorites = await database.select().from(favoriteVariant).where(eq(favoriteVariant.ownerId, ownerId));

  const workoutSessions = await database.select().from(workoutSession).where(eq(workoutSession.ownerId, ownerId));
  const workoutSessionIds = workoutSessions.map((row) => row.id);
  const sessionExercises = workoutSessionIds.length === 0 ? [] : await database.select().from(sessionExercise).where(inArray(sessionExercise.workoutSessionId, workoutSessionIds));
  const sessionExerciseIds = sessionExercises.map((row) => row.id);
  const setPerformances = sessionExerciseIds.length === 0 ? [] : await database.select().from(setPerformance).where(inArray(setPerformance.sessionExerciseId, sessionExerciseIds));

  // import_file: metadata only, storage_key deliberately excluded (it is a private storage path, not a secret,
  // but the plan's invariant treats it like a storage URL — never leaves the server-side snapshot).
  const importFiles = await database
    .select({ id: importFile.id, originalName: importFile.originalName, format: importFile.format, sizeBytes: importFile.sizeBytes, uploadedAt: importFile.uploadedAt, deletedAt: importFile.deletedAt })
    .from(importFile)
    .where(eq(importFile.ownerId, ownerId));
  const activityImports = await database
    .select({ id: activityImport.id, fileId: activityImport.fileId, format: activityImport.format, status: activityImport.status, errorCode: activityImport.errorCode, duplicateOfActivityId: activityImport.duplicateOfActivityId, createdAt: activityImport.createdAt })
    .from(activityImport)
    .where(eq(activityImport.ownerId, ownerId));

  // enduranceActivity/activityMetric/performanceBaseline: raw owner-scoped dumps, no joins — /historial
  // and /plan's ProgressSection do the joining/aggregation client-side (Fase 5, Task 6).
  // activity_metric has no owner_id column (see schema.ts): scoped via its parent activity ids instead.
  const enduranceActivities = await database.select().from(enduranceActivity).where(eq(enduranceActivity.ownerId, ownerId));
  const enduranceActivityIds = enduranceActivities.map((row) => row.id);
  const activityMetrics = enduranceActivityIds.length === 0 ? [] : await database.select().from(activityMetric).where(inArray(activityMetric.activityId, enduranceActivityIds));
  const performanceBaselines = await database.select().from(performanceBaseline).where(eq(performanceBaseline.ownerId, ownerId));

  const snapshot: OfflineSnapshot = {
    userId: ownerId,
    syncedAt: Date.now(),
    data: {
      profile: profileRow ?? null,
      onboardingDraft: draft ? { ...draft, form: JSON.parse(draft.formJson) } : null,
      activePlan: activePlan ?? null,
      plans,
      planEdits,
      history: { workoutSessions, sessionExercises, setPerformances },
      recoverySessions,
      checkins,
      recommendations,
      favorites,
      activityImports: { imports: activityImports, files: importFiles },
      enduranceActivities,
      activityMetrics,
      performanceBaselines,
      catalog: EXERCISE_CATALOG
    }
  };

  return Response.json({ data: { snapshot, serverTime: Date.now() }, meta: {} });
}
