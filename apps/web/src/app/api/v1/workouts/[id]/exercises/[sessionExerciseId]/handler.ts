import { z } from "zod";
import { createWorkoutSessionRepository, SessionExerciseNotFoundError, WorkoutNotFoundError } from "@/features/workouts/domain/workout-session-repository";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/lib/db/schema";

type SessionUser = { id: string } | null;

const substituteBodySchema = z.object({ variantId: z.string().min(1) });

export async function substituteVariantResponse(request: Request, user: SessionUser, database: PostgresJsDatabase<typeof schema>, workoutSessionId: string, sessionExerciseId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = substituteBodySchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "variantId es obligatorio.", parsed.error.flatten());

  try {
    const repository = createWorkoutSessionRepository(database);
    const replacement = await repository.substituteVariant(user.id, workoutSessionId, sessionExerciseId, parsed.data.variantId);
    return Response.json({ data: replacement, meta: {} });
  } catch (cause) {
    if (cause instanceof WorkoutNotFoundError || cause instanceof SessionExerciseNotFoundError) return error(404, "NOT_FOUND", "No encontramos esa sesión, ejercicio o variante.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
