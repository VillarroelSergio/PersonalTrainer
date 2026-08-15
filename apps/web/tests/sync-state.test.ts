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
});
