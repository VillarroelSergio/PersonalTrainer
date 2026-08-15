import { describe, expect, it } from "vitest";
import { accountShellRoutesForSnapshot } from "@/lib/offline/account-shell-routes";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";

describe("accountShellRoutesForSnapshot", () => {
  it("derives snapshot-backed action routes with concrete session ids and never includes bare recovery", () => {
    const snapshot: OfflineSnapshot = {
      userId: "user-a",
      syncedAt: 1,
      data: {
        activePlan: {
          contentJson: JSON.stringify({
            week: {
              sessions: [
                { title: "Fuerza", day: "monday", kind: "strength", exercises: [], blocks: [{ id: "warmup" }] },
                { title: "Series", day: "wednesday", kind: "endurance", blocks: [] },
                { title: "Torso", day: "friday", kind: "strength", exercises: [] }
              ]
            }
          })
        }
      }
    };

    expect(accountShellRoutesForSnapshot(snapshot)).toEqual(expect.arrayContaining([
      "/hoy",
      "/plan",
      "/ejercicios",
      "/historial",
      "/checkin",
      "/entrenar?session=0",
      "/entrenar?session=0&addons=1",
      "/recuperar?session=0",
      "/resistencia?session=1",
      "/recuperar?session=1"
    ]));
    expect(accountShellRoutesForSnapshot(snapshot)).not.toContain("/recuperar");
    expect(accountShellRoutesForSnapshot(snapshot)).not.toContain("/entrenar?session=2&addons=1");
  });
});
