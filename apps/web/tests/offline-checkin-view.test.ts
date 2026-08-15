import { describe, expect, it } from "vitest";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { computeCheckinView } from "@/features/training-engine/domain/checkin-view";

describe("computeCheckinView", () => {
  it("resolves the active plan from the local snapshot for /checkin", () => {
    const snapshot: OfflineSnapshot = {
      userId: "user-1",
      syncedAt: 1,
      data: { activePlan: { id: "plan-a", contentJson: "{}" } }
    };

    expect(computeCheckinView(snapshot)).toEqual({ activePlan: { id: "plan-a", contentJson: "{}" } });
  });

  it("signals onboarding redirect when no active plan is in the snapshot", () => {
    const snapshot: OfflineSnapshot = { userId: "user-1", syncedAt: 1, data: { activePlan: null } };

    expect(computeCheckinView(snapshot)).toEqual({ redirect: "/onboarding" });
  });
});
