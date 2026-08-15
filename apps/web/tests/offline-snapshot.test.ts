import { describe, expect, it } from "vitest";
import { createMemorySnapshotStore } from "../src/lib/offline/snapshot";

describe("offline snapshot store", () => {
  it("isolates snapshots by account", async () => {
    const store = createMemorySnapshotStore();
    await store.put({ userId: "a", syncedAt: 1, data: { activePlan: { id: "plan-a" } } });
    await store.put({ userId: "b", syncedAt: 2, data: { activePlan: { id: "plan-b" } } });
    expect(await store.get("a")).toMatchObject({ data: { activePlan: { id: "plan-a" } } });
  });

  it("returns undefined for a missing account", async () => {
    const store = createMemorySnapshotStore();
    expect(await store.get("missing")).toBeUndefined();
  });

  it("removes a stored snapshot", async () => {
    const store = createMemorySnapshotStore();
    await store.put({ userId: "a", syncedAt: 1, data: {} });
    await store.remove("a");
    expect(await store.get("a")).toBeUndefined();
  });

  it("put overwrites the previous snapshot for the same account", async () => {
    const store = createMemorySnapshotStore();
    await store.put({ userId: "a", syncedAt: 1, data: { activePlan: { id: "plan-a" } } });
    await store.put({ userId: "a", syncedAt: 2, data: { activePlan: { id: "plan-a-updated" } } });
    expect(await store.get("a")).toMatchObject({ syncedAt: 2, data: { activePlan: { id: "plan-a-updated" } } });
  });
});
