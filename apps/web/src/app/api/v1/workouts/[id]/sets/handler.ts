import { z } from "zod";
import { createWorkoutSessionRepository, SessionExerciseNotFoundError, WorkoutNotFoundError } from "@/features/workouts/domain/workout-session-repository";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

const recordSetBodySchema = z.object({
  sessionExerciseId: z.string().min(1),
  setNumber: z.number().int().positive(),
  loadKg: z.number().nonnegative().nullable(),
  repetitions: z.number().int().nonnegative().nullable(),
  difficulty: z.enum(["too_easy", "just_right", "too_hard"]).nullable()
});

export async function recordSetResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database, workoutSessionId: string): Promise<Response> {
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
    const repository = createWorkoutSessionRepository(database, sqliteHandle);
    repository.recordSet(user.id, workoutSessionId, parsed.data.sessionExerciseId, parsed.data.setNumber, parsed.data.loadKg, parsed.data.repetitions, parsed.data.difficulty);
    return Response.json({ data: { ok: true }, meta: {} });
  } catch (cause) {
    if (cause instanceof WorkoutNotFoundError || cause instanceof SessionExerciseNotFoundError) return error(404, "NOT_FOUND", "No encontramos esa sesión o ejercicio.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
