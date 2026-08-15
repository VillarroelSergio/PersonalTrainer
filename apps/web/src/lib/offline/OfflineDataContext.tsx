"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { createIndexedDbSnapshotStore } from "./indexeddb-store";
import { applyLocalMutation, refreshSnapshot, resolveSessionUserId, type SnapshotStatus } from "./snapshot-client";
import type { OfflineSnapshot, OfflineSnapshotStore } from "./snapshot";

function fetchSnapshot(): Promise<Response> {
  return fetch("/api/v1/offline-snapshot", { credentials: "same-origin" });
}

function useOfflineDataState() {
  const storeRef = useRef<OfflineSnapshotStore | null>(null);
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [status, setStatus] = useState<SnapshotStatus>("needs-initial-sync");
  const session = authClient.useSession();
  const userId = resolveSessionUserId(session.data?.user?.id, session.isPending);

  const getStore = useCallback(() => {
    if (!storeRef.current) storeRef.current = createIndexedDbSnapshotStore();
    return storeRef.current;
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSnapshot(null);
      setStatus("needs-initial-sync");
      return;
    }
    const result = await refreshSnapshot(getStore(), fetchSnapshot, userId);
    setSnapshot(result.snapshot);
    setStatus(result.status);
  }, [getStore, userId]);

  /** Clears the local snapshot for the currently signed-in user: called on sign-out and account deletion so a second account on a shared device never hydrates leftover data. */
  const clear = useCallback(async () => {
    if (userId) await getStore().remove(userId);
    setSnapshot(null);
    setStatus("needs-initial-sync");
  }, [getStore, userId]);

  useEffect(() => {
    // Reset synchronously on every userId change (including sign-in of a
    // different account on the same device) so the previous account's
    // in-memory snapshot is never rendered, even briefly, under the new
    // session while the real hydration is still in flight.
    setSnapshot(null);
    setStatus("needs-initial-sync");
    if (!userId) return;
    void refresh();
    function handleOnline() { void refresh(); }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /** Applies a not-yet-synced local change so the UI reflects it immediately; the outbox (use-offline-sync.ts) is what actually reconciles it with the server. */
  const applyLocalMutationToSnapshot = useCallback((patch: Partial<OfflineSnapshot["data"]>) => {
    setSnapshot((current) => (current ? applyLocalMutation(current, patch) : current));
  }, []);

  return { snapshot, status, refresh, applyLocalMutation: applyLocalMutationToSnapshot, clear };
}

type OfflineDataContextValue = ReturnType<typeof useOfflineDataState>;
const OfflineDataContext = createContext<OfflineDataContextValue | null>(null);

export function OfflineDataProvider({ children }: { children: React.ReactNode }) {
  const value = useOfflineDataState();
  return <OfflineDataContext.Provider value={value}>{children}</OfflineDataContext.Provider>;
}

/** { snapshot, status, refresh, applyLocalMutation, clear } — read/refresh the local-first data snapshot. Parallel to useOfflineSyncContext (outbox/sync-state); this context never touches the outbox. */
export function useOfflineData() {
  const context = useContext(OfflineDataContext);
  if (!context) throw new Error("useOfflineData must be used within OfflineDataProvider");
  return context;
}
