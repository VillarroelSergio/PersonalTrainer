import { describe, expect, it } from "vitest";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { toggleFavoriteOffline } from "@/features/catalog/domain/favorites-offline";

function createId() {
  let n = 0;
  return () => String(++n);
}

function emptySnapshot(favoriteVariantIds: string[] = []): OfflineSnapshot {
  return {
    userId: "user-1",
    syncedAt: 1,
    data: {
      favoriteVariantIds
    }
  };
}

describe("favorites offline helpers", () => {
  it("persists an offline favorite change", () => {
    const snapshot = emptySnapshot();
    const next = toggleFavoriteOffline(snapshot, "variant-a", createId());
    expect(next.snapshot.data.favoriteVariantIds).toContain("variant-a");
    expect(next.operation.kind).toBe("set_favorite");
  });

  it("removes an offline favorite when it was already favorited", () => {
    const snapshot = emptySnapshot(["variant-a"]);
    const next = toggleFavoriteOffline(snapshot, "variant-a", createId());
    expect(next.snapshot.data.favoriteVariantIds).not.toContain("variant-a");
    expect(next.operation.kind).toBe("unset_favorite");
  });

  it("toggling an already-favorited variant unfavorites it, not double-favorites it", () => {
    const snapshot = emptySnapshot(["variant-a", "variant-b"]);
    const next = toggleFavoriteOffline(snapshot, "variant-a", createId());
    expect(next.snapshot.data.favoriteVariantIds).toEqual(["variant-b"]);
  });
});
