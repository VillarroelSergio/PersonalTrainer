import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { youtubeSearchUrl } from "@/features/catalog/domain/video-link";
import * as schema from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

const proposal: PlanProposal = {
  proposalId: "p1", ruleVersion: "plan-proposal-v1", reasons: [], alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Base", weeks: 4 },
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Empuje", estimatedMinutes: 40, exercises: [{ variantId: "push-h-bench", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] },
      { day: "wednesday", kind: "strength", title: "Piernas", estimatedMinutes: 40, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] }
    ]
  }
};

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null, source text, source_template_id text, source_template_version text, catalog_version text);
    CREATE TABLE workout_session (id text primary key, owner_id text not null, plan_id text not null, session_index integer not null, status text not null default 'in_progress', version integer not null default 1, last_finish_operation_id text, started_at integer not null, ended_at integer, global_effort integer, comment text, discomfort_json text, created_at integer not null);
    CREATE TABLE session_exercise (id text primary key, workout_session_id text not null, variant_id text not null, position integer not null, status text not null default 'active', target_sets integer not null, target_reps_min integer not null, target_reps_max integer not null);
    CREATE TABLE set_performance (id text primary key, session_exercise_id text not null, set_number integer not null, load_kg integer, repetitions integer, difficulty text, completed_at integer not null);
    CREATE UNIQUE INDEX set_performance_exercise_set_idx ON set_performance (session_exercise_id, set_number);
    CREATE TABLE performance_baseline (owner_id text not null, variant_id text not null, confidence integer, summary_json text not null, rule_version text not null, calculated_at integer not null);
    CREATE UNIQUE INDEX performance_baseline_owner_variant_idx ON performance_baseline (owner_id, variant_id);
  `);
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "account-a", "a@example.test", 1, null, 0, 0);
  sqlite.prepare("INSERT INTO training_plan (id, owner_id, name, status, version, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, JSON.stringify(proposal), 0);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

describe("listRecentVariantIds (Bloqueante 5)", () => {
  it("returns real history variants, most recent first, deduplicated, owner-scoped", () => {
    const { db, sqlite } = fixture();
    const repo = createWorkoutSessionRepository(db, sqlite);

    repo.startOrResumeWorkout("account-a", "plan-a", 0); // push-h-bench
    repo.startOrResumeWorkout("account-a", "plan-a", 1); // squat-barbell, more recent

    const recent = repo.listRecentVariantIds("account-a", 5);
    expect(recent).toEqual(["squat-barbell", "push-h-bench"]);
    expect(repo.listRecentVariantIds("account-b", 5)).toEqual([]);
  });

  it("respects the limit", () => {
    const { db, sqlite } = fixture();
    const repo = createWorkoutSessionRepository(db, sqlite);
    repo.startOrResumeWorkout("account-a", "plan-a", 0);
    repo.startOrResumeWorkout("account-a", "plan-a", 1);
    expect(repo.listRecentVariantIds("account-a", 1)).toHaveLength(1);
  });
});

describe("youtubeSearchUrl (Bloqueante 5)", () => {
  it("builds a labeled external search URL, never a specific invented video", () => {
    const url = youtubeSearchUrl("Sentadilla", "Sentadilla con barra");
    expect(url).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
    expect(url).not.toMatch(/\/watch\?v=/);
    expect(decodeURIComponent(url.split("=")[1])).toContain("Sentadilla con barra");
  });
});
