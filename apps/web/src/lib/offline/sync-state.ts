import type { SyncState } from "./use-offline-sync";

/** `errorCount` outranks everything but a conflict: an operation parked in `error` is invisible
 * to flushOutbox and survives reloads, so reporting "sincronizado" over one told the person a
 * change was confirmed on the server when it had never been sent. */
export function deriveIdleSyncState(input: { conflictCount: number; online: boolean; errorCount?: number }): SyncState {
  if (input.conflictCount > 0) return "conflicto";
  if ((input.errorCount ?? 0) > 0) return "error";
  return input.online ? "sincronizado" : "local";
}
