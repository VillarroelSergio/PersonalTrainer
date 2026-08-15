/**
 * Client-side outbox for offline mutations (Fase 5 strength recording, generalized
 * in Task 4 of the local-first plan to every queueable Trainer action).
 * Storage-agnostic: `OutboxStore` is implemented by IndexedDB in the browser
 * (indexeddb-store.ts) and by an in-memory Map in tests, so the flush logic
 * itself never touches a browser API and can be exercised without a DOM.
 */

import type { PlanEditInput, PlanSessionContentInput } from "@/contracts/plan";
import type { CheckinInput, DecideRecommendationInput } from "@/contracts/training-engine";
import type { OnboardingFormPatch } from "@/contracts/onboarding";
import type { CommitImportInput, EnduranceDesignInput } from "@/contracts/endurance";

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

export type StartWorkoutPayload = { planId: string; sessionIndex: number };
export type StartRecoverySessionPayload = { planId: string; sessionIndex: number };
export type FinishRecoverySessionPayload = { comment: string | null };
export type SubmitCheckinPayload = CheckinInput & { checkinDate?: string };
export type DecideRecommendationPayload = DecideRecommendationInput;
export type ConfirmActivityImportPayload = { storageKey: string; originalName: string; sha256: string; sizeBytes: number };
export type StageActivityImportPayload = { fileId: string; userId: string; originalName: string; sizeBytes: number; mimeType: string; sha256: string };
export type SubstituteVariantPayload = { sessionExerciseId: string; variantId: string };

type BaseFields = { id: string; createdAt: number; status: "pending" | "conflict" | "error" };

export type OutboxOperation =
  | (BaseFields & { kind: "record_set"; workoutSessionId: string; payload: RecordSetPayload })
  | (BaseFields & { kind: "remove_set"; workoutSessionId: string; payload: RemoveSetPayload })
  | (BaseFields & { kind: "substitute_variant"; workoutSessionId: string; payload: SubstituteVariantPayload })
  | (BaseFields & { kind: "finish_workout"; workoutSessionId: string; baseVersion: number; payload: FinishWorkoutPayload; conflictVersion?: number })
  | (BaseFields & { kind: "start_workout"; workoutSessionId: string; payload: StartWorkoutPayload })
  | (BaseFields & { kind: "start_recovery_session"; recoverySessionId: string; payload: StartRecoverySessionPayload })
  | (BaseFields & { kind: "finish_recovery_session"; recoverySessionId: string; payload: FinishRecoverySessionPayload })
  | (BaseFields & { kind: "submit_checkin"; payload: SubmitCheckinPayload })
  | (BaseFields & { kind: "decide_recommendation"; payload: DecideRecommendationPayload })
  | (BaseFields & { kind: "set_favorite"; variantId: string })
  | (BaseFields & { kind: "unset_favorite"; variantId: string })
  | (BaseFields & { kind: "plan_session_edit"; planId: string; payload: PlanEditInput })
  | (BaseFields & { kind: "plan_session_content_edit"; planId: string; payload: PlanSessionContentInput })
  | (BaseFields & { kind: "update_onboarding_draft"; payload: OnboardingFormPatch })
  | (BaseFields & { kind: "save_endurance_design"; payload: EnduranceDesignInput })
  | (BaseFields & { kind: "stage_activity_import"; payload: StageActivityImportPayload })
  | (BaseFields & { kind: "confirm_activity_import"; payload: ConfirmActivityImportPayload })
  | (BaseFields & { kind: "commit_activity_import"; importId: string; payload: CommitImportInput })
  | (BaseFields & { kind: "create_share_link"; planId: string })
  | (BaseFields & { kind: "revoke_share_link"; linkId: string });

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

function isVisibleToAccount(operation: OutboxOperation, userId: string | null): boolean {
  if (operation.kind !== "stage_activity_import") return true;
  return userId !== null && operation.payload.userId === userId;
}

export function createAccountScopedOutboxStore(store: OutboxStore, userId: string | null): OutboxStore {
  return {
    async all() {
      return (await store.all()).filter((operation) => isVisibleToAccount(operation, userId));
    },
    async put(operation) {
      await store.put(operation);
    },
    async remove(id) {
      const visible = (await store.all()).some((operation) => operation.id === id && isVisibleToAccount(operation, userId));
      if (visible) await store.remove(id);
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
