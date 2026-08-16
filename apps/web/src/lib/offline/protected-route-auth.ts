type ProtectedSnapshotRouteAccessInput = {
  /**
   * The session request failed to reach the server — pass `session.error != null`.
   * better-auth answers "nobody is signed in" with a 200 and a null body, so `error`
   * is set only by transport failures and 5xx. Deliberately not derived from
   * navigator.onLine: iOS keeps reporting onLine === true through an outage, and
   * trusting it is what redirected the whole app to /login as soon as the network dropped.
   */
  sessionFailed: boolean;
  sessionIsPending: boolean;
  sessionUserId: string | null | undefined;
  snapshotUserId: string | null | undefined;
};

type ProtectedSnapshotRouteAccess = {
  canRender: boolean;
  redirectToLogin: boolean;
};

/**
 * Single auth gate for every snapshot-backed protected client route. Each route must
 * route its decision through here — the same decision duplicated per page is what left
 * seven routes still redirecting to /login offline after the shared one was fixed.
 *
 * With a reachable server the session stays authoritative, expiry included. With an
 * unreachable one a previously synced local snapshot keeps the installed app usable.
 */
export function describeProtectedSnapshotRouteAccess(input: ProtectedSnapshotRouteAccessInput): ProtectedSnapshotRouteAccess {
  const sessionUserId = input.sessionUserId ?? null;
  const snapshotUserId = input.snapshotUserId ?? null;

  // An unreachable server is not a sign-out. The local snapshot exists only while the
  // account is signed in on this device — OfflineDataContext.clear() removes it on
  // sign-out and on account deletion — so its presence is what authorises the render,
  // and an expired session still reaches the redirect below once the server answers.
  if (input.sessionFailed) return { canRender: Boolean(snapshotUserId), redirectToLogin: false };
  if (input.sessionIsPending) return { canRender: false, redirectToLogin: false };
  if (!sessionUserId) return { canRender: false, redirectToLogin: true };
  if (snapshotUserId && snapshotUserId !== sessionUserId) return { canRender: false, redirectToLogin: false };
  return { canRender: true, redirectToLogin: false };
}
