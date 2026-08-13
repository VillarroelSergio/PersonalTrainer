import { onboardingDraftSchema } from "@/contracts/onboarding";
import { buildPlanProposal } from "@/features/planning/domain/plan-proposal";
import { saveOwnedProposal } from "@/features/planning/domain/plan-proposal-repository";
import type { getDb } from "@/lib/db/client";

type SessionUser = { id: string } | null;

export async function createPlanProposalResponse(request: Request, user: SessionUser, database?: ReturnType<typeof getDb>): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = onboardingDraftSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "El borrador de onboarding no es válido.", parsed.error.flatten());
  if (request.headers.get("idempotency-key") !== parsed.data.clientOperationId) {
    return error(400, "VALIDATION_ERROR", "Idempotency-Key debe coincidir con clientOperationId.");
  }

  const proposal = buildPlanProposal(parsed.data);
  if (database) await saveOwnedProposal(database, user.id, proposal);
  return Response.json({ data: proposal, meta: { pendingSync: false } });
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
