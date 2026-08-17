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
  enduranceSessionDesign,
  favoriteVariant,
  importFile,
  onboardingDraft,
  performanceBaseline,
  recommendation,
  recoverySession,
  sessionAdjustment,
  sessionExercise,
  setPerformance,
  shareLink,
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

  // Issued as three dependency waves rather than one await per table. These reads are
  // independent and owner-scoped, but awaiting them in sequence paid a separate pooler
  // round-trip each: measured against production, 18 serial queries put this endpoint at
  // ~960ms, and it is fetched on every app open and after every outbox flush. Only the
  // three id-scoped reads below genuinely depend on an earlier result.
  const [
    profileRows,
    draftRows,
    activePlanRows,
    // Every plan the owner has ever had (draft/active/archived), not just the active one — "/plan"'s
    // "Tus planes" tab (Fase 5, Task 6) needs the full list to read offline, same raw owner-scoped
    // dump pattern already used for enduranceActivities/performanceBaselines below.
    plans,
    planEdits,
    checkins,
    recommendations,
    recoverySessions,
    favorites,
    workoutSessions,
    // import_file: metadata only, storage_key deliberately excluded (it is a private storage path, not a secret,
    // but the plan's invariant treats it like a storage URL — never leaves the server-side snapshot).
    importFiles,
    activityImports,
    // enduranceActivity/activityMetric/performanceBaseline: raw owner-scoped dumps, no joins — /historial
    // and /plan's ProgressSection do the joining/aggregation client-side (Fase 5, Task 6).
    enduranceActivities,
    performanceBaselines,
    // enduranceSessionDesign/shareLink: same raw owner-scoped dump pattern as enduranceActivities
    // above, added for /resistencia and /compartir's offline conversion (Fase 5, Task 6 follow-up).
    enduranceDesigns,
    shareLinks
  ] = await Promise.all([
    database.select({ id: user.id, name: user.name, email: user.email }).from(user).where(eq(user.id, ownerId)),
    database.select({ formJson: onboardingDraft.formJson, updatedAt: onboardingDraft.updatedAt }).from(onboardingDraft).where(eq(onboardingDraft.ownerId, ownerId)),
    database.select().from(trainingPlan).where(and(eq(trainingPlan.ownerId, ownerId), eq(trainingPlan.status, "active"))),
    listPlansForOwner(database, ownerId),
    database.select().from(sessionAdjustment).where(eq(sessionAdjustment.ownerId, ownerId)),
    database.select().from(checkin).where(eq(checkin.ownerId, ownerId)),
    database.select().from(recommendation).where(eq(recommendation.ownerId, ownerId)),
    database.select().from(recoverySession).where(eq(recoverySession.ownerId, ownerId)),
    database.select().from(favoriteVariant).where(eq(favoriteVariant.ownerId, ownerId)),
    database.select().from(workoutSession).where(eq(workoutSession.ownerId, ownerId)),
    database
      .select({ id: importFile.id, originalName: importFile.originalName, format: importFile.format, sizeBytes: importFile.sizeBytes, uploadedAt: importFile.uploadedAt, deletedAt: importFile.deletedAt })
      .from(importFile)
      .where(eq(importFile.ownerId, ownerId)),
    database
      .select({ id: activityImport.id, fileId: activityImport.fileId, format: activityImport.format, status: activityImport.status, errorCode: activityImport.errorCode, duplicateOfActivityId: activityImport.duplicateOfActivityId, createdAt: activityImport.createdAt })
      .from(activityImport)
      .where(eq(activityImport.ownerId, ownerId)),
    database.select().from(enduranceActivity).where(eq(enduranceActivity.ownerId, ownerId)),
    database.select().from(performanceBaseline).where(eq(performanceBaseline.ownerId, ownerId)),
    database.select().from(enduranceSessionDesign).where(eq(enduranceSessionDesign.ownerId, ownerId)),
    database.select().from(shareLink).where(eq(shareLink.ownerId, ownerId))
  ]);

  const [profileRow] = profileRows;
  const [draft] = draftRows;
  const [activePlan] = activePlanRows;

  // activity_metric has no owner_id column (see schema.ts): scoped via its parent activity ids instead.
  const workoutSessionIds = workoutSessions.map((row) => row.id);
  const enduranceActivityIds = enduranceActivities.map((row) => row.id);
  const [sessionExercises, activityMetrics] = await Promise.all([
    workoutSessionIds.length === 0 ? [] : database.select().from(sessionExercise).where(inArray(sessionExercise.workoutSessionId, workoutSessionIds)),
    enduranceActivityIds.length === 0 ? [] : database.select().from(activityMetric).where(inArray(activityMetric.activityId, enduranceActivityIds))
  ]);

  const sessionExerciseIds = sessionExercises.map((row) => row.id);
  const setPerformances = sessionExerciseIds.length === 0 ? [] : await database.select().from(setPerformance).where(inArray(setPerformance.sessionExerciseId, sessionExerciseIds));

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
      enduranceDesigns,
      shareLinks,
      catalog: EXERCISE_CATALOG
    }
  };

  return Response.json({ data: { snapshot, serverTime: Date.now() }, meta: {} });
}
