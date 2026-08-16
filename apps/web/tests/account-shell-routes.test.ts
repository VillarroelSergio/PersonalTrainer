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

  it("includes every snapshot-backed route the app links to, including per-id history detail", () => {
    const snapshot: OfflineSnapshot = {
      userId: "user-a",
      syncedAt: 1,
      data: {
        activePlan: null,
        history: { workoutSessions: [{ id: "ws-1" }, { id: "ws-2" }, { id: "" }, {}] },
        enduranceActivities: [{ id: "ea-1" }]
      }
    };

    const routes = accountShellRoutesForSnapshot(snapshot);

    expect(routes).toEqual(expect.arrayContaining(["/perfil", "/compartir", "/historial/ws-1", "/historial/ws-2", "/historial/ea-1"]));
    // Server-rendered routes read the database per request and cannot render offline.
    expect(routes).not.toContain("/movilidad");
    expect(routes).not.toContain("/importar");
    expect(routes.some((route) => route === "/historial/" || route === "/historial/undefined")).toBe(false);
  });
});
