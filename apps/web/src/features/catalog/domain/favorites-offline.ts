/**
 * Pure local-first helper for favoriting/unfavoriting an exercise variant
 * (Fase 5, Task 6, Part A). Same `{ snapshot, operation }` pattern as
 * workout-offline.ts/checkin-offline.ts/recovery-offline.ts: no React, no
 * fetch. The caller (FavoriteToggle) decides when to call it — on a failed
 * network request — and applies the result via useOfflineData()/useOfflineSyncContext().
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { applyLocalMutation } from "@/lib/offline/snapshot-client";
import { createClientId } from "@/lib/client-id";
import type { OutboxOperation } from "@/lib/offline/outbox";

export type CreateId = () => string;

function favoriteVariantIdsOf(snapshot: OfflineSnapshot): string[] {
  return (snapshot.data.favoriteVariantIds as string[] | undefined) ?? [];
}

/** Toggles a variant's favorite status locally. Un-favorites if already favorited, otherwise favorites it. */
export function toggleFavoriteOffline(
  snapshot: OfflineSnapshot,
  variantId: string,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const current = favoriteVariantIdsOf(snapshot);
  const wasFavorite = current.includes(variantId);
  const favoriteVariantIds = wasFavorite ? current.filter((id) => id !== variantId) : [...current, variantId];
  const nextSnapshot = applyLocalMutation(snapshot, { favoriteVariantIds });
  const operation: OutboxOperation = wasFavorite
    ? { id: createId(), kind: "unset_favorite", variantId, createdAt: Date.now(), status: "pending" }
    : { id: createId(), kind: "set_favorite", variantId, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation };
}
