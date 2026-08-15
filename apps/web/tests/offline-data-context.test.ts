import { describe, expect, it } from "vitest";
import { createMemorySnapshotStore } from "../src/lib/offline/snapshot";
import { applyLocalMutation, refreshSnapshot, resolveSessionUserId } from "../src/lib/offline/snapshot-client";
import type { OfflineSnapshotStore } from "../src/lib/offline/snapshot";

const okResponse = (data: unknown) => async () => new Response(JSON.stringify({ data }), { status: 200 });
const rejectedFetch = async () => {
  throw new Error("network unreachable");
};

function storeWithPlan() {
  return createMemorySnapshotStore([{ userId: "account-a", syncedAt: 1, data: { activePlan: { id: "plan-a" } } }]);
}

describe("refreshSnapshot", () => {
  it("keeps the last snapshot when refresh loses network", async () => {
    const result = await refreshSnapshot(storeWithPlan(), rejectedFetch, "account-a");
    expect(result.status).toBe("offline");
    expect(result.snapshot?.data.activePlan).toMatchObject({ id: "plan-a" });
  });

  it("hydrates from the store before making any network call", async () => {
    const calls: string[] = [];
    const base = storeWithPlan();
    const trackedStore: OfflineSnapshotStore = {
      ...base,
      async get(userId) {
        calls.push("store.get");
        return base.get(userId);
      }
    };
    const fetchFn = async () => {
      calls.push("fetch");
      return new Response(JSON.stringify({ data: { snapshot: { userId: "account-a", syncedAt: 2, data: { activePlan: { id: "plan-a" } } }, serverTime: 2 } }), { status: 200 });
    };
    await refreshSnapshot(trackedStore, fetchFn, "account-a");
    expect(calls).toEqual(["store.get", "fetch"]);
  });

  it("replaces the local snapshot on a valid successful response", async () => {
    const store = storeWithPlan();
    const fetchFn = okResponse({ snapshot: { userId: "account-a", syncedAt: 2, data: { activePlan: { id: "plan-a-updated" } } }, serverTime: 2 });
    const result = await refreshSnapshot(store, fetchFn, "account-a");
    expect(result.status).toBe("synced");
    expect(result.snapshot?.data.activePlan).toMatchObject({ id: "plan-a-updated" });
    // persisted for the next hydration too
    expect((await store.get("account-a"))?.data.activePlan).toMatchObject({ id: "plan-a-updated" });
  });

  it("reports needs-initial-sync when there is neither a cached snapshot nor network", async () => {
    const store = createMemorySnapshotStore();
    const result = await refreshSnapshot(store, rejectedFetch, "account-a");
    expect(result.status).toBe("needs-initial-sync");
    expect(result.snapshot).toBeNull();
  });

  it("never overwrites a cached snapshot with a malformed successful response", async () => {
    const store = storeWithPlan();
    const fetchFn = async () => new Response(JSON.stringify({ nonsense: true }), { status: 200 });
    const result = await refreshSnapshot(store, fetchFn, "account-a");
    expect(result.status).toBe("offline");
    expect(result.snapshot?.data.activePlan).toMatchObject({ id: "plan-a" });
  });
});

describe("applyLocalMutation", () => {
  it("merges a partial data update into the in-memory snapshot without touching the store", () => {
    const snapshot = { userId: "account-a", syncedAt: 1, data: { activePlan: { id: "plan-a" }, checkins: [] } };
    const next = applyLocalMutation(snapshot, { checkins: [{ id: "c1" }] });
    expect(next.data).toMatchObject({ activePlan: { id: "plan-a" }, checkins: [{ id: "c1" }] });
    expect(snapshot.data.checkins).toEqual([]);
  });
});

describe("resolveSessionUserId", () => {
  it("returns null while the session is still resolving, even if a stale userId is passed", () => {
    expect(resolveSessionUserId("account-a", true)).toBeNull();
  });

  it("returns null when nobody is signed in", () => {
    expect(resolveSessionUserId(undefined, false)).toBeNull();
    expect(resolveSessionUserId(null, false)).toBeNull();
  });

  it("returns the signed-in user's id once the session has resolved", () => {
    expect(resolveSessionUserId("account-a", false)).toBe("account-a");
  });

  it("re-keys to a different account when a new session resolves on the same device", () => {
    const first = resolveSessionUserId("account-a", false);
    const second = resolveSessionUserId("account-b", false);
    expect(first).not.toBe(second);
    expect(second).toBe("account-b");
  });
});
