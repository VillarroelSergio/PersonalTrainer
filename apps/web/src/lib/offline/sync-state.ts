import type { SyncState } from "./use-offline-sync";

export function deriveIdleSyncState(input: { conflictCount: number; online: boolean }): SyncState {
  if (input.conflictCount > 0) return "conflicto";
  return input.online ? "sincronizado" : "local";
}
