import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  PlanNotFoundError,
  RecoverySessionAlreadyClosedError,
  RecoverySessionNotFoundError,
  createRecoverySessionRepository
} from "@/features/recovery/domain/recovery-session-repository";
import * as schema from "@/lib/db/schema";

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null, source text, source_template_id text, source_template_version text, catalog_version text);
    CREATE TABLE recovery_session (id text primary key, owner_id text not null, plan_id text not null, session_index integer not null, status text not null default 'in_progress', started_at integer not null, ended_at integer, comment text, created_at integer not null);
    CREATE UNIQUE INDEX recovery_session_owner_id_idx ON recovery_session (owner_id, id);
  `);
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "account-a", "a@example.test", 1, null, 0, 0);
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-b", "account-b", "b@example.test", 1, null, 0, 0);
  sqlite.prepare("INSERT INTO training_plan (id, owner_id, name, status, version, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, "{}", 0);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

describe("recovery session repository", () => {
  it("starts, resumes the same in-progress session, then finishes it", () => {
    const { db, sqlite } = fixture();
    const repo = createRecoverySessionRepository(db, sqlite);

    const first = repo.startOrResume("account-a", "plan-a", 0);
    expect(first.status).toBe("in_progress");
    const resumed = repo.startOrResume("account-a", "plan-a", 0);
    expect(resumed.id).toBe(first.id);

    const finished = repo.finish("account-a", first.id, "Me sentí mejor");
    expect(finished.status).toBe("completed");
    expect(finished.endedAt).not.toBeNull();
    expect(finished.comment).toBe("Me sentí mejor");
  });

  it("never creates any session_exercise/set_performance row — it can never contribute strength volume or progression", () => {
    const { db, sqlite } = fixture();
    const repo = createRecoverySessionRepository(db, sqlite);
    repo.startOrResume("account-a", "plan-a", 0);
    // No session_exercise table even exists in this fixture: the repository never references it,
    // so this would throw "no such table" if it tried to. It doesn't.
    expect(() => repo.startOrResume("account-a", "plan-a", 0)).not.toThrow();
  });

  it("rejects finishing an already-completed session, and finishing/reading someone else's session", () => {
    const { db, sqlite } = fixture();
    const repo = createRecoverySessionRepository(db, sqlite);
    const started = repo.startOrResume("account-a", "plan-a", 0);
    repo.finish("account-a", started.id);
    expect(() => repo.finish("account-a", started.id)).toThrow(RecoverySessionAlreadyClosedError);
    expect(() => repo.finish("account-b", started.id)).toThrow(RecoverySessionNotFoundError);
  });

  it("rejects starting a recovery session for a plan that isn't this account's", () => {
    const { db, sqlite } = fixture();
    const repo = createRecoverySessionRepository(db, sqlite);
    expect(() => repo.startOrResume("account-b", "plan-a", 0)).toThrow(PlanNotFoundError);
  });

  it("a completed recovery session counts toward adherence as 'adapted', never as full strength volume", () => {
    const { db, sqlite } = fixture();
    const repo = createRecoverySessionRepository(db, sqlite);
    const started = repo.startOrResume("account-a", "plan-a", 0);
    repo.finish("account-a", started.id);

    const forAdherence = repo.listCompletedForAdherence("account-a", "plan-a");
    expect(forAdherence).toHaveLength(1);
    expect(forAdherence[0]).toMatchObject({ sessionIndex: 0, status: "adapted" });

    // Isolation: another account's completed recovery never leaks in.
    expect(repo.listCompletedForAdherence("account-b", "plan-a")).toHaveLength(0);
  });
});
