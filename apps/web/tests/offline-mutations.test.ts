import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryOutboxStore, flushOutbox, type OutboxOperation, type SubmitResult } from "@/lib/offline/outbox";
import { submitOperation } from "@/lib/offline/sync-client";

/**
 * Task 4: every new outbox kind (workout/recovery lifecycle, check-in decisions,
 * favorites, plan edits, profile/draft edits, endurance designs, activity imports,
 * sharing) round-trips through the generic flushOutbox algorithm exactly like
 * record_set/remove_set/finish_workout already do, and maps to its real endpoint
 * in sync-client.ts's submitOperation.
 */

const NEW_KINDS: OutboxOperation[] = [
  { id: "op-start-workout", kind: "start_workout", workoutSessionId: "local-ws-1", createdAt: 1, status: "pending", payload: { planId: "plan-1", sessionIndex: 0 } },
  { id: "op-start-recovery", kind: "start_recovery_session", recoverySessionId: "local-rs-1", createdAt: 1, status: "pending", payload: { planId: "plan-1", sessionIndex: 1 } },
  { id: "op-finish-recovery", kind: "finish_recovery_session", recoverySessionId: "rs-1", createdAt: 1, status: "pending", payload: { comment: "listo" } },
  { id: "op-submit-checkin", kind: "submit_checkin", createdAt: 1, status: "pending", payload: { energy: "normal", motivation: "high", timeAvailableMinutes: 40, equipmentUnavailable: false, discomfort: null } },
  { id: "op-decide-recommendation", kind: "decide_recommendation", createdAt: 1, status: "pending", payload: { recommendationId: "rec-1", decision: "apply", changeCode: "reduce_sets" } },
  { id: "op-set-favorite", kind: "set_favorite", variantId: "variant-1", createdAt: 1, status: "pending" },
  { id: "op-unset-favorite", kind: "unset_favorite", variantId: "variant-1", createdAt: 1, status: "pending" },
  { id: "op-plan-edit", kind: "plan_session_edit", planId: "plan-1", createdAt: 1, status: "pending", payload: { kind: "move", isoWeekStart: "2026-08-10", sessionIndex: 0, targetDay: "tuesday" } },
  { id: "op-onboarding-draft", kind: "update_onboarding_draft", createdAt: 1, status: "pending", payload: { experience: "beginner" } },
  { id: "op-endurance-design", kind: "save_endurance_design", createdAt: 1, status: "pending", payload: { isoWeekStart: "2026-08-10", sessionIndex: 0, objective: "base" } },
  { id: "op-confirm-import", kind: "confirm_activity_import", createdAt: 1, status: "pending", payload: { storageKey: "activity-imports/u1/f.fit", originalName: "run.fit", sha256: "abc", sizeBytes: 10 } },
  { id: "op-commit-import", kind: "commit_activity_import", importId: "import-1", createdAt: 1, status: "pending", payload: { name: "Carrera", sport: "running" } },
  { id: "op-create-share", kind: "create_share_link", planId: "plan-1", createdAt: 1, status: "pending" },
  { id: "op-revoke-share", kind: "revoke_share_link", linkId: "link-1", createdAt: 1, status: "pending" }
];

describe("OutboxOperation union covers every offline mutation", () => {
  it.each(NEW_KINDS)("stores and flushes a $kind operation with a stable client id", async (operation) => {
    const store = createMemoryOutboxStore([operation]);
    const submit = vi.fn(async (): Promise<SubmitResult> => ({ status: "ok" }));
    const summary = await flushOutbox(store, submit);
    expect(summary.synced).toBe(1);
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ id: operation.id, kind: operation.kind }));
    expect(await store.all()).toEqual([]);
  });

  it("stops on network failure and keeps a still-pending operation queued, regardless of kind", async () => {
    const store = createMemoryOutboxStore([NEW_KINDS[0], NEW_KINDS[1]]);
    const summary = await flushOutbox(store, async () => ({ status: "network_error" }));
    expect(summary.stoppedForNetwork).toBe(true);
    expect((await store.all()).map((op) => op.id)).toEqual([NEW_KINDS[0].id, NEW_KINDS[1].id]);
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
    const setOp: OutboxOperation = {
      id: "set-1", kind: "record_set", workoutSessionId: "local-1", createdAt: 2, status: "pending",
      payload: { sessionExerciseId: "se-1", setNumber: 1, loadKg: 20, repetitions: 8, difficulty: null }
    };
    const storeWithStartAndSet = createMemoryOutboxStore([startOp, setOp]);
    expect(await flushOutbox(storeWithStartAndSet, async () => ({ status: "ok" }))).toMatchObject({ synced: 2 });
  });
});

describe("submitOperation maps each new kind to its real endpoint", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(status = 200) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const expectations: Array<[OutboxOperation, string, string]> = [
    [NEW_KINDS[0], "POST", "/api/v1/workouts"],
    [NEW_KINDS[1], "POST", "/api/v1/recovery-sessions"],
    [NEW_KINDS[2], "POST", "/api/v1/recovery-sessions/rs-1/finish"],
    [NEW_KINDS[3], "POST", "/api/v1/checkins"],
    [NEW_KINDS[4], "POST", "/api/v1/recommendations/decision"],
    [NEW_KINDS[5], "PUT", "/api/v1/me/favorites/exercise-variants/variant-1"],
    [NEW_KINDS[6], "DELETE", "/api/v1/me/favorites/exercise-variants/variant-1"],
    [NEW_KINDS[7], "POST", "/api/v1/plans/plan-1/session-edits"],
    [NEW_KINDS[8], "PUT", "/api/v1/onboarding/draft"],
    [NEW_KINDS[9], "POST", "/api/v1/endurance-designs"],
    [NEW_KINDS[10], "POST", "/api/v1/activity-imports"],
    [NEW_KINDS[11], "POST", "/api/v1/activity-imports/import-1/commit"],
    [NEW_KINDS[12], "POST", "/api/v1/plans/plan-1/share-links"],
    [NEW_KINDS[13], "DELETE", "/api/v1/share-links/link-1"]
  ];

  it.each(expectations)("submits %s as %s %s", async (operation, method, url) => {
    const fetchMock = stubFetch();
    const result = await submitOperation(operation);
    expect(result).toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method, headers: expect.objectContaining({ "idempotency-key": operation.id }) }));
  });

  it("treats a non-conflict, non-5xx rejection as 'rejected' for a best-effort endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "no válido" } }), { status: 400 })));
    const result = await submitOperation(NEW_KINDS[8]);
    expect(result).toEqual({ status: "rejected", message: "no válido" });
  });

  it("keeps an operation retryable when the session expired instead of rejecting it", async () => {
    // A 401 mid-workout means "no valid session right now", not "this set is invalid".
    // Rejecting marked it `error`, which flushOutbox skips forever and no UI action can
    // revive: the recorded set was dropped silently while the pill said "Sincronizado".
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Necesitas iniciar sesión." } }), { status: 401 })));
    const recordSet: OutboxOperation = {
      id: "set-401", kind: "record_set", workoutSessionId: "ws-1", createdAt: 1, status: "pending",
      payload: { sessionExerciseId: "se-1", setNumber: 1, loadKg: 40, repetitions: 10, difficulty: null }
    };
    expect(await submitOperation(recordSet)).toEqual({ status: "network_error" });

    const store = createMemoryOutboxStore([recordSet]);
    const summary = await flushOutbox(store, submitOperation);
    expect(summary.stoppedForNetwork).toBe(true);
    expect(await store.all()).toEqual([recordSet]);
  });
});
