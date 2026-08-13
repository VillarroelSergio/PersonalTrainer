import { createShareLink, PlanNotFoundError } from "@/features/planning/domain/share-repository";
import type { getDb } from "@/lib/db/client";

type SessionUser = { id: string } | null;

export async function createShareLinkResponse(user: SessionUser, database: ReturnType<typeof getDb>, planId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  try {
    const link = await createShareLink(database, user.id, planId);
    return Response.json({ data: link, meta: {} });
  } catch (cause) {
    if (cause instanceof PlanNotFoundError) return error(404, "NOT_FOUND", "No encontramos ese plan.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
