import { and, eq } from "drizzle-orm";
import type { db as productionDb } from "@/lib/db/client";
import { bodyMetric } from "@/lib/db/schema";

type Database = typeof productionDb;

export type BodyMetricInput = { kind: "weight" | "measurement"; zone: string | null; value: number; unit: string; measuredAt: string };

/** Scoped by owner id from the authenticated session; never accepts a foreign owner id. Adding a metric never overwrites a previous entry (no correction/versioning yet — declared debt). */
export async function addOwnedBodyMetric(database: Database, ownerId: string, input: BodyMetricInput): Promise<void> {
  await database.insert(bodyMetric).values({ id: crypto.randomUUID(), ownerId, kind: input.kind, zone: input.zone, value: input.value, unit: input.unit, measuredAt: input.measuredAt, createdAt: new Date() });
}

export async function listOwnedBodyMetrics(database: Database, ownerId: string) {
  return database.select().from(bodyMetric).where(eq(bodyMetric.ownerId, ownerId)).orderBy(bodyMetric.measuredAt);
}
