import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { addOwnedFavorite, removeOwnedFavorite } from "@/features/catalog/domain/favorite-repository";
import type * as schema from "@/lib/db/schema";

type SessionUser = { id: string } | null;

export async function putFavoriteResponse(user: SessionUser, database: PostgresJsDatabase<typeof schema>, variantId: string): Promise<Response> {
  if (!user) return unauthenticated();
  await addOwnedFavorite(database, user.id, variantId);
  return Response.json({ data: { ok: true }, meta: {} });
}

export async function deleteFavoriteResponse(user: SessionUser, database: PostgresJsDatabase<typeof schema>, variantId: string): Promise<Response> {
  if (!user) return unauthenticated();
  await removeOwnedFavorite(database, user.id, variantId);
  return Response.json({ data: { ok: true }, meta: {} });
}

function unauthenticated() {
  return Response.json({ error: { code: "UNAUTHENTICATED", message: "Necesitas iniciar sesión.", details: {} } }, { status: 401 });
}
