import { planEditInputSchema } from "@/contracts/plan";
import {
  AdjustmentNotFoundError,
  InvalidSessionIndexError,
  InvalidWeekStartError,
  PastWeekError,
  PlanNotFoundError,
  SessionAlreadyExecutedError,
  createPlanEditRepository
} from "@/features/planning/domain/plan-edit-repository";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

export async function createPlanSessionEditResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database, planId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = planEditInputSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Edición de plan inválida.", parsed.error.flatten());

  try {
    const repository = createPlanEditRepository(database, sqliteHandle);
    const result = repository.applyEdit(user.id, planId, parsed.data);
    return Response.json({ data: result, meta: {} });
  } catch (cause) {
    if (cause instanceof PlanNotFoundError) return error(404, "NOT_FOUND", "No encontramos ese plan.");
    if (cause instanceof PastWeekError) return error(400, "VALIDATION_ERROR", cause.message);
    if (cause instanceof InvalidWeekStartError) return error(400, "VALIDATION_ERROR", cause.message);
    if (cause instanceof SessionAlreadyExecutedError) return error(400, "VALIDATION_ERROR", cause.message);
    if (cause instanceof InvalidSessionIndexError) return error(400, "VALIDATION_ERROR", cause.message);
    if (cause instanceof AdjustmentNotFoundError) return error(404, "NOT_FOUND", cause.message);
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
