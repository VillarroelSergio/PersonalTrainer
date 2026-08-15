"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createIndexedDbOutboxStore } from "./indexeddb-store";
import { createAccountScopedOutboxStore, flushOutbox, type OutboxOperation, type OutboxStore } from "./outbox";
import { submitOperation } from "./sync-client";
import { authClient } from "@/lib/auth-client";
import { resolveSessionUserId } from "./snapshot-client";

/** Mirrors the prototype's SYNC_LABELS states (App.sync in prototype/js/core.js), minus "· simulado": this is the real state now. */
export type SyncState = "local" | "sincronizando" | "sincronizado" | "conflicto" | "error";

export function useOfflineSync() {
  const storeRef = useRef<OutboxStore | null>(null);
  const [state, setState] = useState<SyncState>("sincronizado");
  const [pending, setPending] = useState(0);
  const [conflicts, setConflicts] = useState<OutboxOperation[]>([]);
  const session = authClient.useSession();
  const userId = resolveSessionUserId(session.data?.user?.id, session.isPending);

  const getStore = useCallback(() => {
    if (!storeRef.current) storeRef.current = createIndexedDbOutboxStore();
    return storeRef.current;
  }, []);

  const getScopedStore = useCallback(() => createAccountScopedOutboxStore(getStore(), userId), [getStore, userId]);

  const refresh = useCallback(async () => {
    const all = await getScopedStore().all();
    const pendingCount = all.filter((operation) => operation.status === "pending").length;
    setPending(pendingCount);
    setConflicts(all.filter((operation) => operation.status === "conflict"));
    return pendingCount;
  }, [getScopedStore]);

  const flush = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState("local");
      return;
    }
    setState("sincronizando");
    const summary = await flushOutbox(getScopedStore(), (operation) => submitOperation(operation, { currentUserId: userId ?? undefined }));
    await refresh();
    if (summary.conflicts.length > 0) setState("conflicto");
    else if (summary.errors.length > 0) setState("error");
    else if (summary.stoppedForNetwork) setState("local");
    else setState("sincronizado");
  }, [getScopedStore, refresh, userId]);

  useEffect(() => {
    void refresh().then((pendingCount) => {
      if (pendingCount > 0) void flush();
    });
    function handleOnline() { flush(); }
    function handleOffline() { setState("local"); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
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
    await refresh();
  }, [getStore, refresh]);

  /** "Conservar la versión local": reapply the same decision on top of the version the server actually has now. */
  const resolveKeepLocal = useCallback(async (operationId: string) => {
    const store = getStore();
    const all = await getScopedStore().all();
    const operation = all.find((item) => item.id === operationId);
    if (!operation || operation.kind !== "finish_workout" || operation.conflictVersion === undefined) return;
    await store.put({ ...operation, baseVersion: operation.conflictVersion, status: "pending", conflictVersion: undefined });
    await refresh();
    flush();
  }, [getScopedStore, getStore, refresh, flush]);

  return { state, pending, conflicts, enqueue, flush, resolveKeepServer, resolveKeepLocal };
}
