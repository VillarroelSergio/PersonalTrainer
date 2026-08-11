import { onboardingFormPatchSchema } from "@/contracts/onboarding";
import { loadOwnedDraft, saveOwnedDraft } from "@/features/onboarding/domain/onboarding-draft-repository";
import type { db as productionDb } from "@/lib/db/client";

type SessionUser = { id: string } | null;

export async function getOnboardingDraftResponse(user: SessionUser, database: typeof productionDb): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");
  const draft = await loadOwnedDraft(database, user.id);
  return Response.json({ data: draft, meta: {} });
}

export async function putOnboardingDraftResponse(request: Request, user: SessionUser, database: typeof productionDb): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = onboardingFormPatchSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "El paso de onboarding no es válido.", parsed.error.flatten());

  const merged = await saveOwnedDraft(database, user.id, parsed.data);
  return Response.json({ data: merged, meta: {} });
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
