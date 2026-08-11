import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { createHistoryRepository } from "@/features/history/domain/history-repository";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import * as schema from "@/lib/db/schema";
import { parseIsoDateLocal } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

const proposal: PlanProposal = {
  proposalId: "proposal-a",
  ruleVersion: "plan-proposal-v1",
  reasons: [],
  alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Fuerza: piernas", estimatedMinutes: 60, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] }
    ]
  }
};

function fixture(planCreatedAt: number) {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null);
    CREATE TABLE workout_session (id text primary key, owner_id text not null, plan_id text not null, session_index integer not null, status text not null default 'in_progress', version integer not null default 1, last_finish_operation_id text, started_at integer not null, ended_at integer, global_effort integer, comment text, discomfort_json text, created_at integer not null);
    CREATE TABLE session_exercise (id text primary key, workout_session_id text not null, variant_id text not null, position integer not null, status text not null default 'active', target_sets integer not null, target_reps_min integer not null, target_reps_max integer not null);
    CREATE TABLE set_performance (id text primary key, session_exercise_id text not null, set_number integer not null, load_kg integer, repetitions integer, difficulty text, completed_at integer not null);
    CREATE UNIQUE INDEX set_performance_exercise_set_idx ON set_performance (session_exercise_id, set_number);
    CREATE TABLE performance_baseline (owner_id text not null, variant_id text not null, confidence integer, summary_json text not null, rule_version text not null, calculated_at integer not null);
    CREATE UNIQUE INDEX performance_baseline_owner_variant_idx ON performance_baseline (owner_id, variant_id);
    CREATE TABLE session_adjustment (id text primary key, owner_id text not null, plan_id text not null, iso_week_start text not null, session_index integer not null, origin_day text not null, kind text not null, target_day text, ops_json text not null, recommendation_id text not null, created_at integer not null);
    CREATE TABLE endurance_activity (id text primary key, owner_id text not null, import_id text, plan_id text, iso_week_start text, session_index integer, sport text not null, name text not null, source text not null, fingerprint text not null, started_at integer not null, duration_s integer, distance_m real, created_at integer not null);
    CREATE TABLE activity_metric (id text primary key, activity_id text not null, metric_type text not null, value real not null, unit text not null, source text not null);
    CREATE TABLE recovery_session (id text primary key, owner_id text not null, plan_id text not null, session_index integer not null, status text not null default 'in_progress', started_at integer not null, ended_at integer, comment text, created_at integer not null);
  `);
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "account-a", "a@example.test", 1, null, planCreatedAt, planCreatedAt);
  sqlite.prepare("INSERT INTO training_plan VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, JSON.stringify(proposal), planCreatedAt);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

function completeExposure(workoutRepo: ReturnType<typeof createWorkoutSessionRepository>, sqlite: Database.Database, startedAtMs: number, status: "completed" | "adapted" | "partial") {
  const started = workoutRepo.startOrResumeWorkout("account-a", "plan-a", 0);
  for (let setNumber = 1; setNumber <= 3; setNumber += 1) workoutRepo.recordSet("account-a", started.workoutSession.id, started.sessionExercises[0].id, setNumber, 40, 10, "just_right");
  workoutRepo.finishWorkout("account-a", started.workoutSession.id, crypto.randomUUID(), 1, status, 7, null, null);
  sqlite.prepare("UPDATE workout_session SET started_at = ? WHERE id = ?").run(startedAtMs, started.workoutSession.id);
}

describe("history repository", () => {
  it("derives adherence, variant progress, weekly load and chronological history from real persisted sessions, not fixtures", () => {
    const week1 = parseIsoDateLocal("2026-08-03"); // Monday
    const week2 = parseIsoDateLocal("2026-08-10");
    const week3 = parseIsoDateLocal("2026-08-17");
    const { db, sqlite } = fixture(week1.getTime());
    const workoutRepo = createWorkoutSessionRepository(db, sqlite);
    const historyRepo = createHistoryRepository(db, sqlite);

    completeExposure(workoutRepo, sqlite, week1.getTime(), "completed");
    completeExposure(workoutRepo, sqlite, week2.getTime(), "adapted");
    completeExposure(workoutRepo, sqlite, week3.getTime(), "partial");

    const adherence = historyRepo.computeAdherence("account-a", "plan-a", week3);
    expect(adherence).toEqual({ previstas: 3, completadas: 1, adaptadas: 1, parciales: 1, omitidas: 0, recolocadas: 0 });

    const progress = historyRepo.listVariantProgress("account-a");
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ variantId: "squat-barbell", exerciseName: "Sentadilla", hasBaseline: true });

    const weeklyLoad = historyRepo.computeWeeklyLoad("account-a", "2026-08-17");
    expect(weeklyLoad).toEqual({ piernas: 3, treSuperior: 0, resistenciaMinutos: 0 });

    const history = historyRepo.listSessionHistory("account-a", "plan-a");
    expect(history).toHaveLength(3);
    expect(history[0].startedAt.getTime()).toBe(week3.getTime()); // most recent first
    expect(history.every((entry) => entry.title === "Fuerza: piernas" && entry.day === "monday")).toBe(true);
  });

  it("never mixes up a different account's sessions into adherence or history", () => {
    const week1 = parseIsoDateLocal("2026-08-03");
    const { db, sqlite } = fixture(week1.getTime());
    sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-b", "account-b", "b@example.test", 1, null, week1.getTime(), week1.getTime());
    sqlite.prepare("INSERT INTO training_plan VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-b", "account-b", "Plan B", "active", 1, JSON.stringify(proposal), week1.getTime());
    const workoutRepoB = createWorkoutSessionRepository(db, sqlite);
    const historyRepo = createHistoryRepository(db, sqlite);

    workoutRepoB.startOrResumeWorkout("account-b", "plan-b", 0);

    expect(historyRepo.listSessionHistory("account-a", "plan-a")).toHaveLength(0);
    expect(historyRepo.computeAdherence("account-a", "plan-a", week1)?.previstas).toBe(1);
    expect(historyRepo.computeAdherence("account-a", "plan-a", week1)?.omitidas).toBe(1);
  });

  it("counts a rescheduled occurrence as recolocada, never as omitida", () => {
    const week1 = parseIsoDateLocal("2026-08-03");
    const { db, sqlite } = fixture(week1.getTime());
    const historyRepo = createHistoryRepository(db, sqlite);

    sqlite
      .prepare("INSERT INTO session_adjustment VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("adj-1", "account-a", "plan-a", "2026-08-03", 0, "monday", "reschedule", "wednesday", "[]", "fake-recommendation", week1.getTime());

    const adherence = historyRepo.computeAdherence("account-a", "plan-a", week1);
    expect(adherence).toEqual({ previstas: 1, completadas: 0, adaptadas: 0, parciales: 0, omitidas: 0, recolocadas: 1 });
  });
});
