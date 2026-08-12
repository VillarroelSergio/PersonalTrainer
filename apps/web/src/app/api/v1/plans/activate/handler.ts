import { z } from "zod";
import { createActivation, ProposalNotFoundError } from "@/features/planning/domain/activation";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

const activateBodySchema = z.object({ proposalId: z.string().min(1), proposalJson: z.string().optional() });

export async function activatePlanResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = activateBodySchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "proposalId es obligatorio.", parsed.error.flatten());

  try {
    const activateOwnedProposal = createActivation(database, sqliteHandle);
    const plan = activateOwnedProposal(user.id, parsed.data.proposalId, parsed.data.proposalJson);
    return Response.json({ data: plan, meta: {} });
  } catch (cause) {
    if (cause instanceof ProposalNotFoundError) return error(404, "NOT_FOUND", "No encontramos esa propuesta.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
