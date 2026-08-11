import { revokeOwnedShareLink, ShareLinkNotFoundError } from "@/features/planning/domain/share-repository";
import type { db as productionDb } from "@/lib/db/client";

type SessionUser = { id: string } | null;

export async function revokeShareLinkResponse(user: SessionUser, database: typeof productionDb, linkId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");
  try {
    await revokeOwnedShareLink(database, user.id, linkId);
    return Response.json({ data: { ok: true }, meta: {} });
  } catch (cause) {
    if (cause instanceof ShareLinkNotFoundError) return error(404, "NOT_FOUND", "No encontramos ese enlace.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
