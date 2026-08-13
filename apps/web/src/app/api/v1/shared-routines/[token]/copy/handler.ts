import { createShareCopyRepository, ShareLinkNotFoundError } from "@/features/planning/domain/share-repository";
import type { getDb } from "@/lib/db/client";

type SessionUser = { id: string } | null;

/** Copying requires an authenticated account (a different provisioned account, or the same one starting over) — the copy is owned by whoever is signed in, never by whatever identity the token implies. */
export async function copySharedRoutineResponse(user: SessionUser, database: ReturnType<typeof getDb>, token: string): Promise<Response> {
  if (!user) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Necesitas iniciar sesión.", details: {} } }, { status: 401 });

  try {
    const repository = createShareCopyRepository(database);
    const result = await repository.copySharedRoutine(token, user.id);
    return Response.json({ data: result, meta: {} });
  } catch (cause) {
    if (cause instanceof ShareLinkNotFoundError) return Response.json({ error: { code: "NOT_FOUND", message: "Este enlace no existe o ya no está disponible.", details: {} } }, { status: 404 });
    throw cause;
  }
}
