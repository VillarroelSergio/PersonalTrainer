import { listOwnedShareLinks } from "@/features/planning/domain/share-repository";
import type { getDb } from "@/lib/db/client";

type SessionUser = { id: string } | null;

export async function listShareLinksResponse(user: SessionUser, database: ReturnType<typeof getDb>): Promise<Response> {
  if (!user) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Necesitas iniciar sesión.", details: {} } }, { status: 401 });
  const links = await listOwnedShareLinks(database, user.id);
  return Response.json({ data: links, meta: {} });
}
