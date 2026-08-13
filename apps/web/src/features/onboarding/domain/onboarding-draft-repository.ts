import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { onboardingDraft } from "@/lib/db/schema";
import type { OnboardingFormPatch } from "@/contracts/onboarding";

type Database = PostgresJsDatabase<typeof schema>;

/** Scoped by owner id from the authenticated session; never accepts a foreign owner id. */
export async function loadOwnedDraft(database: Database, ownerId: string): Promise<OnboardingFormPatch | null> {
  const row = await database.query.onboardingDraft.findFirst({ where: eq(onboardingDraft.ownerId, ownerId) });
  return row ? (JSON.parse(row.formJson) as OnboardingFormPatch) : null;
}

/** Merges the step patch onto the existing draft (or creates it) and returns the merged draft. */
export async function saveOwnedDraft(database: Database, ownerId: string, patch: OnboardingFormPatch): Promise<OnboardingFormPatch> {
  const existing = await loadOwnedDraft(database, ownerId);
  const merged: OnboardingFormPatch = { ...existing, ...patch };
  const now = new Date();
  await database
    .insert(onboardingDraft)
    .values({ ownerId, formJson: JSON.stringify(merged), updatedAt: now })
    .onConflictDoUpdate({ target: onboardingDraft.ownerId, set: { formJson: JSON.stringify(merged), updatedAt: now } });
  return merged;
}
