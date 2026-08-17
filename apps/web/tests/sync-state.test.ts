import { describe, expect, it } from "vitest";
import { deriveIdleSyncState } from "@/lib/offline/sync-state";

describe("deriveIdleSyncState", () => {
  it("returns synchronized after the last conflict has been removed while online", () => {
    expect(deriveIdleSyncState({ conflictCount: 0, online: true })).toBe("sincronizado");
  });

  it("keeps conflict while unresolved conflicts remain", () => {
    expect(deriveIdleSyncState({ conflictCount: 1, online: true })).toBe("conflicto");
  });

  it("returns local when conflict resolution completes offline", () => {
    expect(deriveIdleSyncState({ conflictCount: 0, online: false })).toBe("local");
  });

  it("never reports synchronized while a rejected change is still parked on the device", () => {
    // flushOutbox skips non-pending operations and a reload preserves them, so "sincronizado"
    // over an errored operation told the person their change was confirmed on the server.
    expect(deriveIdleSyncState({ conflictCount: 0, online: true, errorCount: 1 })).toBe("error");
  });

  it("still puts an unresolved conflict ahead of a rejected change", () => {
    expect(deriveIdleSyncState({ conflictCount: 1, online: true, errorCount: 1 })).toBe("conflicto");
  });
});
