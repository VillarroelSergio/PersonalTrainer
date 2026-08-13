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

/** Every plan the owner has ever had (draft/active/archived), most recent first — the real data behind the "Tus planes" tab. There is no pause/finish status in the schema yet, only draft/active/archived (see activation.ts). */
export async function listPlansForOwner(database: Database, ownerId: string) {
  return database.query.trainingPlan.findMany({ where: eq(trainingPlan.ownerId, ownerId), orderBy: (plan, { desc }) => [desc(plan.createdAt)] });
}

export async function renameOwnedPlan(database: Database, planId: string, ownerId: string, name: string) {
  const [updated] = await database.update(trainingPlan).set({ name, version: 2 }).where(and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId))).returning();
  return updated;
}

/** Deletes only a plan belonging to the authenticated owner. The UI must ask
 * for an explicit confirmation because dependent session rows are cascaded. */
export async function deleteOwnedPlan(database: Database, planId: string, ownerId: string): Promise<boolean> {
  const deleted = await database.delete(trainingPlan).where(and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId))).returning({ id: trainingPlan.id });
  return deleted.length === 1;
}
