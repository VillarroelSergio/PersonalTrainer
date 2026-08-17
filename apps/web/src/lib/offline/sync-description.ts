import type { OutboxOperation } from "./outbox";
import type { SnapshotStatus } from "./snapshot-client";
import type { SyncState } from "./use-offline-sync";

type SyncTone = "ok" | "working" | "offline" | "warning" | "error";

export type SyncConflictDescription = {
  id: string;
  entity: string;
  detail: string;
  keepLocalLabel: string | null;
  keepServerLabel: string;
};

/** A change that failed for a reason that is not a conflict and not a lost connection. It keeps
 * its own list because the person needs an explicit way out — retry it or drop it — instead of
 * an error state nothing can clear. */
export type SyncErrorDescription = {
  id: string;
  entity: string;
  detail: string;
};

export type SyncDescription = {
  title: string;
  body: string;
  ariaLabel: string;
  icon: string;
  tone: SyncTone;
  dotState: SyncTone;
  canRetry: boolean;
  conflicts: SyncConflictDescription[];
  errors: SyncErrorDescription[];
};

export function describeSync(input: { state: SyncState; pending: number; conflicts: OutboxOperation[]; errors?: OutboxOperation[]; snapshotStatus: SnapshotStatus }): SyncDescription {
  const pending = Math.max(0, input.pending);
  const conflicts = input.conflicts.map(describeConflict);
  const errors = (input.errors ?? []).map(describeErrored);
  const isOffline = input.state === "local" || input.snapshotStatus === "offline";

  if (input.snapshotStatus === "needs-initial-sync") {
    return buildDescription({
      title: "Conexión inicial necesaria",
      body: "conéctate una vez para cargar tu plan en este dispositivo. Después podrás consultar y registrar sin cobertura.",
      icon: "○",
      tone: "warning",
      canRetry: false,
      conflicts,
      errors
    });
  }

  if (conflicts.length > 0) {
    const title = conflicts.length === 1 ? `Conflicto en ${conflicts[0].entity.toLowerCase()}` : `${conflicts.length} conflictos de sincronización`;
    return buildDescription({
      title,
      body: "Hay una versión más reciente en el servidor. Tu cambio local sigue guardado hasta que elijas qué conservar.",
      icon: "!",
      tone: "warning",
      canRetry: false,
      conflicts,
      errors
    });
  }

  if (isOffline) {
    const body = pending > 0
      ? `${pending} cambio${pending === 1 ? "" : "s"} guardado${pending === 1 ? "" : "s"} en este dispositivo; se enviarán al recuperar conexión.`
      : "Puedes seguir usando el plan guardado en este dispositivo. Lo nuevo se sincronizará al volver la conexión.";
    return buildDescription({ title: "Sin conexión", body, icon: "○", tone: "offline", canRetry: false, conflicts, errors });
  }

  if (input.state === "sincronizando") {
    const body = pending > 0
      ? `Enviando ${pending} cambio${pending === 1 ? "" : "s"} guardado${pending === 1 ? "" : "s"} en este dispositivo.`
      : "Comprobando que este dispositivo y el servidor estén al día.";
    return buildDescription({ title: "Sincronizando", body, icon: "↻", tone: "working", canRetry: false, conflicts, errors });
  }

  if (input.state === "error" || errors.length > 0) {
    // Says plainly that these changes are *not* on the server. The old copy ("reintenta cuando
    // tengas conexión estable") blamed the connection for changes the server had actively
    // rejected, so waiting for better signal did nothing and the state never cleared.
    const body = errors.length > 0
      ? `${errors.length} cambio${errors.length === 1 ? "" : "s"} no se pudo guardar en el servidor y sigue${errors.length === 1 ? "" : "n"} solo en este dispositivo. Puedes reintentarlo o descartarlo.`
      : pending > 0
        ? `${pending} cambio${pending === 1 ? "" : "s"} sigue${pending === 1 ? "" : "n"} guardado${pending === 1 ? "" : "s"} en este dispositivo. Reintenta cuando tengas conexión estable.`
        : "No se pudo confirmar el último intento. Reintenta cuando tengas conexión estable.";
    return buildDescription({ title: "No se pudo sincronizar", body, icon: "×", tone: "error", canRetry: pending > 0, conflicts, errors });
  }

  if (pending > 0) {
    return buildDescription({
      title: `${pending} cambio${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}`,
      body: `${pending === 1 ? "Está" : "Están"} guardado${pending === 1 ? "" : "s"} en este dispositivo y pendiente${pending === 1 ? "" : "s"} de confirmar en el servidor.`,
      icon: "↻",
      tone: "working",
      canRetry: true,
      conflicts,
      errors
    });
  }

  return buildDescription({
    title: "Sincronizado",
    body: "El plan y los registros de este dispositivo están confirmados en el servidor.",
    icon: "✓",
    tone: "ok",
    canRetry: false,
    conflicts,
    errors
  });
}

function buildDescription(description: Omit<SyncDescription, "ariaLabel" | "dotState"> & { dotState?: SyncTone }): SyncDescription {
  return { ...description, dotState: description.dotState ?? description.tone, ariaLabel: `Estado de sincronización: ${description.title}. ${description.body}` };
}

/** Names the failed change in the person's own terms — "Registro de fuerza", not "record_set" —
 * so the retry/discard choice is about something recognisable. */
function describeErrored(operation: OutboxOperation): SyncErrorDescription {
  const detail = "El servidor rechazó este cambio. Sigue guardado aquí hasta que decidas.";
  if (operation.kind === "record_set" || operation.kind === "remove_set") return { id: operation.id, entity: "Serie registrada", detail };
  if (operation.kind === "finish_workout") return { id: operation.id, entity: "Cierre de sesión", detail };
  if (operation.kind === "start_workout" || operation.kind === "start_recovery_session") return { id: operation.id, entity: "Inicio de sesión", detail };
  if (operation.kind === "substitute_variant") return { id: operation.id, entity: "Cambio de variante", detail };
  if (operation.kind === "submit_checkin") return { id: operation.id, entity: "Check-in", detail };
  if (operation.kind === "plan_session_edit" || operation.kind === "plan_session_content_edit") return { id: operation.id, entity: "Planificación", detail };
  return { id: operation.id, entity: "Cambio local", detail };
}

function describeConflict(operation: OutboxOperation): SyncConflictDescription {
  if (operation.kind === "finish_workout") {
    return {
      id: operation.id,
      entity: "Cierre de sesión",
      detail: "La sesión se cerró en otro dispositivo antes de enviar este cierre.",
      keepLocalLabel: "Conservar mi cierre",
      keepServerLabel: "Conservar el cierre del servidor"
    };
  }

  if (operation.kind === "plan_session_edit" || operation.kind === "plan_session_content_edit") {
    return {
      id: operation.id,
      entity: "Planificación",
      detail: "La sesión planificada cambió en otro dispositivo.",
      keepLocalLabel: null,
      keepServerLabel: "Conservar la planificación del servidor"
    };
  }

  if (operation.kind === "record_set" || operation.kind === "remove_set" || operation.kind === "substitute_variant") {
    return {
      id: operation.id,
      entity: "Registro de fuerza",
      detail: "El registro de fuerza tiene una versión más reciente en el servidor.",
      keepLocalLabel: null,
      keepServerLabel: "Conservar el registro del servidor"
    };
  }

  return {
    id: operation.id,
    entity: "Cambio local",
    detail: "Este cambio local choca con una versión más reciente del servidor.",
    keepLocalLabel: null,
    keepServerLabel: "Descartar el cambio local"
  };
}
