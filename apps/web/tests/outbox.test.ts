import { describe, expect, it } from "vitest";
import { createMemoryOutboxStore, flushOutbox, type OutboxOperation, type SubmitResult } from "@/lib/offline/outbox";

function setOp(id: string, createdAt: number, status: OutboxOperation["status"] = "pending"): OutboxOperation {
  return { id, kind: "record_set", workoutSessionId: "ws-1", payload: { sessionExerciseId: "se-1", setNumber: 1, loadKg: 40, repetitions: 10, difficulty: null }, createdAt, status };
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
});
