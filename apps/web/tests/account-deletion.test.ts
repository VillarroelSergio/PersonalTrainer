import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deleteOwnAccount } from "@/features/account/domain/account-deletion";
import { saveUploadedFile } from "@/features/endurance/domain/storage";
import * as schema from "@/lib/db/schema";

const PRIVATE_UPLOAD_ROOT = path.resolve(process.cwd(), "private-uploads", "activity-imports");

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE session (id text primary key, expires_at integer not null, token text not null unique, created_at integer not null, updated_at integer not null, ip_address text, user_agent text, user_id text not null);
    CREATE TABLE training_plan (id text primary key, owner_id text not null references user(id) on delete cascade, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null, source text, source_template_id text, source_template_version text, catalog_version text);
    CREATE TABLE workout_session (id text primary key, owner_id text not null references user(id) on delete cascade, plan_id text not null, session_index integer not null, status text not null default 'in_progress', version integer not null default 1, last_finish_operation_id text, started_at integer not null, ended_at integer, global_effort integer, comment text, discomfort_json text, created_at integer not null);
    CREATE TABLE import_file (id text primary key, owner_id text not null references user(id) on delete cascade, storage_key text not null, original_name text not null, format text not null, size_bytes integer not null, sha256 text not null, uploaded_at integer not null, deleted_at integer);
  `);
  const now = Date.now();
  for (const id of ["account-a", "account-b"]) {
    sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, id, `${id}@example.test`, 1, null, now, now);
  }
  sqlite.prepare("INSERT INTO training_plan (id, owner_id, name, status, version, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, "{}", now);
  sqlite.prepare("INSERT INTO training_plan (id, owner_id, name, status, version, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-b", "account-b", "Plan B", "active", 1, "{}", now);
  sqlite.prepare("INSERT INTO workout_session VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("session-a", "account-a", "plan-a", 0, "completed", 2, null, now, now, 7, null, null, now);
  sqlite.prepare("INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("auth-session-a", now + 86_400_000, "token-a", now, now, null, null, "account-a");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

describe("deleteOwnAccount", () => {
  it("cascades to every owned row and unlinks any remaining private upload bytes, without touching another account", () => {
    const { db, sqlite } = fixture();
    const storageKey = saveUploadedFile(Buffer.from("fit-bytes"), "fit");
    sqlite.prepare("INSERT INTO import_file VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("file-a", "account-a", storageKey, "carrera.fit", "fit", 9, "hash", Date.now(), null);
    expect(existsSync(path.join(PRIVATE_UPLOAD_ROOT, storageKey))).toBe(true);

    return deleteOwnAccount(db, "account-a").then(() => {
      expect(sqlite.prepare("SELECT * FROM user WHERE id = 'account-a'").get()).toBeUndefined();
      expect(sqlite.prepare("SELECT * FROM training_plan WHERE owner_id = 'account-a'").all()).toHaveLength(0);
      expect(sqlite.prepare("SELECT * FROM workout_session WHERE owner_id = 'account-a'").all()).toHaveLength(0);
      expect(sqlite.prepare("SELECT * FROM import_file WHERE owner_id = 'account-a'").all()).toHaveLength(0);
      expect(sqlite.prepare("SELECT * FROM session WHERE user_id = 'account-a'").all()).toHaveLength(0);
      expect(existsSync(path.join(PRIVATE_UPLOAD_ROOT, storageKey))).toBe(false);

      expect(sqlite.prepare("SELECT * FROM user WHERE id = 'account-b'").get()).toBeDefined();
      expect(sqlite.prepare("SELECT * FROM training_plan WHERE owner_id = 'account-b'").all()).toHaveLength(1);
    });
  });
});
