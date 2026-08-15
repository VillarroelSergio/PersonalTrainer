import { describe, expect, it } from "vitest";
import { describeSync } from "@/lib/offline/sync-description";
import type { OutboxOperation } from "@/lib/offline/outbox";

function finishConflict(overrides: Partial<OutboxOperation> = {}): OutboxOperation {
  return {
    id: "finish-1",
    kind: "finish_workout",
    workoutSessionId: "workout-1",
    baseVersion: 2,
    conflictVersion: 3,
    payload: { status: "completed", globalEffort: 7, comment: null, discomfort: null },
    createdAt: 1,
    status: "conflict",
    ...overrides
  } as OutboxOperation;
}

describe("describeSync", () => {
  it("reports the first-sync blocker before generic sync labels", () => {
    const description = describeSync({ state: "sincronizado", pending: 0, conflicts: [], snapshotStatus: "needs-initial-sync" });

    expect(description.title).toBe("Conexión inicial necesaria");
    expect(description.body).toContain("conéctate una vez");
    expect(description.ariaLabel).toContain("Conexión inicial necesaria");
  });

  it("combines offline and pending state without implying data was lost", () => {
    const description = describeSync({ state: "local", pending: 2, conflicts: [], snapshotStatus: "offline" });

    expect(description.title).toBe("Sin conexión");
    expect(description.body).toContain("2 cambios guardados en este dispositivo");
    expect(description.body).toContain("se enviarán al recuperar conexión");
    expect(description.canRetry).toBe(false);
  });

  it("marks pending online work as retryable and user-visible", () => {
    const description = describeSync({ state: "sincronizado", pending: 1, conflicts: [], snapshotStatus: "synced" });

    expect(description.title).toBe("1 cambio pendiente");
    expect(description.body).toContain("guardado en este dispositivo");
    expect(description.canRetry).toBe(true);
  });

  it("describes workout close conflicts with entity-specific controls", () => {
    const description = describeSync({ state: "conflicto", pending: 0, conflicts: [finishConflict()], snapshotStatus: "synced" });

    expect(description.title).toBe("Conflicto en cierre de sesión");
    expect(description.conflicts).toEqual([
      expect.objectContaining({
        id: "finish-1",
        entity: "Cierre de sesión",
        keepLocalLabel: "Conservar mi cierre",
        keepServerLabel: "Conservar el cierre del servidor"
      })
    ]);
  });
});
