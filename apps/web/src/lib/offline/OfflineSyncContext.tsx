"use client";

import { createContext, useContext } from "react";
import { useOfflineSync } from "./use-offline-sync";

// Sync-state pill (outbox flush progress) only. The parallel data snapshot
// (hydrate/refresh/local mutations) lives in OfflineDataContext.tsx — this
// context is unchanged by that addition.

type OfflineSyncContextValue = ReturnType<typeof useOfflineSync>;
const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const value = useOfflineSync();
  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}

export function useOfflineSyncContext() {
  const context = useContext(OfflineSyncContext);
  if (!context) throw new Error("useOfflineSyncContext must be used within OfflineSyncProvider");
  return context;
}
