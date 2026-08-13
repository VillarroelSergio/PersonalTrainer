import { enduranceDesignInputSchema } from "@/contracts/endurance";
import { ActivePlanNotFoundError, DesignNotFoundError, SessionNotEnduranceError, createEnduranceDesignRepository } from "@/features/endurance/domain/design-repository";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

export async function saveEnduranceDesignResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = enduranceDesignInputSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Diseño de sesión inválido.", parsed.error.flatten());

  try {
    const repository = createEnduranceDesignRepository(database, sqliteHandle);
    const design = repository.saveDesign(user.id, parsed.data);
    return Response.json({ data: design, meta: {} });
  } catch (cause) {
    if (cause instanceof ActivePlanNotFoundError) return error(404, "NOT_FOUND", "No tienes un plan activo todavía.");
    if (cause instanceof SessionNotEnduranceError) return error(400, "VALIDATION_ERROR", "La sesión indicada no es de resistencia.");
    throw cause;
  }
}

export async function confirmWatchPrepResponse(user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database, designId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  try {
    const repository = createEnduranceDesignRepository(database, sqliteHandle);
    const design = repository.confirmWatchPrep(user.id, designId);
    return Response.json({ data: design, meta: {} });
  } catch (cause) {
    if (cause instanceof DesignNotFoundError) return error(404, "NOT_FOUND", "No encontramos ese diseño de sesión.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
