import { createShareCopyRepository, ShareLinkNotFoundError } from "@/features/planning/domain/share-repository";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

/** Copying requires an authenticated account (a different provisioned account, or the same one starting over) — the copy is owned by whoever is signed in, never by whatever identity the token implies. */
export async function copySharedRoutineResponse(user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database, token: string): Promise<Response> {
  if (!user) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Necesitas iniciar sesión.", details: {} } }, { status: 401 });

  try {
    const repository = createShareCopyRepository(database, sqliteHandle);
    const result = repository.copySharedRoutine(token, user.id);
    return Response.json({ data: result, meta: {} });
  } catch (cause) {
    if (cause instanceof ShareLinkNotFoundError) return Response.json({ error: { code: "NOT_FOUND", message: "Este enlace no existe o ya no está disponible.", details: {} } }, { status: 404 });
    throw cause;
  }
}
