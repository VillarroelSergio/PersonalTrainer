import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { evaluateCheckin } from "@/features/training-engine/domain/engine";
import { RecommendationAlreadyDecidedError, createWorkoutTrainingEngineRepository } from "@/features/training-engine/domain/repository";
import { applyAdjustmentOps, createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import * as schema from "@/lib/db/schema";
import { isoWeekStart, parseIsoDateLocal } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";
import type { CheckinInput } from "@/contracts/training-engine";

const basicProposal: PlanProposal = {
  proposalId: "proposal-a",
  ruleVersion: "plan-proposal-v1",
  reasons: [],
  alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
  week: {
    sessions: [
      {
        day: "monday", kind: "strength", title: "Fuerza: empuje", estimatedMinutes: 60,
        exercises: [
          { variantId: "push-h-bench", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 },
          { variantId: "push-v-dumbbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }
        ]
      }
    ]
  }
};

const legsProximityProposal: PlanProposal = {
  ...basicProposal,
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Fuerza: piernas", estimatedMinutes: 60, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] },
      { day: "tuesday", kind: "endurance", title: "Carrera larga", estimatedMinutes: 60 }
    ]
  }
};

const emptyCheckin: CheckinInput = {};

function pureFixtureToday() {
  // 2026-08-10 is a Monday, matching both fixture proposals' "monday" session.
  return "monday" as const;
}

describe("evaluateCheckin (pure rule engine)", () => {
  it("proposes dropping the last accessory when declared time is below the planned duration", () => {
    const result = evaluateCheckin({ timeAvailableMinutes: 40 }, pureFixtureToday(), basicProposal);
    const change = result.changes.find((c) => c.code === "TIME_CONSTRAINT");
    expect(change).toBeDefined();
    expect(change!.ops).toEqual([{ op: "remove_exercise", position: 1 }]);
    expect(result.decisionRequired).toBe(true);
  });

  it("proposes bodyweight substitutions when equipment is declared unavailable, never auto-applied", () => {
    const result = evaluateCheckin({ equipmentUnavailable: true }, pureFixtureToday(), basicProposal);
    const change = result.changes.find((c) => c.code === "EQUIPMENT_UNAVAILABLE");
    expect(change).toBeDefined();
    expect(change!.ops.every((op) => op.op === "replace_variant")).toBe(true);
    // The candidate is only a proposal: nothing about the plan itself changed.
    expect(basicProposal.week.sessions[0].exercises![0].variantId).toBe("push-h-bench");
  });

  it("uses prudent, non-diagnostic language and offers stop/adapt for important discomfort", () => {
    const result = evaluateCheckin({ discomfort: { zone: "knee", intensity: "important" } }, pureFixtureToday(), basicProposal);
    expect(result.importantDiscomfort).toBe(true);
    const change = result.changes.find((c) => c.code === "IMPORTANT_DISCOMFORT");
    expect(change).toBeDefined();
    expect(change!.description).not.toMatch(/lesión/i);
    expect(change!.description).toMatch(/no es un diagnóstico/i);
    expect(result.decisionRequired).toBe(true);
  });

  it("warns about a legs-heavy session near a long/intense endurance session and offers move/keep, never moves it silently", () => {
    const result = evaluateCheckin(emptyCheckin, pureFixtureToday(), legsProximityProposal);
    const change = result.changes.find((c) => c.code === "LOWER_BODY_PROXIMITY");
    expect(change).toBeDefined();
    expect(change!.kind).toBe("reschedule");
    expect(change!.ops).toEqual([{ op: "reschedule", targetDay: "wednesday" }]);
    // A keep-planned alternative is always present alongside the guardrail.
    expect(result.changes.some((c) => c.code === "KEEP_PLANNED")).toBe(true);
  });

  it("does not warn when there is no session today", () => {
    const result = evaluateCheckin(emptyCheckin, "sunday", basicProposal);
    expect(result.sessionIndex).toBeNull();
    expect(result.decisionRequired).toBe(false);
    expect(result.reasonCodes).toEqual(["NO_SESSION_TODAY"]);
  });

  it("a confirmed real activity near a legs-heavy session offers to move it, sourced from what actually happened, and mentions the real duration", () => {
    const evidence = { sport: "running", startedAt: "2026-08-09T08:00:00Z", hoursAgo: 20, durationS: 52 * 60, distanceM: 9000 };
    const result = evaluateCheckin(emptyCheckin, "monday", legsProximityProposal, evidence);
    const change = result.changes.find((c) => c.code === "EXTERNAL_LEGS_PROXIMITY");
    expect(change).toBeDefined();
    expect(change!.description).toMatch(/52 min/);
    expect(result.externalEvidence).toEqual(evidence);
    expect(result.humanReason).toMatch(/52 min/);
  });

  it("a real activity that is not legs-adjacent or substantial is still surfaced in the explanation, without forcing an alternative", () => {
    const evidence = { sport: "running", startedAt: "2026-08-09T08:00:00Z", hoursAgo: 20, durationS: 15 * 60, distanceM: 2000 };
    const result = evaluateCheckin(emptyCheckin, "monday", basicProposal, evidence);
    expect(result.changes.some((c) => c.code === "EXTERNAL_LEGS_PROXIMITY")).toBe(false);
    expect(result.humanReason).toMatch(/15 min/);
    expect(result.humanReason).toMatch(/mantenemos/i);
  });

  it("never invents a duration when the real activity doesn't have one, and flags it as missing data", () => {
    const evidence = { sport: "running", startedAt: "2026-08-09T08:00:00Z", hoursAgo: 20, durationS: null, distanceM: null };
    const result = evaluateCheckin(emptyCheckin, "monday", basicProposal, evidence);
    expect(result.humanReason).toMatch(/sin duración registrada/);
    expect(result.humanReason).not.toMatch(/\d+ min/);
    expect(result.missingData).toContain("externalActivityDuration");
  });

  it("without any confirmed activity, keeps the exact same behavior as before Bloqueante 2 (no evidence branch, no mention of activity)", () => {
    const result = evaluateCheckin(emptyCheckin, "monday", legsProximityProposal);
    expect(result.externalEvidence).toBeNull();
    expect(result.changes.some((c) => c.code === "EXTERNAL_LEGS_PROXIMITY")).toBe(false);
  });
});

function fixture(proposal: PlanProposal) {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null, source text, source_template_id text, source_template_version text, catalog_version text);
    CREATE TABLE checkin (owner_id text not null, checkin_date text not null, energy text, motivation text, time_available_minutes integer, equipment_unavailable integer not null default 0, discomfort_json text, created_at integer not null);
    CREATE UNIQUE INDEX checkin_owner_date_idx ON checkin (owner_id, checkin_date);
    CREATE TABLE recommendation (id text primary key, owner_id text not null, plan_id text not null, checkin_date text not null, session_index integer, rule_version text not null, confidence text not null, reason_codes_json text not null, human_reason text not null, changes_json text not null, alternatives_json text not null, missing_data_json text not null, external_evidence_json text, important_discomfort integer not null default 0, decision_status text not null default 'pending', decided_change_code text, decided_at integer, created_at integer not null);
    CREATE TABLE endurance_activity (id text primary key, owner_id text not null, import_id text, plan_id text, iso_week_start text, session_index integer, sport text not null, name text not null, source text not null, fingerprint text not null, started_at integer not null, duration_s integer, distance_m real, created_at integer not null);
    CREATE UNIQUE INDEX recommendation_owner_plan_date_idx ON recommendation (owner_id, plan_id, checkin_date);
    CREATE TABLE session_adjustment (id text primary key, owner_id text not null, plan_id text not null, iso_week_start text not null, session_index integer not null, origin_day text not null, kind text not null, target_day text, ops_json text not null, recommendation_id text not null, created_at integer not null);
    CREATE UNIQUE INDEX session_adjustment_owner_week_session_idx ON session_adjustment (owner_id, plan_id, iso_week_start, session_index);
    CREATE TABLE workout_session (id text primary key, owner_id text not null, plan_id text not null, session_index integer not null, status text not null default 'in_progress', version integer not null default 1, last_finish_operation_id text, started_at integer not null, ended_at integer, global_effort integer, comment text, discomfort_json text, created_at integer not null);
    CREATE TABLE session_exercise (id text primary key, workout_session_id text not null, variant_id text not null, position integer not null, status text not null default 'active', target_sets integer not null, target_reps_min integer not null, target_reps_max integer not null);
    CREATE TABLE set_performance (id text primary key, session_exercise_id text not null, set_number integer not null, load_kg integer, repetitions integer, difficulty text, completed_at integer not null);
    CREATE UNIQUE INDEX set_performance_exercise_set_idx ON set_performance (session_exercise_id, set_number);
    CREATE TABLE performance_baseline (owner_id text not null, variant_id text not null, confidence integer, summary_json text not null, rule_version text not null, calculated_at integer not null);
    CREATE UNIQUE INDEX performance_baseline_owner_variant_idx ON performance_baseline (owner_id, variant_id);
  `);
  const now = Date.now();
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "account-a", "a@example.test", 1, null, now, now);
  sqlite.prepare("INSERT INTO training_plan (id, owner_id, name, status, version, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, JSON.stringify(proposal), now);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

describe("training engine repository", () => {
  it("resubmitting a check-in the same day overwrites the recommendation, never duplicates it", () => {
    const { db, sqlite } = fixture(basicProposal);
    const repo = createWorkoutTrainingEngineRepository(db, sqlite);

    const first = repo.submitCheckin("account-a", "2026-08-10", { timeAvailableMinutes: 40 });
    const second = repo.submitCheckin("account-a", "2026-08-10", { timeAvailableMinutes: 20 });
    expect(first.recommendationId).not.toBe(second.recommendationId);

    const rows = sqlite.prepare("SELECT COUNT(*) as count FROM recommendation WHERE owner_id = ?").get("account-a") as { count: number };
    expect(rows.count).toBe(1);
  });

  it("recording keep/reject leaves the session states untouched (no silent adjustment)", () => {
    const { db, sqlite } = fixture(basicProposal);
    const repo = createWorkoutTrainingEngineRepository(db, sqlite);

    const recommendation = repo.submitCheckin("account-a", "2026-08-10", { timeAvailableMinutes: 40 });
    repo.decideRecommendation("account-a", { recommendationId: recommendation.recommendationId, decision: "keep" });

    const adjustments = sqlite.prepare("SELECT COUNT(*) as count FROM session_adjustment").get() as { count: number };
    expect(adjustments.count).toBe(0);
    expect(() => repo.decideRecommendation("account-a", { recommendationId: recommendation.recommendationId, decision: "keep" })).toThrow(RecommendationAlreadyDecidedError);
  });

  it("applying a candidate creates one session_adjustment; re-deciding the same weekly occurrence overwrites it, never duplicates", () => {
    const { db, sqlite } = fixture(basicProposal);
    const repo = createWorkoutTrainingEngineRepository(db, sqlite);

    const first = repo.submitCheckin("account-a", "2026-08-10", { timeAvailableMinutes: 40 });
    repo.decideRecommendation("account-a", { recommendationId: first.recommendationId, decision: "apply", changeCode: "TIME_CONSTRAINT" });

    // Same ISO week, same planned session index (resubmitting the same day's check-in regenerates a fresh, undecided recommendation): must overwrite, not add a row.
    const second = repo.submitCheckin("account-a", "2026-08-10", { timeAvailableMinutes: 20 });
    repo.decideRecommendation("account-a", { recommendationId: second.recommendationId, decision: "apply", changeCode: "TIME_CONSTRAINT" });

    const week = isoWeekStart(parseIsoDateLocal("2026-08-10"));
    const adjustments = sqlite.prepare("SELECT COUNT(*) as count FROM session_adjustment WHERE owner_id = ? AND plan_id = ? AND iso_week_start = ? AND session_index = 0").get("account-a", "plan-a", week) as { count: number };
    expect(adjustments.count).toBe(1);
  });

  it("an applied equipment-substitution adjustment actually changes the assigned exercises when the session starts", () => {
    const { db, sqlite } = fixture(basicProposal);
    const engineRepo = createWorkoutTrainingEngineRepository(db, sqlite);
    const workoutRepo = createWorkoutSessionRepository(db, sqlite);

    const recommendation = engineRepo.submitCheckin("account-a", "2026-08-10", { equipmentUnavailable: true });
    const change = recommendation.changes.find((c) => c.code === "EQUIPMENT_UNAVAILABLE")!;
    engineRepo.decideRecommendation("account-a", { recommendationId: recommendation.recommendationId, decision: "apply", changeCode: change.code });

    const adjustment = engineRepo.getAdjustment("account-a", "plan-a", isoWeekStart(parseIsoDateLocal("2026-08-10")), 0)!;
    expect(adjustment).toBeDefined();
    const ops = JSON.parse(adjustment.opsJson);

    const started = workoutRepo.startOrResumeWorkout("account-a", "plan-a", 0, ops);
    expect(started.sessionExercises[0].variantId).not.toBe("push-h-bench");
    expect(started.sessionExercises[0].variantId).toBe("push-h-pushup");
  });

  it("a confirmed imported activity from yesterday changes today's recommendation and is persisted as evidence", () => {
    const { db, sqlite } = fixture(legsProximityProposal);
    const repo = createWorkoutTrainingEngineRepository(db, sqlite);
    const yesterday = new Date("2026-08-09T08:00:00Z").getTime();
    sqlite.prepare(
      "INSERT INTO endurance_activity (id, owner_id, sport, name, source, fingerprint, started_at, duration_s, distance_m, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("activity-1", "account-a", "running", "Carrera", "imported", "running|1|52", yesterday, 52 * 60, 9000, yesterday);

    const recommendation = repo.submitCheckin("account-a", "2026-08-10", {});
    expect(recommendation.externalEvidence).not.toBeNull();
    expect(recommendation.externalEvidence!.durationS).toBe(52 * 60);
    const change = recommendation.changes.find((c) => c.code === "EXTERNAL_LEGS_PROXIMITY");
    expect(change).toBeDefined();

    const row = sqlite.prepare("SELECT external_evidence_json FROM recommendation WHERE id = ?").get(recommendation.recommendationId) as { external_evidence_json: string };
    expect(JSON.parse(row.external_evidence_json).sport).toBe("running");
  });

  it("never mixes another account's activity into this account's recommendation", () => {
    const { db, sqlite } = fixture(legsProximityProposal);
    sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-b", "account-b", "b@example.test", 1, null, 0, 0);
    const repo = createWorkoutTrainingEngineRepository(db, sqlite);
    const yesterday = new Date("2026-08-09T08:00:00Z").getTime();
    sqlite.prepare(
      "INSERT INTO endurance_activity (id, owner_id, sport, name, source, fingerprint, started_at, duration_s, distance_m, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("activity-b", "account-b", "running", "Carrera", "imported", "running|1|52", yesterday, 52 * 60, 9000, yesterday);

    const recommendation = repo.submitCheckin("account-a", "2026-08-10", {});
    expect(recommendation.externalEvidence).toBeNull();
  });
});

describe("applyAdjustmentOps (pure)", () => {
  const exercises = [
    { variantId: "push-h-bench", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 },
    { variantId: "push-v-dumbbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }
  ];

  it("removes the exercise at the given position without mutating the input", () => {
    const result = applyAdjustmentOps(exercises, [{ op: "remove_exercise", position: 1 }]);
    expect(result).toHaveLength(1);
    expect(exercises).toHaveLength(2);
  });

  it("ignores ops it does not recognize (e.g. reschedule has no exercise-level effect)", () => {
    const result = applyAdjustmentOps(exercises, [{ op: "reschedule", targetDay: "wednesday" }]);
    expect(result).toEqual(exercises);
  });
});
