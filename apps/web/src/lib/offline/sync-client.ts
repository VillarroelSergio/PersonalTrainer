"use client";

import type { OutboxOperation, SubmitResult } from "./outbox";
import { submitStagedActivityImport } from "@/features/endurance/domain/activity-import-offline";
import { createIndexedDbImportFileStore } from "./indexeddb-store";

type HttpOutboxOperation = Exclude<OutboxOperation, { kind: "stage_activity_import" }>;

/**
 * Maps every outbox operation kind to its real endpoint. Only `finish_workout`'s
 * endpoint validates `idempotency-key` against a `clientOperationId` in the body and
 * returns a versioned 409 (see workouts/[id]/finish/handler.ts); every other endpoint
 * below has no server-side idempotency or version-conflict support today, so a retry
 * after a `network_error` may resubmit and a 409 (where the endpoint can return one,
 * e.g. recommendations/decision) is treated as a generic conflict with no known
 * `currentVersion` — best-effort mapping, not invented server capability.
 */
function requestFor(operation: HttpOutboxOperation): { url: string; method: string; body?: unknown } {
  switch (operation.kind) {
    case "record_set":
      return { url: `/api/v1/workouts/${operation.workoutSessionId}/sets`, method: "PUT", body: operation.payload };
    case "remove_set":
      return { url: `/api/v1/workouts/${operation.workoutSessionId}/sets`, method: "DELETE", body: operation.payload };
    case "substitute_variant":
      return { url: `/api/v1/workouts/${operation.workoutSessionId}/exercises/${operation.payload.sessionExerciseId}`, method: "PATCH", body: { variantId: operation.payload.variantId } };
    case "finish_workout":
      return { url: `/api/v1/workouts/${operation.workoutSessionId}/finish`, method: "POST", body: { clientOperationId: operation.id, baseVersion: operation.baseVersion, ...operation.payload } };
    case "start_workout":
      return { url: "/api/v1/workouts", method: "POST", body: operation.payload };
    case "start_recovery_session":
      return { url: "/api/v1/recovery-sessions", method: "POST", body: operation.payload };
    case "finish_recovery_session":
      return { url: `/api/v1/recovery-sessions/${operation.recoverySessionId}/finish`, method: "POST", body: operation.payload };
    case "submit_checkin":
      return { url: "/api/v1/checkins", method: "POST", body: operation.payload };
    case "decide_recommendation":
      return { url: "/api/v1/recommendations/decision", method: "POST", body: operation.payload };
    case "set_favorite":
      return { url: `/api/v1/me/favorites/exercise-variants/${operation.variantId}`, method: "PUT" };
    case "unset_favorite":
      return { url: `/api/v1/me/favorites/exercise-variants/${operation.variantId}`, method: "DELETE" };
    case "plan_session_edit":
      return { url: `/api/v1/plans/${operation.planId}/session-edits`, method: "POST", body: operation.payload };
    case "plan_session_content_edit":
      return { url: `/api/v1/plans/${operation.planId}/session-content`, method: "POST", body: operation.payload };
    case "update_onboarding_draft":
      return { url: "/api/v1/onboarding/draft", method: "PUT", body: operation.payload };
    case "save_endurance_design":
      return { url: "/api/v1/endurance-designs", method: "POST", body: operation.payload };
    case "confirm_activity_import":
      return { url: "/api/v1/activity-imports", method: "POST", body: operation.payload };
    case "commit_activity_import":
      return { url: `/api/v1/activity-imports/${operation.importId}/commit`, method: "POST", body: operation.payload };
    case "create_share_link":
      return { url: `/api/v1/plans/${operation.planId}/share-links`, method: "POST" };
    case "revoke_share_link":
      return { url: `/api/v1/share-links/${operation.linkId}`, method: "DELETE" };
  }
}

/**
 * The id the server assigned to a session that was started offline under a local one.
 * flushOutbox needs it to repoint the sets already queued against the local id; without
 * it they address a session the server never issued and the queue jams on the first one.
 * Only read for the two session-creating kinds — every other response body is left alone.
 */
async function startedSessionServerId(operation: HttpOutboxOperation, response: Response): Promise<string | undefined> {
  if (operation.kind !== "start_workout" && operation.kind !== "start_recovery_session") return undefined;
  const body = await response.json().catch(() => null);
  const data = body?.data;
  const id = data?.workoutSession?.id ?? data?.recoverySession?.id ?? data?.id;
  return typeof id === "string" ? id : undefined;
}

/** Submits one queued operation over the real network to the same idempotent endpoints the online UI uses. Browser-only (fetch), not unit-tested directly — the retry/conflict/dedupe behaviour it feeds into (flushOutbox) is tested with a fake submit function instead. */
export async function submitOperation(operation: OutboxOperation, options: { currentUserId?: string } = {}): Promise<SubmitResult> {
  if (operation.kind === "stage_activity_import") {
    return submitStagedActivityImport(operation, { fileStore: createIndexedDbImportFileStore(), currentUserId: options.currentUserId });
  }

  const { url, method, body } = requestFor(operation);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? { "idempotency-key": operation.id } : { "content-type": "application/json", "idempotency-key": operation.id },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  } catch {
    return { status: "network_error" };
  }

  if (response.ok) return { status: "ok", serverId: await startedSessionServerId(operation, response) };
  if (response.status >= 500) return { status: "network_error" };
  if (response.status === 409) {
    const parsed = await response.json().catch(() => null);
    const currentVersion = parsed?.error?.details?.currentVersion;
    return { status: "conflict", currentVersion: typeof currentVersion === "number" ? currentVersion : (operation.kind === "finish_workout" ? operation.baseVersion + 1 : 0) };
  }
  const parsed = await response.json().catch(() => null);
  return { status: "rejected", message: parsed?.error?.message ?? "No pudimos completar la operación." };
}
