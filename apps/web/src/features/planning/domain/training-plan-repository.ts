import { and, eq } from "drizzle-orm";
import type { db as productionDb } from "@/lib/db/client";
import { trainingPlan } from "@/lib/db/schema";

type Database = typeof productionDb;

/** Every lookup and mutation scopes both id and owner id from the authenticated session. */
export async function findOwnedPlan(database: Database, planId: string, ownerId: string) {
  return database.query.trainingPlan.findFirst({ where: and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId)) });
}

/** Used to route a signed-in account to Hoy (if active) or onboarding (if not). */
export async function findActivePlanForOwner(database: Database, ownerId: string) {
  return database.query.trainingPlan.findFirst({ where: and(eq(trainingPlan.ownerId, ownerId), eq(trainingPlan.status, "active")) });
}

export async function renameOwnedPlan(database: Database, planId: string, ownerId: string, name: string) {
  const [updated] = await database.update(trainingPlan).set({ name, version: 2 }).where(and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId))).returning();
  return updated;
}
