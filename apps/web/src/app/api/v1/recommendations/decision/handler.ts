import { decideRecommendationSchema } from "@/contracts/training-engine";
import {
  RecommendationAlreadyDecidedError,
  RecommendationChangeNotFoundError,
  RecommendationNotFoundError,
  createWorkoutTrainingEngineRepository
} from "@/features/training-engine/domain/repository";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/lib/db/schema";

type SessionUser = { id: string } | null;

export async function decideRecommendationResponse(request: Request, user: SessionUser, database: PostgresJsDatabase<typeof schema>): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = decideRecommendationSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Decisión inválida.", parsed.error.flatten());
  if (parsed.data.decision === "apply" && !parsed.data.changeCode) return error(400, "VALIDATION_ERROR", "changeCode es obligatorio para aplicar una propuesta.");

  try {
    const repository = createWorkoutTrainingEngineRepository(database);
    const recommendation = await repository.decideRecommendation(user.id, parsed.data);
    return Response.json({ data: recommendation, meta: {} });
  } catch (cause) {
    if (cause instanceof RecommendationNotFoundError) return error(404, "NOT_FOUND", "No encontramos esa recomendación.");
    if (cause instanceof RecommendationAlreadyDecidedError) return error(409, "CONFLICT", "Esta recomendación ya tiene una decisión.");
    if (cause instanceof RecommendationChangeNotFoundError) return error(400, "VALIDATION_ERROR", "changeCode no coincide con ninguna alternativa de esta recomendación.");
    throw cause;
  }
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
