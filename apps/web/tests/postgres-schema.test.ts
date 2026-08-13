import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";

function columnNames(columns: unknown[]): (string | undefined)[] {
  return columns.map((c) => (c as { name?: string }).name);
}

describe("postgres schema", () => {
  it("defines owner foreign keys and unique ownership indexes in Postgres", () => {
    expect(schema.trainingPlan.ownerId.notNull).toBe(true);
    expect(schema.trainingPlan.ownerId.name).toBe("owner_id");
  });

  it("keeps workoutSession owner not-null with the right column name", () => {
    expect(schema.workoutSession.ownerId.notNull).toBe(true);
    expect(schema.workoutSession.ownerId.name).toBe("owner_id");
  });

  it("maps sqlite boolean mode to a real Postgres boolean column", () => {
    expect(schema.user.emailVerified.dataType).toBe("boolean");
    expect(schema.user.emailVerified.name).toBe("email_verified");
  });

  it("maps sqlite timestamp_ms mode to a Postgres timestamp column", () => {
    expect(schema.trainingPlan.createdAt.dataType).toBe("date");
    expect(schema.trainingPlan.createdAt.name).toBe("created_at");
  });

  it("preserves composite unique indexes", () => {
    const { indexes } = getTableConfig(schema.trainingPlan);
    const idx = indexes.find((i) => i.config.name === "training_plan_owner_id_idx");
    expect(idx).toBeDefined();
    expect(idx?.config.unique).toBe(true);
    expect(columnNames(idx?.config.columns ?? [])).toEqual(["owner_id", "id"]);
  });

  it("preserves the session_adjustment composite unique index", () => {
    const { indexes } = getTableConfig(schema.sessionAdjustment);
    const idx = indexes.find((i) => i.config.name === "session_adjustment_owner_week_session_idx");
    expect(idx).toBeDefined();
    expect(columnNames(idx?.config.columns ?? [])).toEqual(["owner_id", "plan_id", "iso_week_start", "session_index"]);
  });

  it.skipIf(!process.env.DATABASE_URL)("can connect and execute a query against a live Postgres instance", async () => {
    const { getDb, getSql } = await import("@/lib/db/client");
    const result = await getDb().execute("select 1 as value");
    expect(Array.from(result)[0]).toEqual({ value: 1 });
    await getSql().end();
  });
});
