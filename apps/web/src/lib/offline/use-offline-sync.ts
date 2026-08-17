"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createIndexedDbOutboxStore } from "./indexeddb-store";
import { createAccountScopedOutboxStore, flushOutbox, type OutboxOperation, type OutboxStore } from "./outbox";
import { submitOperation } from "./sync-client";
import { authClient } from "@/lib/auth-client";
import { readRememberedOfflineAccount, resolveSessionUserId } from "./snapshot-client";
import { deriveIdleSyncState } from "./sync-state";
import { useOfflineData } from "./OfflineDataContext";

/** Mirrors the prototype's SYNC_LABELS states (App.sync in prototype/js/core.js), minus "· simulado": this is the real state now. */
export type SyncState = "local" | "sincronizando" | "sincronizado" | "conflicto" | "error";

export function useOfflineSync() {
  const storeRef = useRef<OutboxStore | null>(null);
  const [state, setState] = useState<SyncState>("sincronizado");
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState<OutboxOperation[]>([]);
  const [errors, setErrors] = useState<OutboxOperation[]>([]);
  const session = authClient.useSession();
  // Only the stable refresh callback, never the whole context object: that object is a new
  // literal on every OfflineDataProvider render, and depending on it would rebuild flush()
  // each render, re-running the mount effect (and its outbox read) every time. It is also
  // what would turn a provider reorder into an actual render loop.
  const { refresh: refreshSnapshot } = useOfflineData();
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
    const errorOperations = all.filter((operation) => operation.status === "error");
    setPending(pendingCount);
    setConflicts(conflictOperations);
    setErrors(errorOperations);
    return { pendingCount, conflictCount: conflictOperations.length, errorCount: errorOperations.length };
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
    // Pulls the server's merged copy only now that the outbox has finished pushing:
    // doing this on its own "online" listener (as OfflineDataContext used to) raced this
    // flush, and could overwrite a just-recorded set with a server snapshot that hadn't
    // seen it yet, with nothing left to bring the set back afterwards.
    if (!summary.stoppedForNetwork) await refreshSnapshot();
    if (summary.conflicts.length > 0) setState("conflicto");
    else if (summary.errors.length > 0) setState("error");
    else if (summary.stoppedForNetwork) setState("local");
    else setState("sincronizado");
  }, [getScopedStore, refreshSnapshot, refresh, userId]);

  useEffect(() => {
    void refresh().then(({ pendingCount, errorCount }) => {
      if (pendingCount > 0) void flush();
      // A failed operation parks in `error`, which flushOutbox skips and a reload preserves.
      // Without this the pill came back up saying "Sincronizado" over a change that had never
      // reached the server — the person was told their set was confirmed when it was not.
      else if (errorCount > 0) setState("error");
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

  /**
   * "Reintentar": puts every failed operation back in the queue and flushes.
   *
   * Without it a `rejected` submission was a dead end — flushOutbox only ever looks at
   * `pending` operations, and nothing in the UI could move one out of `error`, so a recorded
   * set that hit a transient server rejection stayed on the device forever with no way out.
   */
  const retryErrored = useCallback(async () => {
    const store = getStore();
    const all = await getScopedStore().all();
    await Promise.all(all.filter((operation) => operation.status === "error").map((operation) => store.put({ ...operation, status: "pending" })));
    await refresh();
    await flush();
  }, [getScopedStore, getStore, refresh, flush]);

  /** "Descartar": drops a change that cannot be sent, so the queue stops reporting an error the
   * person can do nothing about. Deliberately explicit — nothing is ever discarded on its own. */
  const discardErrored = useCallback(async (operationId: string) => {
    await getStore().remove(operationId);
    const { conflictCount, errorCount } = await refresh();
    setState(deriveIdleSyncState({ conflictCount, errorCount, online: typeof navigator === "undefined" ? true : navigator.onLine }));
  }, [getStore, refresh]);

  /** "Conservar la versión del servidor": discard the queued local change. */
  const resolveKeepServer = useCallback(async (operationId: string) => {
    await getStore().remove(operationId);
    const { conflictCount, errorCount } = await refresh();
    setState(deriveIdleSyncState({ conflictCount, errorCount, online: typeof navigator === "undefined" ? true : navigator.onLine }));
  }, [getStore, refresh]);

  /** "Conservar la versión local": reapply the same decision on top of the version the server actually has now. */
  const resolveKeepLocal = useCallback(async (operationId: string) => {
    const store = getStore();
    const all = await getScopedStore().all();
    const operation = all.find((item) => item.id === operationId);
    if (!operation || operation.kind !== "finish_workout" || operation.conflictVersion === undefined) return;
    await store.put({ ...operation, baseVersion: operation.conflictVersion, status: "pending", conflictVersion: undefined });
    const { conflictCount, errorCount } = await refresh();
    setState(deriveIdleSyncState({ conflictCount, errorCount, online: typeof navigator === "undefined" ? true : navigator.onLine }));
    flush();
  }, [getScopedStore, getStore, refresh, flush]);

  return { state, pending, conflicts, errors, enqueue, flush, retryErrored, discardErrored, resolveKeepServer, resolveKeepLocal };
}
