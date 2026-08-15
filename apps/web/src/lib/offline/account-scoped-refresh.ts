import { refreshSnapshot, type FetchSnapshot, type RefreshResult } from "./snapshot-client";
import type { OfflineSnapshot, OfflineSnapshotStore } from "./snapshot";

export type AccountScopedRefreshInput = {
  store: OfflineSnapshotStore;
  fetchFn: FetchSnapshot;
  userId: string;
  getCurrentUserId: () => string | null;
  isCurrent?: () => boolean;
  commit: (result: RefreshResult) => void;
  precache: (snapshot: OfflineSnapshot) => void;
};

export async function runAccountScopedRefresh(input: AccountScopedRefreshInput): Promise<boolean> {
  const isStillCurrent = () => input.getCurrentUserId() === input.userId && (input.isCurrent?.() ?? true);
  const result = await refreshSnapshot(input.store, input.fetchFn, input.userId, { shouldAccept: isStillCurrent });
  if (!isStillCurrent() || result.stale) return false;
  input.commit(result);
  if (result.snapshot) input.precache(result.snapshot);
  return true;
}
