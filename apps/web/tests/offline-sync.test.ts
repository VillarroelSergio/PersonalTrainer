import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { startWorkoutResponse } from "@/app/api/v1/workouts/handler";
import { recordSetResponse, removeSetResponse } from "@/app/api/v1/workouts/[id]/sets/handler";
import { finishWorkoutResponse } from "@/app/api/v1/workouts/[id]/finish/handler";
import { createMemoryOutboxStore, flushOutbox, type OutboxOperation, type SubmitResult } from "@/lib/offline/outbox";
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
    CREATE TABLE session_adjustment (id text primary key, owner_id text not null, plan_id text not null, iso_week_start text not null, session_index integer not null, origin_day text not null, kind text not null, target_day text, ops_json text not null, recommendation_id text not null, created_at integer not null);
    CREATE UNIQUE INDEX session_adjustment_owner_week_session_idx ON session_adjustment (owner_id, plan_id, iso_week_start, session_index);
  `);
  const now = Date.now();
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "account-a", "account-a@example.test", 1, null, now, now);
  sqlite.prepare("INSERT INTO training_plan (id, owner_id, name, status, version, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, JSON.stringify(proposal), now);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

/** Drives the outbox against the real handlers in-process (no HTTP layer) — the "sin red simulada" flavor of integration test the Fase 5 exit gate asks for. `offline` flips every call to a network failure, standing in for "no coverage in the gym". */
function makeSubmit(db: ReturnType<typeof fixture>["db"], sqlite: ReturnType<typeof fixture>["sqlite"], user: { id: string }, offline: { value: boolean }) {
  return async function submit(operation: OutboxOperation): Promise<SubmitResult> {
    if (offline.value) return { status: "network_error" };

    const response =
      operation.kind === "record_set"
        ? await recordSetResponse(
            new Request("http://localhost", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(operation.payload) }),
            user, db, sqlite, operation.workoutSessionId
          )
        : operation.kind === "remove_set"
          ? await removeSetResponse(
              new Request("http://localhost", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(operation.payload) }),
              user, db, sqlite, operation.workoutSessionId
            )
        : await finishWorkoutResponse(
            new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": operation.id }, body: JSON.stringify({ clientOperationId: operation.id, baseVersion: operation.baseVersion, ...operation.payload }) }),
            user, db, sqlite, operation.workoutSessionId
          );

    if (response.ok) return { status: "ok" };
    if (response.status === 409) {
      const body = await response.json();
      return { status: "conflict", currentVersion: body.error.details.currentVersion };
    }
    return { status: "rejected", message: (await response.json()).error.message };
  };
}

describe("offline outbox reconciliation for a strength session", () => {
  it("records three sets and closes the session with no network available, then reconciles without duplicating anything once back online", async () => {
    const { db, sqlite } = fixture();
    const user = { id: "account-a" };
    const start = await startWorkoutResponse(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: "plan-a", sessionIndex: 0 }) }), user, db, sqlite);
    const { workoutSession, sessionExercises } = (await start.json()).data;
    const exerciseId = sessionExercises[0].id;

    const store = createMemoryOutboxStore();
    for (let setNumber = 1; setNumber <= 3; setNumber += 1) {
      await store.put({ id: `set-${setNumber}`, kind: "record_set", workoutSessionId: workoutSession.id, payload: { sessionExerciseId: exerciseId, setNumber, loadKg: 60, repetitions: 8, difficulty: "just_right" }, createdAt: setNumber, status: "pending" });
    }
    await store.put({ id: "finish-1", kind: "finish_workout", workoutSessionId: workoutSession.id, baseVersion: workoutSession.version, payload: { status: "completed", globalEffort: 6, comment: null, discomfort: null }, createdAt: 4, status: "pending" });

    // No coverage in the gym: everything queues, nothing reaches the server.
    const offline = { value: true };
    const submit = makeSubmit(db, sqlite, user, offline);
    const offlineSummary = await flushOutbox(store, submit);
    expect(offlineSummary.synced).toBe(0);
    expect(offlineSummary.stoppedForNetwork).toBe(true);
    expect((await store.all()).length).toBe(4);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM set_performance").get()).toEqual({ n: 0 });

    // Back online: flush reconciles everything real, in order.
    offline.value = false;
    const onlineSummary = await flushOutbox(store, submit);
    expect(onlineSummary.synced).toBe(4);
    expect(onlineSummary.conflicts).toEqual([]);
    expect((await store.all()).length).toBe(0);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM set_performance").get()).toEqual({ n: 3 });
    const finished = sqlite.prepare("SELECT status, version FROM workout_session WHERE id = ?").get(workoutSession.id) as { status: string; version: number };
    expect(finished.status).toBe("completed");
    expect(finished.version).toBe(2);

    // Reconciling again (retry of an already-applied operation, or a second flush of an empty outbox) never duplicates a set or re-closes the session.
    await store.put({ id: "set-1", kind: "record_set", workoutSessionId: workoutSession.id, payload: { sessionExerciseId: exerciseId, setNumber: 1, loadKg: 60, repetitions: 8, difficulty: "just_right" }, createdAt: 1, status: "pending" });
    await store.put({ id: "finish-1", kind: "finish_workout", workoutSessionId: workoutSession.id, baseVersion: workoutSession.version, payload: { status: "completed", globalEffort: 6, comment: null, discomfort: null }, createdAt: 4, status: "pending" });
    const replaySummary = await flushOutbox(store, submit);
    expect(replaySummary.synced).toBe(2);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM set_performance").get()).toEqual({ n: 3 });
    const stillFinished = sqlite.prepare("SELECT status, version FROM workout_session WHERE id = ?").get(workoutSession.id) as { status: string; version: number };
    expect(stillFinished.version).toBe(2);
  });

  it("surfaces a version conflict instead of silently overwriting a session finished elsewhere", async () => {
    const { db, sqlite } = fixture();
    const user = { id: "account-a" };
    const start = await startWorkoutResponse(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId: "plan-a", sessionIndex: 0 }) }), user, db, sqlite);
    const { workoutSession } = (await start.json()).data;

    // Another device closes the session first, at version 1.
    const offline = { value: false };
    const submit = makeSubmit(db, sqlite, user, offline);
    await submit({ id: "finish-other-device", kind: "finish_workout", workoutSessionId: workoutSession.id, baseVersion: 1, payload: { status: "completed", globalEffort: 8, comment: null, discomfort: null }, createdAt: 1, status: "pending" });

    // This device queued its own close while offline, still against baseVersion 1.
    const store = createMemoryOutboxStore();
    await store.put({ id: "finish-this-device", kind: "finish_workout", workoutSessionId: workoutSession.id, baseVersion: 1, payload: { status: "partial", globalEffort: 4, comment: null, discomfort: null }, createdAt: 2, status: "pending" });

    const summary = await flushOutbox(store, submit);
    expect(summary.synced).toBe(0);
    expect(summary.conflicts).toHaveLength(1);
    expect(summary.conflicts[0]).toMatchObject({ id: "finish-this-device", status: "conflict", conflictVersion: 2 });

    // The server's version — from the device that finished first — is never silently overwritten.
    const row = sqlite.prepare("SELECT status FROM workout_session WHERE id = ?").get(workoutSession.id) as { status: string };
    expect(row.status).toBe("completed");
  });
});
