import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  InvalidSessionIndexError,
  InvalidWeekStartError,
  PastWeekError,
  PlanNotFoundError,
  SessionAlreadyExecutedError,
  createPlanEditRepository
} from "@/features/planning/domain/plan-edit-repository";
import * as schema from "@/lib/db/schema";
import { isoDate, isoWeekStart, parseIsoDateLocal } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

const proposal: PlanProposal = {
  proposalId: "p1", ruleVersion: "plan-proposal-v1", reasons: [], alternatives: [],
  initialBlock: { name: "Adaptación", purpose: "Base", weeks: 4 },
  week: { sessions: [{ day: "monday", kind: "strength", title: "Piernas", estimatedMinutes: 60 }] }
};

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE recommendation (id text primary key, owner_id text not null, plan_id text not null, checkin_date text not null, session_index integer, rule_version text not null, confidence text not null, reason_codes_json text not null, human_reason text not null, changes_json text not null, alternatives_json text not null, missing_data_json text not null, important_discomfort integer not null default 0, decision_status text not null default 'pending', decided_change_code text, decided_at integer, created_at integer not null);
    CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null);
    CREATE TABLE session_adjustment (id text primary key, owner_id text not null, plan_id text not null, iso_week_start text not null, session_index integer not null, origin_day text not null, kind text not null, target_day text, ops_json text not null, recommendation_id text, created_at integer not null);
    CREATE UNIQUE INDEX session_adjustment_owner_week_session_idx ON session_adjustment (owner_id, plan_id, iso_week_start, session_index);
    CREATE TABLE workout_session (id text primary key, owner_id text not null, plan_id text not null, session_index integer not null, status text not null default 'in_progress', version integer not null default 1, last_finish_operation_id text, started_at integer not null, ended_at integer, global_effort integer, comment text, discomfort_json text, created_at integer not null);
  `);
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "account-a", "a@example.test", 1, null, 0, 0);
  sqlite.prepare("INSERT INTO training_plan VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, JSON.stringify(proposal), 0);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

function nextWeekStart(): string {
  const today = new Date();
  const nextMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
  return isoWeekStart(nextMonday);
}
function pastWeekStart(): string {
  const today = new Date();
  const lastMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
  return isoWeekStart(lastMonday);
}

describe("plan edit repository", () => {
  it("moves a future session and re-applying the same move overwrites in place instead of duplicating the agenda entry", () => {
    const { db, sqlite } = fixture();
    const repo = createPlanEditRepository(db, sqlite);
    const week = nextWeekStart();

    repo.applyEdit("account-a", "plan-a", { kind: "move", isoWeekStart: week, sessionIndex: 0, targetDay: "friday" });
    repo.applyEdit("account-a", "plan-a", { kind: "move", isoWeekStart: week, sessionIndex: 0, targetDay: "saturday" });

    const rows = db.select().from(schema.sessionAdjustment).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].targetDay).toBe("saturday");
  });

  it("rejects editing a session in a week that has already passed", () => {
    const { db, sqlite } = fixture();
    const repo = createPlanEditRepository(db, sqlite);
    expect(() => repo.applyEdit("account-a", "plan-a", { kind: "skip", isoWeekStart: pastWeekStart(), sessionIndex: 0 })).toThrow(PastWeekError);
  });

  it("rejects editing a session that already has an execution record for that week (never rewrites a started/closed session)", () => {
    const { db, sqlite } = fixture();
    const repo = createPlanEditRepository(db, sqlite);
    const week = isoWeekStart();
    sqlite.prepare("INSERT INTO workout_session (id, owner_id, plan_id, session_index, status, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run("ws-1", "account-a", "plan-a", 0, "completed", Date.now(), Date.now());

    expect(() => repo.applyEdit("account-a", "plan-a", { kind: "move", isoWeekStart: week, sessionIndex: 0, targetDay: "friday" })).toThrow(SessionAlreadyExecutedError);
  });

  it("rejects an isoWeekStart that isn't the Monday of its own ISO week", () => {
    const { db, sqlite } = fixture();
    const repo = createPlanEditRepository(db, sqlite);
    const weekDate = parseIsoDateLocal(nextWeekStart());
    const notMonday = isoDate(new Date(weekDate.getFullYear(), weekDate.getMonth(), weekDate.getDate() + 2));
    expect(() => repo.applyEdit("account-a", "plan-a", { kind: "skip", isoWeekStart: notMonday, sessionIndex: 0 })).toThrow(InvalidWeekStartError);
  });

  it("rejects a sessionIndex that doesn't exist in the plan template", () => {
    const { db, sqlite } = fixture();
    const repo = createPlanEditRepository(db, sqlite);
    expect(() => repo.applyEdit("account-a", "plan-a", { kind: "skip", isoWeekStart: nextWeekStart(), sessionIndex: 9 })).toThrow(InvalidSessionIndexError);
  });

  it("adds an ad-hoc session for one week without colliding with template indices, and remove_added deletes it cleanly", () => {
    const { db, sqlite } = fixture();
    const repo = createPlanEditRepository(db, sqlite);
    const week = nextWeekStart();

    const added = repo.applyEdit("account-a", "plan-a", { kind: "add", isoWeekStart: week, day: "sunday", title: "Movilidad", sessionKind: "endurance", estimatedMinutes: 20 });
    expect("sessionIndex" in added && added.sessionIndex).toBeGreaterThanOrEqual(1000);

    repo.applyEdit("account-a", "plan-a", { kind: "remove_added", isoWeekStart: week, sessionIndex: (added as { sessionIndex: number }).sessionIndex });
    const rows = db.select().from(schema.sessionAdjustment).all();
    expect(rows).toHaveLength(0);
  });

  it("restore clears any adjustment for that occurrence, returning it to the plain plan", () => {
    const { db, sqlite } = fixture();
    const repo = createPlanEditRepository(db, sqlite);
    const week = nextWeekStart();
    repo.applyEdit("account-a", "plan-a", { kind: "skip", isoWeekStart: week, sessionIndex: 0 });
    repo.applyEdit("account-a", "plan-a", { kind: "restore", isoWeekStart: week, sessionIndex: 0 });
    expect(db.select().from(schema.sessionAdjustment).all()).toHaveLength(0);
  });

  it("never edits another account's plan", () => {
    const { db, sqlite } = fixture();
    const repo = createPlanEditRepository(db, sqlite);
    expect(() => repo.applyEdit("account-b", "plan-a", { kind: "skip", isoWeekStart: nextWeekStart(), sessionIndex: 0 })).toThrow(PlanNotFoundError);
  });
});
