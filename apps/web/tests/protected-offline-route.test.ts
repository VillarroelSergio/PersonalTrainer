import { describe, expect, it } from "vitest";
import { describeProtectedSnapshotRouteAccess } from "@/lib/offline/protected-route-auth";

describe("describeProtectedSnapshotRouteAccess", () => {
  it("keeps rendering from the local snapshot when the session request cannot reach the server", () => {
    // The iOS case: navigator.onLine stays true through the outage, so only the failed
    // session request reveals it. Redirecting here is what emptied the whole app offline.
    expect(describeProtectedSnapshotRouteAccess({
      sessionFailed: true,
      sessionIsPending: false,
      sessionUserId: null,
      snapshotUserId: "account-a"
    })).toEqual({ canRender: true, redirectToLogin: false });
  });

  it("shows nothing rather than bouncing to login when the server is unreachable and no snapshot exists", () => {
    expect(describeProtectedSnapshotRouteAccess({
      sessionFailed: true,
      sessionIsPending: false,
      sessionUserId: null,
      snapshotUserId: null
    })).toEqual({ canRender: false, redirectToLogin: false });
  });

  it("still sends an expired session to login even though a local snapshot exists", () => {
    // A reachable server answering "nobody is signed in" stays authoritative: the local
    // snapshot must not keep an expired session rendering.
    expect(describeProtectedSnapshotRouteAccess({
      sessionFailed: false,
      sessionIsPending: false,
      sessionUserId: null,
      snapshotUserId: "account-a"
    })).toEqual({ canRender: false, redirectToLogin: true });
  });

  it("blocks rendering when the authenticated user and local snapshot belong to different accounts", () => {
    expect(describeProtectedSnapshotRouteAccess({
      sessionFailed: false,
      sessionIsPending: false,
      sessionUserId: "account-b",
      snapshotUserId: "account-a"
    })).toEqual({ canRender: false, redirectToLogin: false });
  });

  it("does not render a snapshot while the session request is still pending", () => {
    expect(describeProtectedSnapshotRouteAccess({
      sessionFailed: false,
      sessionIsPending: true,
      sessionUserId: null,
      snapshotUserId: "account-a"
    })).toEqual({ canRender: false, redirectToLogin: false });
  });
});
