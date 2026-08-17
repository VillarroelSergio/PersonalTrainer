"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createIndexedDbOutboxStore } from "./indexeddb-store";
import { createAccountScopedOutboxStore, flushOutbox, type OutboxOperation, type OutboxStore } from "./outbox";
import { submitOperation } from "./sync-client";
import { authClient } from "@/lib/auth-client";
import { readRememberedOfflineAccount, resolveSessionUserId } from "./snapshot-client";
import { deriveIdleSyncState } from "./sync-state";

/** Mirrors the prototype's SYNC_LABELS states (App.sync in prototype/js/core.js), minus "· simulado": this is the real state now. */
export type SyncState = "local" | "sincronizando" | "sincronizado" | "conflicto" | "error";

export function useOfflineSync() {
  const storeRef = useRef<OutboxStore | null>(null);
  const [state, setState] = useState<SyncState>("sincronizado");
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState<OutboxOperation[]>([]);
  const session = authClient.useSession();
  // Same remembered-account fallback as OfflineDataContext: with an unreachable session
  // endpoint this used to resolve to null, hiding the account's own queued imports.
  const userId = resolveSessionUserId(session.data?.user?.id, session.isPending, readRememberedOfflineAccount());

  const getStore = useCallback(() => {
    if (!storeRef.current) storeRef.current = createIndexedDbOutboxStore();
    return storeRef.current;
  }, []);

  const getScopedStore = useCallback(() => createAccountScopedOutboxStore(getStore(), userId), [getStore, userId]);

  const refresh = useCallback(async () => {
    const all = await getScopedStore().all();
    const pendingCount = all.filter((operation) => operation.status === "pending").length;
    const conflictOperations = all.filter((operation) => operation.status === "conflict");
    setPending(pendingCount);
    setConflicts(conflictOperations);
    return { pendingCount, conflictCount: conflictOperations.length };
  }, [getScopedStore]);

  // Never pre-checks navigator.onLine before attempting: on iOS it can stay stuck reporting
  // false even after real connectivity returns, and that pre-check silently blocked every
  // retry — the online event, reopening the app — forever, with the outbox stuck showing
  // "sin conexión" no matter how long the connection had actually been back. The real network
  // request is what decides now: it fails fast and harmlessly (network_error → "local") when
  // truly offline, and succeeds the moment the connection genuinely allows it.
  const flush = useCallback(async () => {
    setState("sincronizando");
    const summary = await flushOutbox(getScopedStore(), (operation) => submitOperation(operation, { currentUserId: userId ?? undefined }));
    await refresh();
    if (summary.conflicts.length > 0) setState("conflicto");
    else if (summary.errors.length > 0) setState("error");
    else if (summary.stoppedForNetwork) setState("local");
    else setState("sincronizado");
  }, [getScopedStore, refresh, userId]);

  useEffect(() => {
    void refresh().then(({ pendingCount }) => {
      if (pendingCount > 0) void flush();
    });
    function handleOnline() { flush(); }
    function handleOffline() { setState("local"); }
    // The "online" event is not a reliable recovery signal: on iOS navigator.onLine can
    // stay true through the whole outage, so it never fires and queued work would sit
    // there forever. Reopening the app retries instead — the flush is a no-op when the
    // outbox is empty, and a harmless failed attempt when the network is still down.
    function handleVisible() { if (document.visibilityState === "visible") flush(); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisible);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [flush, refresh]);

  const enqueue = useCallback(async (operation: OutboxOperation) => {
    await getStore().put(operation);
    await refresh();
    flush();
  }, [getStore, refresh, flush]);

  /** "Conservar la versión del servidor": discard the queued local change. */
  const resolveKeepServer = useCallback(async (operationId: string) => {
    await getStore().remove(operationId);
    const { conflictCount } = await refresh();
    setState(deriveIdleSyncState({ conflictCount, online: typeof navigator === "undefined" ? true : navigator.onLine }));
  }, [getStore, refresh]);

  /** "Conservar la versión local": reapply the same decision on top of the version the server actually has now. */
  const resolveKeepLocal = useCallback(async (operationId: string) => {
    const store = getStore();
    const all = await getScopedStore().all();
    const operation = all.find((item) => item.id === operationId);
    if (!operation || operation.kind !== "finish_workout" || operation.conflictVersion === undefined) return;
    await store.put({ ...operation, baseVersion: operation.conflictVersion, status: "pending", conflictVersion: undefined });
    const { conflictCount } = await refresh();
    setState(deriveIdleSyncState({ conflictCount, online: typeof navigator === "undefined" ? true : navigator.onLine }));
    flush();
  }, [getScopedStore, getStore, refresh, flush]);

  return { state, pending, conflicts, enqueue, flush, resolveKeepServer, resolveKeepLocal };
}
