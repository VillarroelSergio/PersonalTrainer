import { describe, expect, it, vi } from "vitest";
import { createMemoryOutboxStore, flushOutbox, type OutboxOperation, type SubmitResult } from "@/lib/offline/outbox";

function setOp(id: string, createdAt: number, status: OutboxOperation["status"] = "pending", workoutSessionId = "ws-1"): OutboxOperation {
  return { id, kind: "record_set", workoutSessionId, payload: { sessionExerciseId: "se-1", setNumber: 1, loadKg: 40, repetitions: 10, difficulty: null }, createdAt, status };
}

describe("flushOutbox (pure)", () => {
  it("processes operations strictly in enqueue order", async () => {
    const store = createMemoryOutboxStore([setOp("b", 2), setOp("a", 1), setOp("c", 3)]);
    const order: string[] = [];
    const summary = await flushOutbox(store, async (op) => { order.push(op.id); return { status: "ok" }; });
    expect(order).toEqual(["a", "b", "c"]);
    expect(summary.synced).toBe(3);
    expect(await store.all()).toEqual([]);
  });

  it("stops at the first network failure, leaving that operation and everything after it queued", async () => {
    const store = createMemoryOutboxStore([setOp("a", 1), setOp("b", 2), setOp("c", 3)]);
    let calls = 0;
    const submit: (op: OutboxOperation) => Promise<SubmitResult> = async (op) => {
      calls += 1;
      if (op.id === "b") return { status: "network_error" };
      return { status: "ok" };
    };
    const summary = await flushOutbox(store, submit);
    expect(calls).toBe(2); // never even attempts "c"
    expect(summary.synced).toBe(1);
    expect(summary.stoppedForNetwork).toBe(true);
    const remaining = await store.all();
    expect(remaining.map((op) => op.id)).toEqual(["b", "c"]);
  });

  it("marks a rejected operation as 'error' and stops, without discarding it", async () => {
    const store = createMemoryOutboxStore([setOp("a", 1)]);
    const summary = await flushOutbox(store, async () => ({ status: "rejected", message: "invalid" }));
    expect(summary.errors).toHaveLength(1);
    const remaining = await store.all();
    expect(remaining[0].status).toBe("error");
  });

  it("never re-attempts an operation already marked 'conflict' or 'error' on a later flush call", async () => {
    const store = createMemoryOutboxStore([setOp("a", 1, "conflict"), setOp("b", 2, "error"), setOp("c", 3, "pending")]);
    const attempted: string[] = [];
    const summary = await flushOutbox(store, async (op) => { attempted.push(op.id); return { status: "ok" }; });
    expect(attempted).toEqual(["c"]);
    expect(summary.synced).toBe(1);
    const remaining = await store.all();
    expect(remaining.map((op) => op.id)).toEqual(["a", "b"]);
  });

  it("an empty outbox flushes as a no-op success", async () => {
    const store = createMemoryOutboxStore([]);
    const summary = await flushOutbox(store, async () => ({ status: "ok" }));
    expect(summary).toMatchObject({ synced: 0, pending: 0, conflicts: [], errors: [], stoppedForNetwork: false });
  });

  it("does not submit a dependent plan edit after a workout conflict", async () => {
    const finishOp: OutboxOperation = {
      id: "finish-1", kind: "finish_workout", workoutSessionId: "ws-1", baseVersion: 1, createdAt: 1, status: "pending",
      payload: { status: "completed", globalEffort: 7, comment: null, discomfort: null }
    };
    const planEditOp: OutboxOperation = {
      id: "edit-1", kind: "plan_session_edit", planId: "plan-1", createdAt: 2, status: "pending",
      payload: { kind: "skip", isoWeekStart: "2026-08-10", sessionIndex: 0 }
    };
    const storeWithConflict = createMemoryOutboxStore([finishOp, planEditOp]);
    const submit = vi.fn(async (): Promise<SubmitResult> => ({ status: "conflict", currentVersion: 2 }));
    const summary = await flushOutbox(storeWithConflict, submit);
    expect(summary.conflicts).toHaveLength(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("replays an offline workout start before its sets", async () => {
    const startOp: OutboxOperation = {
      id: "start-1", kind: "start_workout", workoutSessionId: "local-1", createdAt: 1, status: "pending",
      payload: { planId: "plan-1", sessionIndex: 0 }
    };
    const storeWithStartAndSet = createMemoryOutboxStore([startOp, setOp("set-1", 2)]);
    const order: string[] = [];
    const submit = async (op: OutboxOperation): Promise<SubmitResult> => { order.push(op.kind); return { status: "ok" }; };
    const summary = await flushOutbox(storeWithStartAndSet, submit);
    expect(summary).toMatchObject({ synced: 2 });
    expect(order).toEqual(["start_workout", "record_set"]);
  });

  it("repoints sets queued against a local session id at the id the server assigned", async () => {
    const startOp: OutboxOperation = {
      id: "start-1", kind: "start_workout", workoutSessionId: "local-workout-1", createdAt: 1, status: "pending",
      payload: { planId: "plan-1", sessionIndex: 0 }
    };
    const store = createMemoryOutboxStore([startOp, setOp("set-1", 2, "pending", "local-workout-1")]);
    const submitted: Array<string | undefined> = [];
    const submit = async (op: OutboxOperation): Promise<SubmitResult> => {
      submitted.push("workoutSessionId" in op ? op.workoutSessionId : undefined);
      return op.kind === "start_workout" ? { status: "ok", serverId: "ws-real-1" } : { status: "ok" };
    };

    const summary = await flushOutbox(store, submit);

    // Without the remap the set goes to /workouts/local-workout-1/sets, the server rejects
    // an id it never issued, and the queue stops with the whole workout unsynced.
    expect(submitted).toEqual(["local-workout-1", "ws-real-1"]);
    expect(summary).toMatchObject({ synced: 2, pending: 0 });
  });

  it("leaves operations for other sessions untouched when one session is remapped", async () => {
    const startOp: OutboxOperation = {
      id: "start-1", kind: "start_workout", workoutSessionId: "local-workout-1", createdAt: 1, status: "pending",
      payload: { planId: "plan-1", sessionIndex: 0 }
    };
    const store = createMemoryOutboxStore([startOp, setOp("set-1", 2, "pending", "ws-9")]);
    const submitted: Array<string | undefined> = [];
    const submit = async (op: OutboxOperation): Promise<SubmitResult> => {
      submitted.push("workoutSessionId" in op ? op.workoutSessionId : undefined);
      return op.kind === "start_workout" ? { status: "ok", serverId: "ws-real-1" } : { status: "ok" };
    };

    await flushOutbox(store, submit);

    expect(submitted).toEqual(["local-workout-1", "ws-9"]);
  });
});
