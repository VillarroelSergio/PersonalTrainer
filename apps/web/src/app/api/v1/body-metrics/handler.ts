import { bodyMetricInputSchema } from "@/contracts/history";
import { addOwnedBodyMetric } from "@/features/history/domain/body-metrics-repository";
import type { db as productionDb } from "@/lib/db/client";

type SessionUser = { id: string } | null;

export async function addBodyMetricResponse(request: Request, user: SessionUser, database: typeof productionDb): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = bodyMetricInputSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Métrica inválida.", parsed.error.flatten());

  await addOwnedBodyMetric(database, user.id, { ...parsed.data, zone: parsed.data.zone ?? null });
  return Response.json({ data: { ok: true }, meta: {} });
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
