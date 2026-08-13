import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { PLAN_TEMPLATES } from "@/features/planning/data/plan-templates";
import { deleteOwnedPlan, findOwnedPlan, renameOwnedPlan } from "@/features/planning/domain/training-plan-repository";
import * as schema from "@/lib/db/schema";

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec("CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null); CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null, version integer not null, content_json text not null default '{}', created_at integer not null, source text, source_template_id text, source_template_version text, catalog_version text);");
  const now = new Date();
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "A", "a@example.test", 1, null, now.valueOf(), now.valueOf());
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-b", "B", "b@example.test", 1, null, now.valueOf(), now.valueOf());
  sqlite.prepare("INSERT INTO training_plan (id, owner_id, name, status, version, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "draft", 1, "{}", now.valueOf());
  return drizzle(sqlite, { schema });
}

describe("training plan owner repository", () => {
  it("does not return or update another account's plan", async () => {
    const db = fixture();
    expect(await findOwnedPlan(db, "plan-a", "account-b")).toBeUndefined();
    expect(await renameOwnedPlan(db, "plan-a", "account-b", "Intrusión")).toBeUndefined();
    expect((await findOwnedPlan(db, "plan-a", "account-a"))?.name).toBe("Plan A");
  });

  it("deletes only the authenticated owner's plan", async () => {
    const db = fixture();

    expect(await deleteOwnedPlan(db, "plan-a", "account-b")).toBe(false);
    expect(await findOwnedPlan(db, "plan-a", "account-a")).toBeDefined();

    expect(await deleteOwnedPlan(db, "plan-a", "account-a")).toBe(true);
    expect(await findOwnedPlan(db, "plan-a", "account-a")).toBeUndefined();
  });

  it("keeps an activated template copy's content unchanged when the library template is updated afterwards", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec("CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null); CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null, version integer not null, content_json text not null default '{}', created_at integer not null, source text, source_template_id text, source_template_version text, catalog_version text);");
    const now = Date.now();
    sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "A", "a@example.test", 1, null, now, now);

    const template = PLAN_TEMPLATES.find((candidate) => candidate.templateId === "full-body-gym")!;
    const originalVersion = template.versions.find((candidate) => candidate.version === "1.0.0")!;
    // The snapshot is taken (and persisted) at activation time, matching what activation.ts does with contentJson.
    const snapshotAtActivation = JSON.stringify(originalVersion.content);
    sqlite
      .prepare("INSERT INTO training_plan (id, owner_id, name, status, version, content_json, created_at, source, source_template_id, source_template_version, catalog_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("plan-template-copy", "account-a", "Plan activo", "active", 1, snapshotAtActivation, now, "template", template.templateId, originalVersion.version, originalVersion.catalogVersion);

    // A newer library version is published afterwards (mutating the in-memory catalog, as a real
    // content update to plan-templates.ts would).
    template.versions.push({ ...originalVersion, version: "2.0.0", content: { ...originalVersion.content, blockBlueprints: [] } });

    const db = drizzle(sqlite, { schema });
    const activated = await findOwnedPlan(db, "plan-template-copy", "account-a");
    expect(activated?.contentJson).toBe(snapshotAtActivation);
    expect(activated?.sourceTemplateVersion).toBe("1.0.0");
  });
});
