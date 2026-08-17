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
    expect(description.dotState).toBe("warning");
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

  it("does not keep showing conflict after the conflict list has been resolved server-side", () => {
    const description = describeSync({ state: "conflicto", pending: 0, conflicts: [], snapshotStatus: "synced" });

    expect(description.title).toBe("Sincronizado");
    expect(description.conflicts).toEqual([]);
    expect(description.dotState).toBe("ok");
  });

  it("offers a way out of a rejected change instead of blaming the connection", () => {
    // Two record_set operations sat in `error` on a real device for hours: flushOutbox skips
    // them, no button could revive them, and the pill said "Reintenta cuando tengas conexión
    // estable" — advice that could never work, because the server had rejected them.
    const failed = [
      { id: "op-1", kind: "record_set" as const, workoutSessionId: "ws-1", createdAt: 1, status: "error" as const, payload: { sessionExerciseId: "se-1", setNumber: 1, loadKg: 40, repetitions: 10, difficulty: null } }
    ];
    const description = describeSync({ state: "error", pending: 0, conflicts: [], errors: failed, snapshotStatus: "synced" });

    expect(description.errors).toEqual([{ id: "op-1", entity: "Serie registrada", detail: expect.any(String) }]);
    expect(description.body).toContain("no se pudo guardar en el servidor");
    expect(description.body).not.toContain("conexión estable");
  });

  it("surfaces a rejected change even when the raw state came back synchronized", () => {
    const failed = [
      { id: "op-2", kind: "finish_workout" as const, workoutSessionId: "ws-1", baseVersion: 0, createdAt: 1, status: "error" as const, payload: { status: "completed" as const, globalEffort: 7, comment: null, discomfort: null } }
    ];
    const description = describeSync({ state: "sincronizado", pending: 0, conflicts: [], errors: failed, snapshotStatus: "synced" });

    expect(description.title).toBe("No se pudo sincronizar");
    expect(description.errors[0].entity).toBe("Cierre de sesión");
  });

  it("uses a non-green dot for initial sync even if the raw sync state still says synchronized", () => {
    const description = describeSync({ state: "sincronizado", pending: 0, conflicts: [], snapshotStatus: "needs-initial-sync" });

    expect(description.icon).toBe("○");
    expect(description.tone).toBe("warning");
    expect(description.dotState).not.toBe("ok");
  });
});
