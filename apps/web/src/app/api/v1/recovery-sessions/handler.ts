import { z } from "zod";
import { createRecoverySessionRepository, PlanNotFoundError } from "@/features/recovery/domain/recovery-session-repository";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

const startInputSchema = z.object({ planId: z.string().min(1), sessionIndex: z.number().int().nonnegative() });

export async function startRecoverySessionResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }
  const parsed = startInputSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Datos inválidos.", parsed.error.flatten());

  try {
    const repository = createRecoverySessionRepository(database, sqliteHandle);
    const session = repository.startOrResume(user.id, parsed.data.planId, parsed.data.sessionIndex);
    return Response.json({ data: session, meta: {} });
  } catch (cause) {
    if (cause instanceof PlanNotFoundError) return error(404, "NOT_FOUND", "No encontramos ese plan.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
