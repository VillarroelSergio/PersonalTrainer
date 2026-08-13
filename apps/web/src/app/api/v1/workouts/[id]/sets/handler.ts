import { z } from "zod";
import { createWorkoutSessionRepository, SessionExerciseNotFoundError, WorkoutNotFoundError } from "@/features/workouts/domain/workout-session-repository";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/lib/db/schema";

type SessionUser = { id: string } | null;

const recordSetBodySchema = z.object({
  sessionExerciseId: z.string().min(1),
  setNumber: z.number().int().positive(),
  loadKg: z.number().nonnegative().nullable(),
  repetitions: z.number().int().nonnegative().nullable(),
  difficulty: z.enum(["too_easy", "just_right", "too_hard"]).nullable()
});

const removeSetBodySchema = z.object({
  sessionExerciseId: z.string().min(1),
  setNumber: z.number().int().positive()
});

export async function recordSetResponse(request: Request, user: SessionUser, database: PostgresJsDatabase<typeof schema>, workoutSessionId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = recordSetBodySchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "La serie no es válida.", parsed.error.flatten());

  try {
    const repository = createWorkoutSessionRepository(database);
    await repository.recordSet(user.id, workoutSessionId, parsed.data.sessionExerciseId, parsed.data.setNumber, parsed.data.loadKg, parsed.data.repetitions, parsed.data.difficulty);
    return Response.json({ data: { ok: true }, meta: {} });
  } catch (cause) {
    if (cause instanceof WorkoutNotFoundError || cause instanceof SessionExerciseNotFoundError) return error(404, "NOT_FOUND", "No encontramos esa sesión o ejercicio.");
    throw cause;
  }
}

export async function removeSetResponse(request: Request, user: SessionUser, database: PostgresJsDatabase<typeof schema>, workoutSessionId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesion.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON valido.");
  }

  const parsed = removeSetBodySchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "La serie no es valida.", parsed.error.flatten());

  try {
    const repository = createWorkoutSessionRepository(database);
    await repository.removeSet(user.id, workoutSessionId, parsed.data.sessionExerciseId, parsed.data.setNumber);
    return Response.json({ data: { ok: true }, meta: {} });
  } catch (cause) {
    if (cause instanceof WorkoutNotFoundError || cause instanceof SessionExerciseNotFoundError) return error(404, "NOT_FOUND", "No encontramos esa sesion o ejercicio.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
