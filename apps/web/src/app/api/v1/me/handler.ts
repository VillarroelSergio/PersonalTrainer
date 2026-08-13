import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { deleteOwnAccount } from "@/features/account/domain/account-deletion";
import type * as schema from "@/lib/db/schema";

type SessionUser = { id: string } | null;

/** Self-service account + data deletion. Only ever deletes the signed-in account's own row — never accepts a target id from the client. */
export async function deleteOwnAccountResponse(user: SessionUser, database: PostgresJsDatabase<typeof schema>): Promise<Response> {
  if (!user) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Necesitas iniciar sesión.", details: {} } }, { status: 401 });
  await deleteOwnAccount(database, user.id);
  return Response.json({ data: { ok: true }, meta: {} });
}
