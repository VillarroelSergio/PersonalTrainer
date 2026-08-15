"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { createIndexedDbSnapshotStore } from "./indexeddb-store";
import { runAccountScopedRefresh } from "./account-scoped-refresh";
import { accountShellRoutesForSnapshot } from "./account-shell-routes";
import { applyLocalMutation, resolveSessionUserId, type SnapshotStatus } from "./snapshot-client";
import type { OfflineSnapshot, OfflineSnapshotStore } from "./snapshot";

function fetchSnapshot(): Promise<Response> {
  return fetch("/api/v1/offline-snapshot", { credentials: "same-origin" });
}

function postServiceWorkerMessage(message: Record<string, unknown>) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage(message);
      navigator.serviceWorker.controller?.postMessage(message);
    })
    .catch(() => {});
}

function activateAccountShell(userId: string, routes: string[] = []) {
  postServiceWorkerMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId, routes });
}

function precacheAccountShell(snapshot: OfflineSnapshot) {
  activateAccountShell(snapshot.userId, accountShellRoutesForSnapshot(snapshot));
}

function clearAccountShell() {
  postServiceWorkerMessage({ type: "TRAINER_CLEAR_ACCOUNT_SHELL" });
}

function useOfflineDataState() {
  const storeRef = useRef<OfflineSnapshotStore | null>(null);
  const activeUserIdRef = useRef<string | null>(null);
  const refreshEpochRef = useRef(0);
  const [snapshot, setSnapshot] = useState<OfflineSnapshot | null>(null);
  const [status, setStatus] = useState<SnapshotStatus>("needs-initial-sync");
  const session = authClient.useSession();
  const userId = resolveSessionUserId(session.data?.user?.id, session.isPending);
  activeUserIdRef.current = userId;

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
    const refreshEpoch = refreshEpochRef.current;
    await runAccountScopedRefresh({
      store: getStore(),
      fetchFn: fetchSnapshot,
      userId,
      getCurrentUserId: () => activeUserIdRef.current,
      isCurrent: () => refreshEpochRef.current === refreshEpoch,
      commit: (result) => {
        setSnapshot(result.snapshot);
        setStatus(result.status);
      },
      precache: precacheAccountShell
    });
  }, [getStore, userId]);

  /** Clears the local snapshot for the currently signed-in user: called on sign-out and account deletion so a second account on a shared device never hydrates leftover data. */
  const clear = useCallback(async () => {
    refreshEpochRef.current += 1;
    if (userId) await getStore().remove(userId);
    setSnapshot(null);
    setStatus("needs-initial-sync");
    clearAccountShell();
  }, [getStore, userId]);

  useEffect(() => {
    // Reset synchronously on every userId change (including sign-in of a
    // different account on the same device) so the previous account's
    // in-memory snapshot is never rendered, even briefly, under the new
    // session while the real hydration is still in flight. Status starts as
    // "loading" (not the terminal "needs-initial-sync") whenever a user is
    // signed in, so OfflineRouteBoundary shows a neutral placeholder instead
    // of "Conexión inicial necesaria" during the brief hydration window.
    refreshEpochRef.current += 1;
    setSnapshot(null);
    setStatus(userId ? "loading" : "needs-initial-sync");
    if (!userId) {
      clearAccountShell();
      return;
    }
    activateAccountShell(userId);
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
