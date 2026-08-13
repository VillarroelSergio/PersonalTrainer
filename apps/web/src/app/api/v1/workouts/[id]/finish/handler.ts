import { z } from "zod";
import { createWorkoutSessionRepository, VersionConflictError, WorkoutNotFoundError } from "@/features/workouts/domain/workout-session-repository";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

const finishBodySchema = z.object({
  clientOperationId: z.string().min(1),
  baseVersion: z.number().int().nonnegative(),
  status: z.enum(["completed", "adapted", "partial"]),
  globalEffort: z.number().int().min(1).max(10).nullable().optional(),
  comment: z.string().max(500).nullable().optional(),
  discomfort: z.object({ zone: z.enum(["neck", "shoulder", "back", "elbow", "wrist", "hip", "knee", "ankle"]), side: z.enum(["left", "right", "center"]).optional(), intensity: z.enum(["mild", "moderate", "important"]), kind: z.enum(["pain", "stiffness", "fatigue"]).optional() }).nullable().optional()
});

/** Molestias siempre bienestar general declarado; nunca diagnóstico ni tratamiento. `clientOperationId`/`baseVersion` make an offline outbox retry safe: replaying the same operation never re-conflicts, and a genuinely stale close (session changed elsewhere) surfaces VERSION_CONFLICT instead of overwriting silently. */
export async function finishWorkoutResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database, workoutSessionId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = finishBodySchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "El cierre de sesión no es válido.", parsed.error.flatten());
  if (request.headers.get("idempotency-key") !== parsed.data.clientOperationId) {
    return error(400, "VALIDATION_ERROR", "Idempotency-Key debe coincidir con clientOperationId.");
  }

  try {
    const repository = createWorkoutSessionRepository(database, sqliteHandle);
    repository.finishWorkout(user.id, workoutSessionId, parsed.data.clientOperationId, parsed.data.baseVersion, parsed.data.status, parsed.data.globalEffort ?? null, parsed.data.comment ?? null, parsed.data.discomfort ? JSON.stringify(parsed.data.discomfort) : null);
    return Response.json({ data: { ok: true }, meta: {} });
  } catch (cause) {
    if (cause instanceof WorkoutNotFoundError) return error(404, "NOT_FOUND", "No encontramos esa sesión.");
    if (cause instanceof VersionConflictError) return error(409, "VERSION_CONFLICT", "La sesión cambió en otro dispositivo. Elige qué conservar.", { currentVersion: cause.currentVersion });
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
