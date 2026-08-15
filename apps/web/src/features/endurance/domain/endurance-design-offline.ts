/**
 * Pure local-first helpers for EnduranceDesigner (Fase 5, Task 6 follow-up). No React, no fetch.
 * Mirrors `design-repository.ts`'s `runSaveDesign`/`onConflictDoUpdate`: same (planId,
 * isoWeekStart, sessionIndex) upserts in place and resets `watchPreparedAt` — "editing an existing
 * design starts a fresh watch-prep confirmation" holds locally too.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { applyLocalMutation } from "@/lib/offline/snapshot-client";
import { createClientId } from "@/lib/client-id";
import type { OutboxOperation } from "@/lib/offline/outbox";
import type { EnduranceDesignInput } from "@/contracts/endurance";
import type { EnduranceDesignRow } from "./resistencia-view";

export type CreateId = () => string;

type ActivePlanRow = { id: string };

export function saveEnduranceDesignOffline(
  snapshot: OfflineSnapshot,
  input: EnduranceDesignInput,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation; row: EnduranceDesignRow } {
  const activePlan = snapshot.data.activePlan as ActivePlanRow;
  const designs = (snapshot.data.enduranceDesigns as EnduranceDesignRow[] | undefined) ?? [];
  const existing = designs.find(
    (row) => row.planId === activePlan.id && row.isoWeekStart === input.isoWeekStart && row.sessionIndex === input.sessionIndex
  );

  const row: EnduranceDesignRow = {
    id: existing?.id ?? createId(),
    ownerId: snapshot.userId,
    planId: activePlan.id,
    isoWeekStart: input.isoWeekStart,
    sessionIndex: input.sessionIndex,
    objective: input.objective,
    environment: input.environment ?? null,
    optionalLayersJson: input.optionalLayers ? JSON.stringify(input.optionalLayers) : null,
    watchPreparedAt: null,
    createdAt: existing?.createdAt ?? new Date().toISOString()
  };

  const nextDesigns = existing ? designs.map((current) => (current === existing ? row : current)) : [...designs, row];
  const nextSnapshot = applyLocalMutation(snapshot, { enduranceDesigns: nextDesigns });
  const operation: OutboxOperation = { id: createId(), kind: "save_endurance_design", payload: input, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation, row };
}
