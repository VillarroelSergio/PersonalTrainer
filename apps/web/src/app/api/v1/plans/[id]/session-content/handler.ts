import { planSessionContentInputSchema } from "@/contracts/plan";
import {
  InvalidSessionContentError,
  InvalidSessionIndexError,
  InvalidWeekStartError,
  PastWeekError,
  PlanNotFoundError,
  SessionAlreadyExecutedError,
  createPlanEditRepository
} from "@/features/planning/domain/plan-edit-repository";
import type { getDb } from "@/lib/db/client";

type SessionUser = { id: string } | null;

export async function createPlanSessionContentResponse(request: Request, user: SessionUser, database: ReturnType<typeof getDb>, planId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");
  const body = await request.json().catch(() => null);
  const parsed = planSessionContentInputSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "La edición del contenido de la sesión no es válida.", parsed.error.flatten());

  try {
    const result = await createPlanEditRepository(database).updateSessionContent(user.id, planId, parsed.data);
    return Response.json({ data: result, meta: {} });
  } catch (cause) {
    if (cause instanceof PlanNotFoundError) return error(404, "NOT_FOUND", "No encontramos ese plan.");
    if (cause instanceof PastWeekError || cause instanceof InvalidWeekStartError || cause instanceof SessionAlreadyExecutedError || cause instanceof InvalidSessionIndexError || cause instanceof InvalidSessionContentError) {
      return error(400, "VALIDATION_ERROR", cause.message);
    }
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
