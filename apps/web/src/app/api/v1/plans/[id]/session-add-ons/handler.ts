import { planSessionAddOnInputSchema } from "@/contracts/plan";
import { InvalidSessionContentError, PlanNotFoundError, createPlanEditRepository } from "@/features/planning/domain/plan-edit-repository";
import type { getDb } from "@/lib/db/client";

type SessionUser = { id: string } | null;

export async function createPlanSessionAddOnResponse(request: Request, user: SessionUser, database: ReturnType<typeof getDb>, planId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");
  const body = await request.json().catch(() => null);
  const parsed = planSessionAddOnInputSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "La rutina opcional no es válida.", parsed.error.flatten());

  try {
    const result = await createPlanEditRepository(database).addRoutineToPlan(user.id, planId, parsed.data);
    return Response.json({ data: result, meta: {} });
  } catch (cause) {
    if (cause instanceof PlanNotFoundError) return error(404, "NOT_FOUND", "No encontramos ese plan.");
    if (cause instanceof InvalidSessionContentError) return error(400, "VALIDATION_ERROR", cause.message);
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}

