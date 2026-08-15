import { describe, expect, it } from "vitest";
import { describeProtectedSnapshotRouteAccess } from "@/lib/offline/protected-route-auth";

describe("describeProtectedSnapshotRouteAccess", () => {
  it("allows a protected snapshot-backed route to render during an offline reload when local snapshot data exists", () => {
    expect(describeProtectedSnapshotRouteAccess({
      isOnline: false,
      sessionIsPending: false,
      sessionUserId: null,
      snapshotUserId: "account-a"
    })).toEqual({ canRender: true, redirectToLogin: false });
  });

  it("does not skip authentication online just because a local snapshot exists", () => {
    expect(describeProtectedSnapshotRouteAccess({
      isOnline: true,
      sessionIsPending: false,
      sessionUserId: null,
      snapshotUserId: "account-a"
    })).toEqual({ canRender: false, redirectToLogin: true });
  });

  it("blocks rendering when the authenticated user and local snapshot belong to different accounts", () => {
    expect(describeProtectedSnapshotRouteAccess({
      isOnline: true,
      sessionIsPending: false,
      sessionUserId: "account-b",
      snapshotUserId: "account-a"
    })).toEqual({ canRender: false, redirectToLogin: false });
  });
});
