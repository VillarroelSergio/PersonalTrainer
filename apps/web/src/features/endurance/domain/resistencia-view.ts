/**
 * Pure, snapshot-driven view model for "/resistencia" (Fase 5, Task 6 follow-up). No React, no
 * fetch: mirrors what the former server component derived from `session`/`db` — the resolved
 * endurance session (from `?session=` or today), its saved design, and the weekly load-clash
 * notice (reuses the already-pure `weeklyLoadWarning`, never reimplemented). Pure functions can't
 * call `redirect()`, so an invalid explicit `?session=` is reported as `{ redirect: "/hoy" }` and
 * "nothing planned today" as `{ empty: true }`, mirroring entrenar-view.ts's shape.
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { weeklyLoadWarning } from "@/features/planning/domain/plan-week";
import { isoWeekStart, todayWeekday } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";
import type { EnduranceEnvironment, EnduranceObjective } from "@/contracts/endurance";

type ActivePlanRow = { id: string; name: string; contentJson: string };
type PlannedSession = PlanProposal["week"]["sessions"][number];

export type EnduranceDesignRow = {
  id: string;
  ownerId: string;
  planId: string;
  isoWeekStart: string;
  sessionIndex: number;
  objective: string;
  environment: string | null;
  optionalLayersJson: string | null;
  watchPreparedAt: string | Date | null;
  createdAt: string | Date;
};

export type DesignState = {
  id: string;
  objective: EnduranceObjective;
  environment: EnduranceEnvironment | null;
  optionalLayers: Record<string, string>;
  watchPreparedAt: string | null;
};

export type ResistenciaView =
  | { redirect: "/hoy"; empty?: undefined }
  | { redirect?: undefined; empty: true }
  | {
      redirect?: undefined;
      empty?: undefined;
      activePlan: ActivePlanRow;
      sessionIndex: number;
      plannedSession: PlannedSession;
      weekStart: string;
      conflictText: string | null;
      initialDesign: DesignState | null;
    };

/** Computes the full `/resistencia` view model from a snapshot whose `activePlan` is known to be
 * non-null — callers redirect to `/onboarding` before calling this, same convention as `/hoy`. */
export function computeResistenciaView(snapshot: OfflineSnapshot, sessionParam: string | undefined): ResistenciaView {
  const activePlan = snapshot.data.activePlan as ActivePlanRow;
  const content = JSON.parse(activePlan.contentJson) as PlanProposal;
  const sessions = content.week?.sessions ?? [];

  const sessionIndex = sessionParam !== undefined ? Number(sessionParam) : sessions.findIndex((entry) => entry.day === todayWeekday());
  const plannedSession = sessionIndex >= 0 ? sessions[sessionIndex] : undefined;

  if (!plannedSession || plannedSession.kind !== "endurance") {
    if (sessionParam !== undefined) return { redirect: "/hoy" };
    return { empty: true };
  }

  const weekStart = isoWeekStart();
  const designs = (snapshot.data.enduranceDesigns as EnduranceDesignRow[] | undefined) ?? [];
  const designRow = designs.find((row) => row.planId === activePlan.id && row.isoWeekStart === weekStart && row.sessionIndex === sessionIndex) ?? null;
  const initialDesign: DesignState | null = designRow
    ? {
        id: designRow.id,
        objective: designRow.objective as EnduranceObjective,
        environment: designRow.environment as EnduranceEnvironment | null,
        optionalLayers: designRow.optionalLayersJson ? JSON.parse(designRow.optionalLayersJson) : {},
        watchPreparedAt: designRow.watchPreparedAt ? new Date(designRow.watchPreparedAt).toISOString() : null
      }
    : null;

  const warning = weeklyLoadWarning(sessions);
  const conflictText =
    warning && warning.session === plannedSession
      ? `${plannedSession.title} es una sesión intensa y está junto a ${warning.conflict.title.toLowerCase()} (piernas), lo que puede sumar fatiga. Puedes ajustarla o seguir tal como está: tú decides.`
      : null;

  return { activePlan, sessionIndex, plannedSession, weekStart, conflictText, initialDesign };
}
