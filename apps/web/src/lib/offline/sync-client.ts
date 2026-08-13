"use client";

import type { OutboxOperation, SubmitResult } from "./outbox";

/** Submits one queued operation over the real network to the same idempotent endpoints the online UI uses. Browser-only (fetch), not unit-tested directly — the retry/conflict/dedupe behaviour it feeds into (flushOutbox) is tested with a fake submit function instead. */
export async function submitOperation(operation: OutboxOperation): Promise<SubmitResult> {
  const isSetOperation = operation.kind === "record_set" || operation.kind === "remove_set";
  const url = isSetOperation ? `/api/v1/workouts/${operation.workoutSessionId}/sets` : `/api/v1/workouts/${operation.workoutSessionId}/finish`;
  const body = isSetOperation ? operation.payload : { clientOperationId: operation.id, baseVersion: operation.baseVersion, ...operation.payload };

  let response: Response;
  try {
    response = await fetch(url, {
      method: operation.kind === "record_set" ? "PUT" : operation.kind === "remove_set" ? "DELETE" : "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "idempotency-key": operation.id },
      body: JSON.stringify(body)
    });
  } catch {
    return { status: "network_error" };
  }

  if (response.ok) return { status: "ok" };
  if (response.status >= 500) return { status: "network_error" };
  if (response.status === 409) {
    const parsed = await response.json().catch(() => null);
    const currentVersion = parsed?.error?.details?.currentVersion;
    return { status: "conflict", currentVersion: typeof currentVersion === "number" ? currentVersion : (operation.kind === "finish_workout" ? operation.baseVersion + 1 : 0) };
  }
  const parsed = await response.json().catch(() => null);
  return { status: "rejected", message: parsed?.error?.message ?? "No pudimos completar la operación." };
}
