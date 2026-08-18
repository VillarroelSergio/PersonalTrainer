/**
 * Pure local-first helpers for PlanSessionActions/PlanSessionEditPage (Fase 5, Task 6). No React,
 * no fetch. Both write to the same snapshot fields their real endpoints ultimately persist to:
 * `applySessionEditOffline` mirrors `plan-edit-repository.ts`'s `runEdit` (writes a
 * `sessionAdjustment`-shaped row, the same table `/hoy`'s `checkin-offline.ts` already writes
 * offline); `applySessionContentEditOffline` mirrors its `updateSessionContent`, which does NOT
 * write a `sessionAdjustment` row at all — it patches `trainingPlan.contentJson` in place — so its
 * offline counterpart patches `snapshot.data.activePlan.contentJson` directly instead.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { applyLocalMutation } from "@/lib/offline/snapshot-client";
import { createClientId } from "@/lib/client-id";
import type { OutboxOperation } from "@/lib/offline/outbox";
import type { PlanEditInput, PlanSessionContentInput } from "@/contracts/plan";
import type { PlanProposal } from "@/contracts/onboarding";

export type CreateId = () => string;

type ActivePlanRow = { id: string; contentJson: string; version?: number };

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

/** Applies a move/skip/remove/restore session edit locally, mirroring `plan-edit-repository.ts`'s
 * `runEdit` exactly: "restore" and a "move" back to the session's own day both just delete any
 * existing adjustment row; "move"/"skip"/"remove" upsert one, keyed by (planId, isoWeekStart, sessionIndex). */
export function applySessionEditOffline(
  snapshot: OfflineSnapshot,
  planId: string,
  input: PlanEditInput,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const activePlan = snapshot.data.activePlan as ActivePlanRow;
  const proposal = JSON.parse(activePlan.contentJson) as PlanProposal;
  const plannedSession = proposal.week?.sessions?.[input.sessionIndex];

  const planEdits = (snapshot.data.planEdits as PlanEditRow[] | undefined) ?? [];
  const withoutExisting = planEdits.filter(
    (row) => !(row.planId === planId && row.isoWeekStart === input.isoWeekStart && row.sessionIndex === input.sessionIndex)
  );

  let nextRow: PlanEditRow | null = null;
  if (input.kind === "move" && plannedSession && input.targetDay !== plannedSession.day) {
    nextRow = {
      id: createId(),
      ownerId: snapshot.userId,
      planId,
      isoWeekStart: input.isoWeekStart,
      sessionIndex: input.sessionIndex,
      originDay: plannedSession.day,
      kind: "reschedule",
      targetDay: input.targetDay,
      opsJson: JSON.stringify([{ op: "reschedule", targetDay: input.targetDay }]),
      recommendationId: null,
      createdAt: new Date().toISOString()
    };
  } else if (input.kind === "skip" && plannedSession) {
    nextRow = {
      id: createId(), ownerId: snapshot.userId, planId, isoWeekStart: input.isoWeekStart, sessionIndex: input.sessionIndex,
      originDay: plannedSession.day, kind: "skipped", targetDay: null, opsJson: "[]", recommendationId: null, createdAt: new Date().toISOString()
    };
  } else if (input.kind === "remove" && plannedSession) {
    nextRow = {
      id: createId(), ownerId: snapshot.userId, planId, isoWeekStart: input.isoWeekStart, sessionIndex: input.sessionIndex,
      originDay: plannedSession.day, kind: "removed", targetDay: null, opsJson: "[]", recommendationId: null, createdAt: new Date().toISOString()
    };
  }
  // "restore", or a "move" back onto the session's own day: nextRow stays null, i.e. delete-only.

  const nextSnapshot = applyLocalMutation(snapshot, { planEdits: nextRow ? [...withoutExisting, nextRow] : withoutExisting });
  const operation: OutboxOperation = { id: createId(), kind: "plan_session_edit", planId, payload: input, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation };
}

/** Applies a session content edit (exercises/blocks) locally, mirroring `plan-edit-repository.ts`'s
 * `updateSessionContent`: it never writes a `sessionAdjustment` row, it patches the plan's own
 * `contentJson` in place — so the offline counterpart patches `snapshot.data.activePlan` the same way. */
export function applySessionContentEditOffline(
  snapshot: OfflineSnapshot,
  planId: string,
  input: PlanSessionContentInput,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const activePlan = snapshot.data.activePlan as ActivePlanRow;
  const proposal = JSON.parse(activePlan.contentJson) as PlanProposal;
  const updatedProposal: PlanProposal = {
    ...proposal,
    week: {
      ...proposal.week,
      sessions: proposal.week.sessions.map((session, sessionIndex) => (
        sessionIndex === input.sessionIndex ? { ...session, exercises: input.exercises, blocks: input.blocks ?? session.blocks } : session
      ))
    }
  };
  const nextActivePlan: ActivePlanRow = { ...activePlan, contentJson: JSON.stringify(updatedProposal), version: (activePlan.version ?? 1) + 1 };
  const nextSnapshot = applyLocalMutation(snapshot, { activePlan: nextActivePlan });
  const operation: OutboxOperation = { id: createId(), kind: "plan_session_content_edit", planId, payload: input, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation };
}
