/**
 * Pure local-first helpers for CheckinRunner (Fase 5, Task 5). No React, no fetch.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { applyLocalMutation } from "@/lib/offline/snapshot-client";
import { createClientId } from "@/lib/client-id";
import type { OutboxOperation, SubmitCheckinPayload } from "@/lib/offline/outbox";

export type CreateId = () => string;

/** Deliberately loose (not `@/contracts/training-engine`'s `RecommendationChange`): both the
 * server contract and the UI's own local `Recommendation` type structurally satisfy this. */
type DecideOfflineChange = { code: string; kind: string; description: string };

export type DecideOfflineInput = {
  recommendationId: string;
  decision: "apply" | "keep" | "reject";
  changeCode?: string;
  /** The candidate changes the person was choosing among, needed to resolve which
   * adjustment kind (e.g. "recovery") to reflect locally before the server confirms it. */
  changes: DecideOfflineChange[];
};

/** Queues a check-in submission locally. There is no useful local "recommendation" to
 * compute offline (it requires server-side plan/adaptation logic), so this only enqueues. */
export function submitCheckinOffline(
  snapshot: OfflineSnapshot,
  payload: SubmitCheckinPayload,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const checkins = (snapshot.data.checkins as unknown[] | undefined) ?? [];
  const nextSnapshot = applyLocalMutation(snapshot, { checkins: [...checkins, payload] });
  const operation: OutboxOperation = { id: createId(), kind: "submit_checkin", payload, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation };
}

/** Applies a check-in decision locally: updates `data.today.adjustment` immediately so
 * "/hoy" reflects the chosen change (or "keep planned") before the server confirms it. */
export function decideOffline(
  snapshot: OfflineSnapshot,
  input: DecideOfflineInput,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const chosenChange = input.decision === "apply" ? input.changes.find((change) => change.code === input.changeCode) ?? null : null;
  const kind = input.decision === "apply" ? (chosenChange?.kind ?? "keep_planned") : input.decision === "keep" ? "keep_planned" : null;

  const today = kind
    ? { adjustment: { kind, code: chosenChange?.code ?? null, decidedAt: new Date().toISOString() } }
    : snapshot.data.today ?? null;

  const nextSnapshot = applyLocalMutation(snapshot, { today });
  const operation: OutboxOperation = {
    id: createId(),
    kind: "decide_recommendation",
    payload: { recommendationId: input.recommendationId, decision: input.decision, changeCode: input.changeCode },
    createdAt: Date.now(),
    status: "pending"
  };
  return { snapshot: nextSnapshot, operation };
}
