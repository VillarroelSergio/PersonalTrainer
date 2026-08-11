import { z } from "zod";
import { createRecoverySessionRepository, RecoverySessionAlreadyClosedError, RecoverySessionNotFoundError } from "@/features/recovery/domain/recovery-session-repository";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

const finishInputSchema = z.object({ comment: z.string().max(500).nullable().optional() });

export async function finishRecoverySessionResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database, id: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown = {};
  const rawText = await request.text();
  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
    }
  }
  const parsed = finishInputSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const repository = createRecoverySessionRepository(database, sqliteHandle);
    const session = repository.finish(user.id, id, parsed.data.comment ?? null);
    return Response.json({ data: session, meta: {} });
  } catch (cause) {
    if (cause instanceof RecoverySessionNotFoundError) return error(404, "NOT_FOUND", "No encontramos esa sesión de recuperación.");
    if (cause instanceof RecoverySessionAlreadyClosedError) return error(400, "VALIDATION_ERROR", cause.message);
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
