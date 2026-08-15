/**
 * Pure local-first helpers for ShareLinkManager (Fase 5, Task 6 follow-up). No React, no fetch.
 * `generate()`'s online success uses the server-issued token as the link's id; offline there is no
 * server-issued token yet, so a locally-generated client id stands in as a placeholder — same
 * "locally-provisional id later reconciled by a real snapshot refresh" pattern already used for
 * `local-workout-N` ids in workout-offline.ts.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { applyLocalMutation } from "@/lib/offline/snapshot-client";
import { createClientId } from "@/lib/client-id";
import type { OutboxOperation } from "@/lib/offline/outbox";

export type CreateId = () => string;

export type ShareLinkRow = { id: string; ownerId: string; planId: string; createdAt: string; revokedAt: string | null };

export function createShareLinkOffline(
  snapshot: OfflineSnapshot,
  planId: string,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation; row: ShareLinkRow } {
  const links = (snapshot.data.shareLinks as ShareLinkRow[] | undefined) ?? [];
  const row: ShareLinkRow = { id: createId(), ownerId: snapshot.userId, planId, createdAt: new Date().toISOString(), revokedAt: null };
  const nextSnapshot = applyLocalMutation(snapshot, { shareLinks: [row, ...links] });
  const operation: OutboxOperation = { id: createId(), kind: "create_share_link", planId, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation, row };
}

export function revokeShareLinkOffline(
  snapshot: OfflineSnapshot,
  linkId: string,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const links = (snapshot.data.shareLinks as ShareLinkRow[] | undefined) ?? [];
  const nextLinks = links.map((row) => (row.id === linkId ? { ...row, revokedAt: new Date().toISOString() } : row));
  const nextSnapshot = applyLocalMutation(snapshot, { shareLinks: nextLinks });
  const operation: OutboxOperation = { id: createId(), kind: "revoke_share_link", linkId, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation };
}
