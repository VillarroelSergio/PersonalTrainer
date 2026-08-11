import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

export async function lastPerformanceResponse(user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database, variantId: string): Promise<Response> {
  if (!user) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Necesitas iniciar sesión.", details: {} } }, { status: 401 });

  const repository = createWorkoutSessionRepository(database, sqliteHandle);
  const baseline = repository.getBaseline(user.id, variantId);
  if (!baseline) return Response.json({ data: null, meta: {} });

  return Response.json({ data: { ...baseline, summary: JSON.parse(baseline.summaryJson) }, meta: {} });
}
