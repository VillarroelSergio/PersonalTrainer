import { describe, expect, it } from "vitest";
import { createShareLinkOffline, revokeShareLinkOffline } from "@/features/planning/domain/share-link-offline";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";

function createId() {
  let n = 0;
  return () => `id-${++n}`;
}

function baseSnapshot(overrides: Partial<OfflineSnapshot["data"]> = {}): OfflineSnapshot {
  return {
    userId: "owner-1",
    syncedAt: Date.now(),
    data: {
      shareLinks: [],
      ...overrides
    }
  };
}

describe("createShareLinkOffline", () => {
  it("prepends a new, unrevoked link with a locally-generated id", () => {
    const result = createShareLinkOffline(baseSnapshot(), "plan-1", createId());
    const links = result.snapshot.data.shareLinks as Array<{ id: string; planId: string; revokedAt: string | null }>;
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ planId: "plan-1", revokedAt: null });
    expect(result.row.id).toBe(links[0].id);
    expect(result.operation).toMatchObject({ kind: "create_share_link", planId: "plan-1" });
  });

  it("keeps existing links, newest first", () => {
    const first = createShareLinkOffline(baseSnapshot(), "plan-1", createId());
    const second = createShareLinkOffline(first.snapshot, "plan-1", createId());
    const links = second.snapshot.data.shareLinks as Array<{ id: string }>;
    expect(links).toHaveLength(2);
    expect(links[0].id).toBe(second.row.id);
  });
});

describe("revokeShareLinkOffline", () => {
  it("marks the matching link as revoked without touching others", () => {
    const ids = createId();
    const first = createShareLinkOffline(baseSnapshot(), "plan-1", ids);
    const second = createShareLinkOffline(first.snapshot, "plan-1", ids);
    const revoked = revokeShareLinkOffline(second.snapshot, second.row.id, ids);
    const links = revoked.snapshot.data.shareLinks as Array<{ id: string; revokedAt: string | null }>;
    expect(links.find((link) => link.id === second.row.id)?.revokedAt).not.toBeNull();
    expect(links.find((link) => link.id === first.row.id)?.revokedAt).toBeNull();
    expect(revoked.operation).toMatchObject({ kind: "revoke_share_link", linkId: second.row.id });
  });
});
