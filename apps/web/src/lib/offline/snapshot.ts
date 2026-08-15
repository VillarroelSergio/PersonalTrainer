/**
 * Per-account offline snapshot of server data (Fase 5 local-first).
 * Storage-agnostic like outbox.ts: `OfflineSnapshotStore` is implemented by
 * IndexedDB in the browser (indexeddb-store.ts) and by an in-memory Map in
 * tests, so callers can rely on the interface without touching a DOM.
 */

export type OfflineSnapshot = {
  userId: string;
  syncedAt: number;
  data: Record<string, unknown>;
};

export interface OfflineSnapshotStore {
  get(userId: string): Promise<OfflineSnapshot | undefined>;
  put(snapshot: OfflineSnapshot): Promise<void>;
  remove(userId: string): Promise<void>;
}

export function createMemorySnapshotStore(initial: OfflineSnapshot[] = []): OfflineSnapshotStore {
  const snapshots = new Map(initial.map((snapshot) => [snapshot.userId, snapshot]));
  return {
    async get(userId) {
      return snapshots.get(userId);
    },
    async put(snapshot) {
      snapshots.set(snapshot.userId, snapshot);
    },
    async remove(userId) {
      snapshots.delete(userId);
    }
  };
}
