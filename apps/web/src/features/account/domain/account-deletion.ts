import { and, eq, isNull } from "drizzle-orm";
import type { db as productionDb } from "@/lib/db/client";
import { importFile, session, user } from "@/lib/db/schema";
import { deleteUploadedFile } from "@/features/endurance/domain/storage";

/**
 * Deletes the account and every owned row via the `ON DELETE CASCADE`
 * already wired on every owner_id foreign key (see schema.ts, active since
 * Fase 0's `PRAGMA foreign_keys = ON`) — training plans, sessions, sets,
 * check-ins, recommendations, body metrics, imports, endurance activities,
 * share links/copies, all of it. The one thing cascade can't reach is bytes
 * on disk, so private upload files are unlinked first.
 */
export async function deleteOwnAccount(database: typeof productionDb, ownerId: string): Promise<void> {
  const remainingFiles = await database.query.importFile.findMany({ where: and(eq(importFile.ownerId, ownerId), isNull(importFile.deletedAt)) });
  for (const file of remainingFiles) deleteUploadedFile(file.storageKey);

  // SQLite installations created before foreign keys were enforced can retain
  // Better Auth session rows after the user disappears. Remove them explicitly
  // so a deleted account never leaves a valid-looking, unusable browser cookie.
  await database.delete(session).where(eq(session.userId, ownerId));
  await database.delete(user).where(eq(user.id, ownerId));
}
