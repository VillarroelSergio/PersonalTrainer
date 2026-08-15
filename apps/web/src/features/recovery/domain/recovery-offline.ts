/**
 * Pure local-first helpers for RecoveryRunner (Fase 5, Task 5). No React, no fetch.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { applyLocalMutation } from "@/lib/offline/snapshot-client";
import { createClientId } from "@/lib/client-id";
import type { FinishRecoverySessionPayload, OutboxOperation, StartRecoverySessionPayload } from "@/lib/offline/outbox";

export type CreateId = () => string;

type RecoverySession = { id: string; planId: string; sessionIndex: number; status: string; comment: string | null; startedAt: string };

/** Starts a recovery session locally with a "local-recovery-N" id, mirroring startWorkoutOffline. */
export function startRecoveryOffline(
  snapshot: OfflineSnapshot,
  payload: StartRecoverySessionPayload,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation; session: RecoverySession } {
  const sessionId = `local-recovery-${createId()}`;
  const session: RecoverySession = { id: sessionId, planId: payload.planId, sessionIndex: payload.sessionIndex, status: "in_progress", comment: null, startedAt: new Date().toISOString() };
  const recoverySessions = (snapshot.data.recoverySessions as RecoverySession[] | undefined) ?? [];
  const nextSnapshot = applyLocalMutation(snapshot, { recoverySessions: [...recoverySessions, session] });
  const operation: OutboxOperation = { id: createId(), kind: "start_recovery_session", recoverySessionId: sessionId, payload, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation, session };
}

/** Finishes a recovery session locally. */
export function finishRecoveryOffline(
  snapshot: OfflineSnapshot,
  recoverySessionId: string,
  payload: FinishRecoverySessionPayload,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const recoverySessions = (snapshot.data.recoverySessions as RecoverySession[] | undefined) ?? [];
  const nextRecoverySessions = recoverySessions.map((session) =>
    session.id === recoverySessionId ? { ...session, status: "completed", comment: payload.comment } : session
  );
  const nextSnapshot = applyLocalMutation(snapshot, { recoverySessions: nextRecoverySessions });
  const operation: OutboxOperation = { id: createId(), kind: "finish_recovery_session", recoverySessionId, payload, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation };
}
