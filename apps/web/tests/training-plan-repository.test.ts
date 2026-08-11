import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { findOwnedPlan, renameOwnedPlan } from "@/features/planning/domain/training-plan-repository";
import * as schema from "@/lib/db/schema";

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null); CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null, version integer not null, content_json text not null default '{}', created_at integer not null);");
  const now = new Date();
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "A", "a@example.test", 1, null, now.valueOf(), now.valueOf());
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-b", "B", "b@example.test", 1, null, now.valueOf(), now.valueOf());
  sqlite.prepare("INSERT INTO training_plan VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "draft", 1, "{}", now.valueOf());
  return drizzle(sqlite, { schema });
}

describe("training plan owner repository", () => {
  it("does not return or update another account's plan", async () => {
    const db = fixture();
    expect(await findOwnedPlan(db, "plan-a", "account-b")).toBeUndefined();
    expect(await renameOwnedPlan(db, "plan-a", "account-b", "Intrusión")).toBeUndefined();
    expect((await findOwnedPlan(db, "plan-a", "account-a"))?.name).toBe("Plan A");
  });
});
