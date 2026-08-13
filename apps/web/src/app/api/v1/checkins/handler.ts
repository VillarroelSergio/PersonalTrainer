import { z } from "zod";
import { checkinInputSchema } from "@/contracts/training-engine";
import { ActivePlanNotFoundError, createWorkoutTrainingEngineRepository } from "@/features/training-engine/domain/repository";
import { isoDate } from "@/lib/weekdays";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

const submitCheckinBodySchema = checkinInputSchema.extend({ checkinDate: z.string().date().optional() });

export async function submitCheckinResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = submitCheckinBodySchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Check-in inválido.", parsed.error.flatten());

  const { checkinDate, ...input } = parsed.data;

  try {
    const repository = createWorkoutTrainingEngineRepository(database, sqliteHandle);
    const recommendation = repository.submitCheckin(user.id, checkinDate ?? isoDate(), input);
    return Response.json({ data: recommendation, meta: {} });
  } catch (cause) {
    if (cause instanceof ActivePlanNotFoundError) return error(404, "NOT_FOUND", "No tienes un plan activo todavía.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
