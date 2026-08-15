type ProtectedSnapshotRouteAccessInput = {
  isOnline: boolean;
  sessionIsPending: boolean;
  sessionUserId: string | null | undefined;
  snapshotUserId: string | null | undefined;
};

type ProtectedSnapshotRouteAccess = {
  canRender: boolean;
  redirectToLogin: boolean;
};

/**
 * Auth guard for snapshot-backed protected client routes.
 *
 * Online, the server session remains authoritative. Offline, a previously
 * synced local snapshot is enough to keep the installed app usable, but only
 * for the snapshot already held by OfflineDataContext.
 */
export function describeProtectedSnapshotRouteAccess(input: ProtectedSnapshotRouteAccessInput): ProtectedSnapshotRouteAccess {
  const sessionUserId = input.sessionUserId ?? null;
  const snapshotUserId = input.snapshotUserId ?? null;

  if (!input.isOnline && snapshotUserId) return { canRender: true, redirectToLogin: false };
  if (input.sessionIsPending) return { canRender: false, redirectToLogin: false };
  if (!sessionUserId) return { canRender: false, redirectToLogin: true };
  if (snapshotUserId && snapshotUserId !== sessionUserId) return { canRender: false, redirectToLogin: false };
  return { canRender: true, redirectToLogin: false };
}
