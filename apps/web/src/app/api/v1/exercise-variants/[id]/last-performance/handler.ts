import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/lib/db/schema";

type SessionUser = { id: string } | null;

export async function lastPerformanceResponse(user: SessionUser, database: PostgresJsDatabase<typeof schema>, variantId: string): Promise<Response> {
  if (!user) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Necesitas iniciar sesión.", details: {} } }, { status: 401 });

  const repository = createWorkoutSessionRepository(database);
  const baseline = await repository.getBaseline(user.id, variantId);
  if (!baseline) return Response.json({ data: null, meta: {} });

  return Response.json({ data: { ...baseline, summary: JSON.parse(baseline.summaryJson) }, meta: {} });
}
