import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { ActivePlanNotFoundError, SessionNotEnduranceError, createEnduranceDesignRepository } from "@/features/endurance/domain/design-repository";
import * as schema from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

const proposal: PlanProposal = {
  proposalId: "proposal-a",
  ruleVersion: "plan-proposal-v1",
  reasons: [],
  alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Fuerza: piernas", estimatedMinutes: 60, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] },
      { day: "tuesday", kind: "endurance", title: "Carrera suave", estimatedMinutes: 40 }
    ]
  }
};

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null);
    CREATE TABLE endurance_session_design (id text primary key, owner_id text not null, plan_id text not null, iso_week_start text not null, session_index integer not null, objective text not null, environment text, optional_layers_json text, watch_prepared_at integer, created_at integer not null);
    CREATE UNIQUE INDEX endurance_session_design_owner_week_session_idx ON endurance_session_design (owner_id, plan_id, iso_week_start, session_index);
  `);
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "account-a", "a@example.test", 1, null, 0, 0);
  sqlite.prepare("INSERT INTO training_plan VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, JSON.stringify(proposal), 0);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

describe("endurance design repository", () => {
  it("saves a block design for an endurance occurrence and re-saving the same occurrence overwrites instead of duplicating", () => {
    const { db, sqlite } = fixture();
    const repo = createEnduranceDesignRepository(db, sqlite);

    const first = repo.saveDesign("account-a", { isoWeekStart: "2026-08-10", sessionIndex: 1, objective: "intervals", environment: "outdoors" });
    expect(first.objective).toBe("intervals");

    const second = repo.saveDesign("account-a", { isoWeekStart: "2026-08-10", sessionIndex: 1, objective: "base", environment: "treadmill" });
    expect(second.id).toBe(first.id);
    expect(second.objective).toBe("base");

    const all = db.select().from(schema.enduranceSessionDesign).all();
    expect(all).toHaveLength(1);
  });

  it("refuses to attach a design to a strength session", () => {
    const { db, sqlite } = fixture();
    const repo = createEnduranceDesignRepository(db, sqlite);
    expect(() => repo.saveDesign("account-a", { isoWeekStart: "2026-08-10", sessionIndex: 0, objective: "base" })).toThrow(SessionNotEnduranceError);
  });

  it("requires an active plan", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
      CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null);
      CREATE TABLE endurance_session_design (id text primary key, owner_id text not null, plan_id text not null, iso_week_start text not null, session_index integer not null, objective text not null, environment text, optional_layers_json text, watch_prepared_at integer, created_at integer not null);
    `);
    const db = drizzle(sqlite, { schema });
    const repo = createEnduranceDesignRepository(db, sqlite);
    expect(() => repo.saveDesign("account-a", { isoWeekStart: "2026-08-10", sessionIndex: 1, objective: "base" })).toThrow(ActivePlanNotFoundError);
  });

  it("confirming watch prep sets a timestamp, and a fresh save resets it (the blocks may have changed)", () => {
    const { db, sqlite } = fixture();
    const repo = createEnduranceDesignRepository(db, sqlite);
    const design = repo.saveDesign("account-a", { isoWeekStart: "2026-08-10", sessionIndex: 1, objective: "base" });
    expect(design.watchPreparedAt).toBeNull();

    const confirmed = repo.confirmWatchPrep("account-a", design.id);
    expect(confirmed.watchPreparedAt).toBeInstanceOf(Date);

    const resaved = repo.saveDesign("account-a", { isoWeekStart: "2026-08-10", sessionIndex: 1, objective: "long_run" });
    expect(resaved.watchPreparedAt).toBeNull();
  });
});
