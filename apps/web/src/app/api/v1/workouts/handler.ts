import { z } from "zod";
import { createWorkoutSessionRepository, PlanNotFoundError, SessionNotStrengthError } from "@/features/workouts/domain/workout-session-repository";
import { createWorkoutTrainingEngineRepository } from "@/features/training-engine/domain/repository";
import { isoWeekStart } from "@/lib/weekdays";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

const startWorkoutBodySchema = z.object({ planId: z.string().min(1), sessionIndex: z.number().int().nonnegative() });

export async function startWorkoutResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = startWorkoutBodySchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "planId y sessionIndex son obligatorios.", parsed.error.flatten());

  try {
    const repository = createWorkoutSessionRepository(database, sqliteHandle);
    const engineRepository = createWorkoutTrainingEngineRepository(database, sqliteHandle);
    const adjustment = engineRepository.getAdjustment(user.id, parsed.data.planId, isoWeekStart(), parsed.data.sessionIndex);
    const ops = adjustment && (adjustment.kind === "reduce_time" || adjustment.kind === "equipment_substitution") ? JSON.parse(adjustment.opsJson) : [];
    const result = repository.startOrResumeWorkout(user.id, parsed.data.planId, parsed.data.sessionIndex, ops);
    return Response.json({ data: result, meta: {} });
  } catch (cause) {
    if (cause instanceof PlanNotFoundError) return error(404, "NOT_FOUND", "No encontramos ese plan.");
    if (cause instanceof SessionNotStrengthError) return error(400, "VALIDATION_ERROR", "Esa sesión no tiene ejercicios de fuerza asignados.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
