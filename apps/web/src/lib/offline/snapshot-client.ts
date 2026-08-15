/**
 * Pure hydrate/refresh logic for the offline snapshot (Fase 5, Task 3).
 * Mirrors outbox.ts's `flushOutbox`: storage- and network-agnostic so it is
 * unit-testable without a DOM. `OfflineDataContext.tsx` is the thin React
 * wrapper that calls `refreshSnapshot` on mount and on the `online` event.
 */

import type { OfflineSnapshot, OfflineSnapshotStore } from "./snapshot";

/** "loading" is UI-only (never returned by `refreshSnapshot` itself): it lets a consumer like
 * `OfflineRouteBoundary` distinguish "still hydrating from IndexedDB/network, be patient" from
 * the terminal "needs-initial-sync" (genuinely never synced) — both start out as `!snapshot`,
 * but only the latter should ever show the "Conexión inicial necesaria" message. */
export type SnapshotStatus = "offline" | "synced" | "needs-initial-sync" | "loading";
export type FetchSnapshot = () => Promise<Response>;
export type RefreshResult = { snapshot: OfflineSnapshot | null; status: SnapshotStatus; stale?: boolean };
export type RefreshSnapshotOptions = { shouldAccept?: (userId: string) => boolean };

function isValidSnapshotBody(body: unknown): body is { data: { snapshot: OfflineSnapshot; serverTime: number } } {
  if (typeof body !== "object" || body === null) return false;
  const data = (body as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return false;
  const snapshot = (data as { snapshot?: unknown }).snapshot;
  if (typeof snapshot !== "object" || snapshot === null) return false;
  const { userId, syncedAt, data: snapshotData } = snapshot as Partial<OfflineSnapshot>;
  return typeof userId === "string" && typeof syncedAt === "number" && typeof snapshotData === "object" && snapshotData !== null;
}

/**
 * Hydrates from the local store first, then tries the network. A validated
 * successful response replaces (and persists) the local snapshot. Any
 * failure — rejected fetch, non-ok status, or a malformed body — keeps
 * whatever was already cached instead of overwriting it with nothing.
 */
export async function refreshSnapshot(store: OfflineSnapshotStore, fetchFn: FetchSnapshot, userId: string, options: RefreshSnapshotOptions = {}): Promise<RefreshResult> {
  const isCurrent = () => options.shouldAccept?.(userId) ?? true;
  const stale = (): RefreshResult => ({ snapshot: null, status: "loading", stale: true });
  const cached = (await store.get(userId)) ?? null;
  if (!isCurrent()) return stale();

  let response: Response;
  try {
    response = await fetchFn();
  } catch {
    if (!isCurrent()) return stale();
    return cached ? { snapshot: cached, status: "offline" } : { snapshot: null, status: "needs-initial-sync" };
  }

  if (!isCurrent()) return stale();
  if (!response.ok) return cached ? { snapshot: cached, status: "offline" } : { snapshot: null, status: "needs-initial-sync" };

  const body = await response.json().catch(() => null);
  if (!isCurrent()) return stale();
  if (!isValidSnapshotBody(body)) return cached ? { snapshot: cached, status: "offline" } : { snapshot: null, status: "needs-initial-sync" };

  const snapshot = body.data.snapshot;
  if (snapshot.userId !== userId) return cached ? { snapshot: cached, status: "offline" } : { snapshot: null, status: "needs-initial-sync" };
  if (!isCurrent()) return stale();
  await store.put(snapshot);
  if (!isCurrent()) return stale();
  return { snapshot, status: "synced" };
}

/** Applies a local, not-yet-synced change to the in-memory snapshot without touching the store. Returns a new snapshot; the caller decides whether/when to persist it. */
export function applyLocalMutation(snapshot: OfflineSnapshot, patch: Partial<OfflineSnapshot["data"]>): OfflineSnapshot {
  return { ...snapshot, data: { ...snapshot.data, ...patch } };
}

/**
 * Decides which local IndexedDB cache key (if any) OfflineDataContext should
 * hydrate under, given the client auth session state. Returns null while the
 * session is still resolving or nobody is signed in — callers must not
 * read/write the snapshot store under a fallback key in that case, or a
 * second account on a shared device could momentarily render the first
 * account's cached data.
 */
export function resolveSessionUserId(userId: string | null | undefined, isPending: boolean): string | null {
  if (isPending || !userId) return null;
  return userId;
}
