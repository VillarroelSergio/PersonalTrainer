import { describe, expect, it } from "vitest";
import { saveEnduranceDesignOffline } from "@/features/endurance/domain/endurance-design-offline";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";

function createId() {
  let n = 0;
  return () => String(++n);
}

function baseSnapshot(overrides: Partial<OfflineSnapshot["data"]> = {}): OfflineSnapshot {
  return {
    userId: "owner-1",
    syncedAt: Date.now(),
    data: {
      activePlan: { id: "plan-1" },
      enduranceDesigns: [],
      ...overrides
    }
  };
}

describe("saveEnduranceDesignOffline", () => {
  it("inserts a new design row when none exists for this plan/week/session", () => {
    const result = saveEnduranceDesignOffline(
      baseSnapshot(),
      { isoWeekStart: "2026-08-17", sessionIndex: 0, objective: "base", environment: "outdoors", optionalLayers: { duracionMin: "30" } },
      createId()
    );
    const designs = result.snapshot.data.enduranceDesigns as unknown[];
    expect(designs).toHaveLength(1);
    expect(result.row).toMatchObject({ ownerId: "owner-1", planId: "plan-1", isoWeekStart: "2026-08-17", sessionIndex: 0, objective: "base", environment: "outdoors" });
    expect(result.operation).toMatchObject({ kind: "save_endurance_design", payload: { objective: "base" } });
  });

  it("upserts (never duplicates) an existing row for the same plan/week/session, keeping its id", () => {
    const first = saveEnduranceDesignOffline(baseSnapshot(), { isoWeekStart: "2026-08-17", sessionIndex: 0, objective: "base", optionalLayers: {} }, createId());
    const second = saveEnduranceDesignOffline(first.snapshot, { isoWeekStart: "2026-08-17", sessionIndex: 0, objective: "intervals", optionalLayers: {} }, createId());
    const designs = second.snapshot.data.enduranceDesigns as Array<{ id: string; objective: string }>;
    expect(designs).toHaveLength(1);
    expect(designs[0]).toMatchObject({ id: first.row.id, objective: "intervals" });
  });

  it("resets watchPreparedAt to null when editing an existing design", () => {
    const first = saveEnduranceDesignOffline(baseSnapshot(), { isoWeekStart: "2026-08-17", sessionIndex: 0, objective: "base", optionalLayers: {} }, createId());
    const withWatchPrep = { ...first.snapshot, data: { ...first.snapshot.data, enduranceDesigns: [{ ...first.row, watchPreparedAt: "2026-08-18T00:00:00.000Z" }] } };
    const edited = saveEnduranceDesignOffline(withWatchPrep, { isoWeekStart: "2026-08-17", sessionIndex: 0, objective: "recovery", optionalLayers: {} }, createId());
    expect(edited.row.watchPreparedAt).toBeNull();
  });

  it("keeps a design for a different session index as a separate row", () => {
    const first = saveEnduranceDesignOffline(baseSnapshot(), { isoWeekStart: "2026-08-17", sessionIndex: 0, objective: "base", optionalLayers: {} }, createId());
    const second = saveEnduranceDesignOffline(first.snapshot, { isoWeekStart: "2026-08-17", sessionIndex: 1, objective: "sprints", optionalLayers: {} }, createId());
    expect(second.snapshot.data.enduranceDesigns).toHaveLength(2);
  });
});
