import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { loadOwnedDraft, saveOwnedDraft } from "@/features/onboarding/domain/onboarding-draft-repository";
import * as schema from "@/lib/db/schema";

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE onboarding_draft (owner_id text primary key, form_json text not null, updated_at integer not null);
  `);
  const now = Date.now();
  for (const id of ["account-a", "account-b"]) {
    sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, id, `${id}@example.test`, 1, null, now, now);
  }
  return drizzle(sqlite, { schema });
}

describe("onboarding draft repository", () => {
  it("survives a reload by persisting each step and merging on top of the previous draft", async () => {
    const db = fixture();
    await saveOwnedDraft(db, "account-a", { goals: ["strength"] });
    await saveOwnedDraft(db, "account-a", { heightCm: 178 });

    const draft = await loadOwnedDraft(db, "account-a");
    expect(draft).toEqual({ goals: ["strength"], heightCm: 178 });
  });

  it("keeps drafts isolated between accounts", async () => {
    const db = fixture();
    await saveOwnedDraft(db, "account-a", { heightCm: 178 });

    expect(await loadOwnedDraft(db, "account-b")).toBeNull();
  });
});
