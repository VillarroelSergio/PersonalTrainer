import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { favoriteVariant } from "@/lib/db/schema";

type Database = PostgresJsDatabase<typeof schema>;

/** Scoped by owner id from the authenticated session; never accepts a foreign owner id. */
export async function listOwnedFavoriteVariantIds(database: Database, ownerId: string): Promise<string[]> {
  const rows = await database.select({ variantId: favoriteVariant.variantId }).from(favoriteVariant).where(eq(favoriteVariant.ownerId, ownerId));
  return rows.map((row) => row.variantId);
}

export async function addOwnedFavorite(database: Database, ownerId: string, variantId: string): Promise<void> {
  await database.insert(favoriteVariant).values({ ownerId, variantId, createdAt: new Date() }).onConflictDoNothing();
}

export async function removeOwnedFavorite(database: Database, ownerId: string, variantId: string): Promise<void> {
  await database.delete(favoriteVariant).where(and(eq(favoriteVariant.ownerId, ownerId), eq(favoriteVariant.variantId, variantId)));
}
