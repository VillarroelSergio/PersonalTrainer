import { z } from "zod";
import { deleteOwnedPlan, renameOwnedPlan } from "@/features/planning/domain/training-plan-repository";
import type { getDb } from "@/lib/db/client";

type SessionUser = { id: string } | null;
const renamePlanSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function renamePlanResponse(request: Request, user: SessionUser, database: ReturnType<typeof getDb>, planId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");
  const body = await request.json().catch(() => null);
  const parsed = renamePlanSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Escribe un nombre de hasta 80 caracteres.", parsed.error.flatten());

  const plan = await renameOwnedPlan(database, planId, user.id, parsed.data.name);
  if (!plan) return error(404, "NOT_FOUND", "No encontramos ese plan.");
  return Response.json({ data: plan, meta: {} });
}

export async function deletePlanResponse(user: SessionUser, database: ReturnType<typeof getDb>, planId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");
  const deleted = await deleteOwnedPlan(database, planId, user.id);
  if (!deleted) return error(404, "NOT_FOUND", "No encontramos ese plan.");
  return Response.json({ data: { ok: true }, meta: {} });
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
