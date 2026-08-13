import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { startWorkoutResponse } from "@/app/api/v1/workouts/handler";
import { recordSetResponse, removeSetResponse } from "@/app/api/v1/workouts/[id]/sets/handler";
import { finishWorkoutResponse } from "@/app/api/v1/workouts/[id]/finish/handler";
import { createMemoryOutboxStore, flushOutbox, type OutboxOperation, type SubmitResult } from "@/lib/offline/outbox";
import { getDb } from "@/lib/db/client";
import { setPerformance, trainingPlan, user, workoutSession } from "@/lib/db/schema";
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

async function fixture() {
  const db = getDb();
  const now = new Date();
  const ownerId = `account-a-${crypto.randomUUID()}`;
  const planId = `plan-a-${ownerId}`;
  await db.insert(user).values({ id: ownerId, name: ownerId, email: `${ownerId}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  await db.insert(trainingPlan).values({ id: planId, ownerId, name: "Plan A", status: "active", version: 1, contentJson: JSON.stringify(proposal), createdAt: now });
  return { db, ownerId, planId };
}

async function cleanup(db: ReturnType<typeof getDb>, ownerId: string) {
  await db.delete(user).where(eq(user.id, ownerId));
}

// Scoped to a single session_exercise (never a bare table-wide count): this suite runs against the
// shared local Postgres alongside other test files, so an unscoped count would pick up unrelated rows.
async function countSetPerformance(db: ReturnType<typeof getDb>, sessionExerciseId: string): Promise<number> {
  return (await db.select().from(setPerformance).where(eq(setPerformance.sessionExerciseId, sessionExerciseId))).length;
}

/** Drives the outbox against the real handlers in-process (no HTTP layer) — the "sin red simulada" flavor of integration test the Fase 5 exit gate asks for. `offline` flips every call to a network failure, standing in for "no coverage in the gym". */
function makeSubmit(db: ReturnType<typeof getDb>, user: { id: string }, offline: { value: boolean }) {
  return async function submit(operation: OutboxOperation): Promise<SubmitResult> {
    if (offline.value) return { status: "network_error" };

    const response =
      operation.kind === "record_set"
        ? await recordSetResponse(
            new Request("http://localhost", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(operation.payload) }),
            user, db, operation.workoutSessionId
          )
        : operation.kind === "remove_set"
          ? await removeSetResponse(
              new Request("http://localhost", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(operation.payload) }),
              user, db, operation.workoutSessionId
            )
        : await finishWorkoutResponse(
            new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": operation.id }, body: JSON.stringify({ clientOperationId: operation.id, baseVersion: operation.baseVersion, ...operation.payload }) }),
            user, db, operation.workoutSessionId
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
    const { db, ownerId, planId } = await fixture();
    const user = { id: ownerId };
    const start = await startWorkoutResponse(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId, sessionIndex: 0 }) }), user, db);
    const { workoutSession: startedSession, sessionExercises } = (await start.json()).data;
    const exerciseId = sessionExercises[0].id;

    const store = createMemoryOutboxStore();
    for (let setNumber = 1; setNumber <= 3; setNumber += 1) {
      await store.put({ id: `set-${setNumber}`, kind: "record_set", workoutSessionId: startedSession.id, payload: { sessionExerciseId: exerciseId, setNumber, loadKg: 60, repetitions: 8, difficulty: "just_right" }, createdAt: setNumber, status: "pending" });
    }
    await store.put({ id: "finish-1", kind: "finish_workout", workoutSessionId: startedSession.id, baseVersion: startedSession.version, payload: { status: "completed", globalEffort: 6, comment: null, discomfort: null }, createdAt: 4, status: "pending" });

    // No coverage in the gym: everything queues, nothing reaches the server.
    const offline = { value: true };
    const submit = makeSubmit(db, user, offline);
    const offlineSummary = await flushOutbox(store, submit);
    expect(offlineSummary.synced).toBe(0);
    expect(offlineSummary.stoppedForNetwork).toBe(true);
    expect((await store.all()).length).toBe(4);
    expect(await countSetPerformance(db, exerciseId)).toBe(0);

    // Back online: flush reconciles everything real, in order.
    offline.value = false;
    const onlineSummary = await flushOutbox(store, submit);
    expect(onlineSummary.synced).toBe(4);
    expect(onlineSummary.conflicts).toEqual([]);
    expect((await store.all()).length).toBe(0);
    expect(await countSetPerformance(db, exerciseId)).toBe(3);
    const finished = (await db.select({ status: workoutSession.status, version: workoutSession.version }).from(workoutSession).where(eq(workoutSession.id, startedSession.id)))[0];
    expect(finished.status).toBe("completed");
    expect(finished.version).toBe(2);

    // Reconciling again (retry of an already-applied operation, or a second flush of an empty outbox) never duplicates a set or re-closes the session.
    await store.put({ id: "set-1", kind: "record_set", workoutSessionId: startedSession.id, payload: { sessionExerciseId: exerciseId, setNumber: 1, loadKg: 60, repetitions: 8, difficulty: "just_right" }, createdAt: 1, status: "pending" });
    await store.put({ id: "finish-1", kind: "finish_workout", workoutSessionId: startedSession.id, baseVersion: startedSession.version, payload: { status: "completed", globalEffort: 6, comment: null, discomfort: null }, createdAt: 4, status: "pending" });
    const replaySummary = await flushOutbox(store, submit);
    expect(replaySummary.synced).toBe(2);
    expect(await countSetPerformance(db, exerciseId)).toBe(3);
    const stillFinished = (await db.select({ status: workoutSession.status, version: workoutSession.version }).from(workoutSession).where(eq(workoutSession.id, startedSession.id)))[0];
    expect(stillFinished.version).toBe(2);

    await cleanup(db, ownerId);
  });

  it("surfaces a version conflict instead of silently overwriting a session finished elsewhere", async () => {
    const { db, ownerId, planId } = await fixture();
    const user = { id: ownerId };
    const start = await startWorkoutResponse(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId, sessionIndex: 0 }) }), user, db);
    const { workoutSession: startedSession } = (await start.json()).data;

    // Another device closes the session first, at version 1.
    const offline = { value: false };
    const submit = makeSubmit(db, user, offline);
    await submit({ id: "finish-other-device", kind: "finish_workout", workoutSessionId: startedSession.id, baseVersion: 1, payload: { status: "completed", globalEffort: 8, comment: null, discomfort: null }, createdAt: 1, status: "pending" });

    // This device queued its own close while offline, still against baseVersion 1.
    const store = createMemoryOutboxStore();
    await store.put({ id: "finish-this-device", kind: "finish_workout", workoutSessionId: startedSession.id, baseVersion: 1, payload: { status: "partial", globalEffort: 4, comment: null, discomfort: null }, createdAt: 2, status: "pending" });

    const summary = await flushOutbox(store, submit);
    expect(summary.synced).toBe(0);
    expect(summary.conflicts).toHaveLength(1);
    expect(summary.conflicts[0]).toMatchObject({ id: "finish-this-device", status: "conflict", conflictVersion: 2 });

    // The server's version — from the device that finished first — is never silently overwritten.
    const row = (await db.select({ status: workoutSession.status }).from(workoutSession).where(eq(workoutSession.id, startedSession.id)))[0];
    expect(row.status).toBe("completed");

    await cleanup(db, ownerId);
  });
});
