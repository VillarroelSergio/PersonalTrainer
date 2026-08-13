import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { createWorkoutSessionRepository, WorkoutNotFoundError } from "@/features/workouts/domain/workout-session-repository";
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
      { day: "monday", kind: "strength", title: "Fuerza: piernas", estimatedMinutes: 60, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] }
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
  const now = Date.now();
  for (const id of ["account-a", "account-b"]) {
    sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, id, `${id}@example.test`, 1, null, now, now);
  }
  sqlite.prepare("INSERT INTO training_plan (id, owner_id, name, status, version, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, JSON.stringify(proposal), now);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

function completeThreeSets(repo: ReturnType<typeof createWorkoutSessionRepository>, ownerId: string, workoutSessionId: string, sessionExerciseId: string, repetitions: number) {
  for (let setNumber = 1; setNumber <= 3; setNumber += 1) {
    repo.recordSet(ownerId, workoutSessionId, sessionExerciseId, setNumber, 40, repetitions, "just_right");
  }
}

describe("workout session repository", () => {
  it("starts a session from the plan, resumes the same in-progress workout, and records sets", () => {
    const { db, sqlite } = fixture();
    const repo = createWorkoutSessionRepository(db, sqlite);

    const started = repo.startOrResumeWorkout("account-a", "plan-a", 0);
    expect(started.sessionExercises).toHaveLength(1);
    const resumed = repo.startOrResumeWorkout("account-a", "plan-a", 0);
    expect(resumed.workoutSession.id).toBe(started.workoutSession.id);

    repo.recordSet("account-a", started.workoutSession.id, started.sessionExercises[0].id, 1, 40, 10, "just_right");
    const sets = sqlite.prepare("SELECT load_kg, repetitions FROM set_performance WHERE session_exercise_id = ?").all(started.sessionExercises[0].id);
    expect(sets).toEqual([{ load_kg: 40, repetitions: 10 }]);
  });

  it("removes a recorded set so resuming the workout does not mark it as completed", () => {
    const { db, sqlite } = fixture();
    const repo = createWorkoutSessionRepository(db, sqlite);
    const started = repo.startOrResumeWorkout("account-a", "plan-a", 0);
    const exerciseId = started.sessionExercises[0].id;

    repo.recordSet("account-a", started.workoutSession.id, exerciseId, 1, 40, 10, "just_right");
    repo.removeSet("account-a", started.workoutSession.id, exerciseId, 1);

    expect(sqlite.prepare("SELECT COUNT(*) as count FROM set_performance WHERE session_exercise_id = ?").get(exerciseId)).toEqual({ count: 0 });
    const resumed = repo.startOrResumeWorkout("account-a", "plan-a", 0);
    expect((resumed.sessionExercises[0] as { sets?: unknown[] }).sets ?? []).toEqual([]);
  });

  it("produces correct history and an explainable suggestion after three complete exposures of a variant", () => {
    const { db, sqlite } = fixture();
    const repo = createWorkoutSessionRepository(db, sqlite);

    for (let exposure = 0; exposure < 3; exposure += 1) {
      const started = repo.startOrResumeWorkout("account-a", "plan-a", 0);
      completeThreeSets(repo, "account-a", started.workoutSession.id, started.sessionExercises[0].id, 10);
      repo.finishWorkout("account-a", started.workoutSession.id, crypto.randomUUID(), started.workoutSession.version, "completed", 7, null, null);
    }

    const baseline = repo.getBaseline("account-a", "squat-barbell");
    expect(baseline).toBeDefined();
    const summary = JSON.parse(baseline!.summaryJson);
    expect(summary.ruleVersion).toBe("progression-v1");
    expect(summary.suggestion.type).toBe("increase_load");
    expect(summary.suggestion.reason).toEqual(expect.any(String));
  });

  it("keeps both variants' histories independent after substituting mid-plan", () => {
    const { db, sqlite } = fixture();
    const repo = createWorkoutSessionRepository(db, sqlite);

    const started = repo.startOrResumeWorkout("account-a", "plan-a", 0);
    completeThreeSets(repo, "account-a", started.workoutSession.id, started.sessionExercises[0].id, 10);
    const replacement = repo.substituteVariant("account-a", started.workoutSession.id, started.sessionExercises[0].id, "squat-dumbbell");
    completeThreeSets(repo, "account-a", started.workoutSession.id, replacement.id, 12);
    repo.finishWorkout("account-a", started.workoutSession.id, crypto.randomUUID(), started.workoutSession.version, "completed", 7, null, null);

    const barbellSets = sqlite.prepare("SELECT COUNT(*) as count FROM set_performance WHERE session_exercise_id = ?").get(started.sessionExercises[0].id) as { count: number };
    const dumbbellSets = sqlite.prepare("SELECT COUNT(*) as count FROM set_performance WHERE session_exercise_id = ?").get(replacement.id) as { count: number };
    expect(barbellSets.count).toBe(3);
    expect(dumbbellSets.count).toBe(3);
    expect(repo.getBaseline("account-a", "squat-barbell")).toBeDefined();
    expect(repo.getBaseline("account-a", "squat-dumbbell")).toBeDefined();
  });

  it("keeps partial/adapted/completed close states correct and distinct", () => {
    const { db, sqlite } = fixture();
    const repo = createWorkoutSessionRepository(db, sqlite);

    const partial = repo.startOrResumeWorkout("account-a", "plan-a", 0);
    repo.recordSet("account-a", partial.workoutSession.id, partial.sessionExercises[0].id, 1, 40, 10, "just_right");
    repo.finishWorkout("account-a", partial.workoutSession.id, crypto.randomUUID(), partial.workoutSession.version, "partial", 5, null, null);

    const adapted = repo.startOrResumeWorkout("account-a", "plan-a", 0);
    completeThreeSets(repo, "account-a", adapted.workoutSession.id, adapted.sessionExercises[0].id, 10);
    repo.finishWorkout("account-a", adapted.workoutSession.id, crypto.randomUUID(), adapted.workoutSession.version, "adapted", 6, "cambié el ejercicio por molestia", null);

    const statuses = sqlite.prepare("SELECT status FROM workout_session ORDER BY started_at").all() as Array<{ status: string }>;
    expect(statuses.map((row) => row.status)).toEqual(["partial", "adapted"]);

    const baseline = repo.getBaseline("account-a", "squat-barbell");
    const summary = JSON.parse(baseline!.summaryJson);
    expect(summary.suggestion.type).toBe("maintain");
  });

  it("never resumes or finishes another account's workout", () => {
    const { db, sqlite } = fixture();
    const repo = createWorkoutSessionRepository(db, sqlite);

    const started = repo.startOrResumeWorkout("account-a", "plan-a", 0);
    expect(() => repo.finishWorkout("account-b", started.workoutSession.id, crypto.randomUUID(), started.workoutSession.version, "completed", 5, null, null)).toThrow(WorkoutNotFoundError);
    expect(() => repo.recordSet("account-b", started.workoutSession.id, started.sessionExercises[0].id, 1, 40, 10, "just_right")).toThrow(WorkoutNotFoundError);
  });
});
