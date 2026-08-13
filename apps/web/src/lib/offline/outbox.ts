/**
 * Client-side outbox for the strength-session recording flow (Fase 5).
 * Storage-agnostic: `OutboxStore` is implemented by IndexedDB in the browser
 * (indexeddb-store.ts) and by an in-memory Map in tests, so the flush logic
 * itself never touches a browser API and can be exercised without a DOM.
 */

export type Difficulty = "too_easy" | "just_right" | "too_hard";
export type CloseStatus = "completed" | "adapted" | "partial";

export type RecordSetPayload = {
  sessionExerciseId: string;
  setNumber: number;
  loadKg: number | null;
  repetitions: number | null;
  difficulty: Difficulty | null;
};

export type RemoveSetPayload = Pick<RecordSetPayload, "sessionExerciseId" | "setNumber">;

export type FinishWorkoutPayload = {
  status: CloseStatus;
  globalEffort: number | null;
  comment: string | null;
  discomfort: { zone: string; side?: string; intensity: string; kind?: string } | null;
};

export type OutboxOperation =
  | { id: string; kind: "record_set"; workoutSessionId: string; payload: RecordSetPayload; createdAt: number; status: "pending" | "conflict" | "error" }
  | { id: string; kind: "remove_set"; workoutSessionId: string; payload: RemoveSetPayload; createdAt: number; status: "pending" | "conflict" | "error" }
  | { id: string; kind: "finish_workout"; workoutSessionId: string; baseVersion: number; payload: FinishWorkoutPayload; createdAt: number; status: "pending" | "conflict" | "error"; conflictVersion?: number };

export interface OutboxStore {
  all(): Promise<OutboxOperation[]>;
  put(operation: OutboxOperation): Promise<void>;
  remove(id: string): Promise<void>;
}

export function createMemoryOutboxStore(initial: OutboxOperation[] = []): OutboxStore {
  const operations = new Map(initial.map((operation) => [operation.id, operation]));
  return {
    async all() {
      return [...operations.values()].sort((a, b) => a.createdAt - b.createdAt);
    },
    async put(operation) {
      operations.set(operation.id, operation);
    },
    async remove(id) {
      operations.delete(id);
    }
  };
}

export type SubmitResult = { status: "ok" } | { status: "network_error" } | { status: "conflict"; currentVersion: number } | { status: "rejected"; message: string };
export type SubmitOperation = (operation: OutboxOperation) => Promise<SubmitResult>;

export type FlushSummary = { synced: number; pending: number; conflicts: OutboxOperation[]; errors: OutboxOperation[]; stoppedForNetwork: boolean };

/**
 * Flushes queued operations strictly in enqueue order. Stops at the first
 * network failure or conflict so a later operation for the same session
 * (e.g. "finish" after its "record_set" ops) never applies out of order —
 * everything already confirmed before the stop stays confirmed and removed.
 */
export async function flushOutbox(store: OutboxStore, submit: SubmitOperation): Promise<FlushSummary> {
  const operations = await store.all();
  let synced = 0;
  let stoppedForNetwork = false;

  for (const operation of operations) {
    if (operation.status !== "pending") continue;
    const result = await submit(operation);

    if (result.status === "ok") {
      await store.remove(operation.id);
      synced += 1;
      continue;
    }
    if (result.status === "network_error") {
      stoppedForNetwork = true;
      break;
    }
    if (result.status === "conflict") {
      await store.put({ ...operation, status: "conflict", ...(operation.kind === "finish_workout" ? { conflictVersion: result.currentVersion } : {}) });
      break;
    }
    await store.put({ ...operation, status: "error" });
    break;
  }

  const remaining = await store.all();
  return {
    synced,
    pending: remaining.filter((operation) => operation.status === "pending").length,
    conflicts: remaining.filter((operation) => operation.status === "conflict"),
    errors: remaining.filter((operation) => operation.status === "error"),
    stoppedForNetwork
  };
}
