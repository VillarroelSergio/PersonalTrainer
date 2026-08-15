/**
 * Pure local-first helpers for CheckinRunner (Fase 5, Task 5). No React, no fetch.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { applyLocalMutation } from "@/lib/offline/snapshot-client";
import { createClientId } from "@/lib/client-id";
import type { OutboxOperation, SubmitCheckinPayload } from "@/lib/offline/outbox";
import type { RecommendationOp } from "@/contracts/training-engine";

export type CreateId = () => string;

/** Deliberately loose (not `@/contracts/training-engine`'s `RecommendationChange`): both the
 * server contract and the UI's own local `Recommendation` type structurally satisfy this. */
type DecideOfflineChange = { code: string; kind: string; description: string; ops: RecommendationOp[] };

export type PlanEditRow = {
  id: string;
  ownerId: string;
  planId: string;
  isoWeekStart: string;
  sessionIndex: number;
  originDay: string;
  kind: string;
  targetDay: string | null;
  opsJson: string;
  recommendationId: string | null;
  createdAt: string;
};

export type DecideOfflineInput = {
  recommendationId: string;
  decision: "apply" | "keep" | "reject";
  changeCode?: string;
  /** The candidate changes the person was choosing among, needed to resolve which
   * adjustment kind (e.g. "recovery") to reflect locally before the server confirms it. */
  changes: DecideOfflineChange[];
  /** Context needed to write a real `sessionAdjustment`-shaped row (mirrors runDecide's
   * server-side write) instead of the previous made-up, unread `data.today.adjustment`. */
  planId: string | null;
  isoWeekStart: string | null;
  originDay: string | null;
  sessionIndex: number | null;
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

/** Applies a check-in decision locally: when the applied change carries mechanical ops,
 * upserts a `sessionAdjustment`-shaped row into `data.planEdits` immediately (mirrors
 * `repository.ts`'s `runDecide`: only when `change.ops.length > 0`), so "/hoy" reflects the
 * change before the server confirms it — the exact same table `/hoy` already reads. "keep"
 * and "reject" never write an adjustment server-side either, so neither do they here. */
export function decideOffline(
  snapshot: OfflineSnapshot,
  input: DecideOfflineInput,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const chosenChange = input.decision === "apply" ? input.changes.find((change) => change.code === input.changeCode) ?? null : null;

  let nextSnapshot = snapshot;
  if (chosenChange && chosenChange.ops.length > 0 && input.planId != null && input.isoWeekStart != null && input.sessionIndex != null && input.originDay != null) {
    const planEdits = (snapshot.data.planEdits as PlanEditRow[] | undefined) ?? [];
    const withoutExisting = planEdits.filter(
      (row) => !(row.planId === input.planId && row.isoWeekStart === input.isoWeekStart && row.sessionIndex === input.sessionIndex)
    );
    const rescheduleOp = chosenChange.ops.find((op): op is Extract<RecommendationOp, { op: "reschedule" }> => op.op === "reschedule");
    const adjustment: PlanEditRow = {
      id: createId(),
      ownerId: snapshot.userId,
      planId: input.planId,
      isoWeekStart: input.isoWeekStart,
      sessionIndex: input.sessionIndex,
      originDay: input.originDay,
      kind: chosenChange.kind,
      targetDay: rescheduleOp?.targetDay ?? null,
      opsJson: JSON.stringify(chosenChange.ops),
      recommendationId: input.recommendationId,
      createdAt: new Date().toISOString()
    };
    nextSnapshot = applyLocalMutation(snapshot, { planEdits: [...withoutExisting, adjustment] });
  }

  const operation: OutboxOperation = {
    id: createId(),
    kind: "decide_recommendation",
    payload: { recommendationId: input.recommendationId, decision: input.decision, changeCode: input.changeCode },
    createdAt: Date.now(),
    status: "pending"
  };
  return { snapshot: nextSnapshot, operation };
}
