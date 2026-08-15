import { and, eq } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { sessionAdjustment, trainingPlan, workoutSession } from "@/lib/db/schema";
import { isoWeekStart, parseIsoDateLocal } from "@/lib/weekdays";
import type { PlanEditInput } from "@/contracts/plan";
import type { PlanSessionContentInput } from "@/contracts/plan";
import type { PlanProposal } from "@/contracts/onboarding";
import { EXERCISE_CATALOG } from "@/features/catalog/data/exercise-catalog";
import { findSessionBlock } from "@/features/catalog/data/session-blocks";

type Db = ReturnType<typeof getDb>;

export class PlanNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Training plan not found."); }
}
export class PastWeekError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("Cannot edit a week that has already started or passed."); }
}
export class SessionAlreadyExecutedError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("This session already has an execution record for this week and can no longer be edited."); }
}
export class InvalidSessionIndexError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("This session does not exist in the plan template."); }
}
export class InvalidSessionContentError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor(message = "La sesión debe conservar ejercicios válidos y no repetidos.") { super(message); }
}
export class AdjustmentNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("No adjustment exists for this occurrence."); }
}
export class InvalidWeekStartError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("isoWeekStart must be the Monday of its own ISO week."); }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Direct manual edits to future plan occurrences (Bloqueante 1), separate
 * from the check-in-driven recommendation flow (Fase 2) but sharing the same
 * `session_adjustment` per-occurrence identity — (owner, plan, isoWeekStart,
 * sessionIndex) — so a moved session is never a second agenda entry, and
 * re-applying the same edit overwrites rather than duplicating.
 */
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function createPlanEditRepository(database: Db) {
  async function loadOwnedPlan(tx: Tx, ownerId: string, planId: string) {
    const plan = (await tx.select().from(trainingPlan).where(and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId)))).at(0);
    if (!plan) throw new PlanNotFoundError();
    return { plan, proposal: JSON.parse(plan.contentJson) as PlanProposal };
  }

  function assertFutureWeek(weekStartIso: string) {
    if (isoWeekStart(parseIsoDateLocal(weekStartIso)) !== weekStartIso) throw new InvalidWeekStartError();
    if (weekStartIso < isoWeekStart()) throw new PastWeekError();
  }

  /** A workout_session shares (planId, sessionIndex) identity across every week it recurs in; "already executed for this week" means a real row whose startedAt falls inside this week's date range. */
  async function assertNotExecutedThisWeek(tx: Tx, ownerId: string, planId: string, sessionIndex: number, weekStartIso: string) {
    const weekStart = parseIsoDateLocal(weekStartIso);
    const weekEnd = addDays(weekStart, 7);
    const rows = await tx.select({ startedAt: workoutSession.startedAt }).from(workoutSession)
      .where(and(eq(workoutSession.ownerId, ownerId), eq(workoutSession.planId, planId), eq(workoutSession.sessionIndex, sessionIndex)));
    if (rows.some((row) => row.startedAt >= weekStart && row.startedAt < weekEnd)) throw new SessionAlreadyExecutedError();
  }

  async function upsertAdjustment(tx: Tx, ownerId: string, planId: string, weekStartIso: string, sessionIndex: number, originDay: string, kind: string, targetDay: string | null, opsJson: string) {
    const id = crypto.randomUUID();
    const now = new Date();
    await tx.insert(sessionAdjustment)
      .values({ id, ownerId, planId, isoWeekStart: weekStartIso, sessionIndex, originDay, kind, targetDay, opsJson, recommendationId: null, createdAt: now })
      .onConflictDoUpdate({
        target: [sessionAdjustment.ownerId, sessionAdjustment.planId, sessionAdjustment.isoWeekStart, sessionAdjustment.sessionIndex],
        set: { id, originDay, kind, targetDay, opsJson, recommendationId: null, createdAt: now }
      });
    return (await tx.select().from(sessionAdjustment)
      .where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, planId), eq(sessionAdjustment.isoWeekStart, weekStartIso), eq(sessionAdjustment.sessionIndex, sessionIndex)))).at(0)!;
  }

  async function runEdit(ownerId: string, planId: string, input: PlanEditInput) {
    return database.transaction(async (tx) => {
      assertFutureWeek(input.isoWeekStart);

      if (input.kind === "restore") {
        await tx.delete(sessionAdjustment).where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, planId), eq(sessionAdjustment.isoWeekStart, input.isoWeekStart), eq(sessionAdjustment.sessionIndex, input.sessionIndex)));
        return { deleted: true as const };
      }

      // move / skip / remove all target an existing template occurrence.
      const { plan, proposal } = await loadOwnedPlan(tx, ownerId, planId);
      const plannedSession = proposal.week?.sessions?.[input.sessionIndex];
      if (!plannedSession) throw new InvalidSessionIndexError();
      await assertNotExecutedThisWeek(tx, ownerId, plan.id, input.sessionIndex, input.isoWeekStart);

      if (input.kind === "move") {
        // Moving a session to the weekday it already occupies is a no-op, not a
        // reschedule: buildWeekView always renders a reschedule as two rows
        // (moved_away at origin + moved_here at target), so storing target ===
        // origin would visually duplicate the same session on the same day.
        // Clear any existing adjustment instead, same as "restore".
        if (input.targetDay === plannedSession.day) {
          await tx.delete(sessionAdjustment).where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, planId), eq(sessionAdjustment.isoWeekStart, input.isoWeekStart), eq(sessionAdjustment.sessionIndex, input.sessionIndex)));
          return { deleted: true as const };
        }
        const ops = JSON.stringify([{ op: "reschedule", targetDay: input.targetDay }]);
        return upsertAdjustment(tx, ownerId, plan.id, input.isoWeekStart, input.sessionIndex, plannedSession.day, "reschedule", input.targetDay, ops);
      }
      if (input.kind === "skip") {
        return upsertAdjustment(tx, ownerId, plan.id, input.isoWeekStart, input.sessionIndex, plannedSession.day, "skipped", null, "[]");
      }
      // remove
      return upsertAdjustment(tx, ownerId, plan.id, input.isoWeekStart, input.sessionIndex, plannedSession.day, "removed", null, "[]");
    });
  }

  async function updateSessionContent(ownerId: string, planId: string, input: PlanSessionContentInput) {
    return database.transaction(async (tx) => {
      assertFutureWeek(input.isoWeekStart);
      const { plan, proposal } = await loadOwnedPlan(tx, ownerId, planId);
      const plannedSession = proposal.week?.sessions?.[input.sessionIndex];
      if (!plannedSession) throw new InvalidSessionIndexError();
      if (plannedSession.kind !== "strength") throw new InvalidSessionContentError("Solo se pueden editar ejercicios de sesiones de fuerza.");
      await assertNotExecutedThisWeek(tx, ownerId, plan.id, input.sessionIndex, input.isoWeekStart);

      const seen = new Set<string>();
      for (const exercise of input.exercises) {
        if (seen.has(exercise.variantId)) throw new InvalidSessionContentError("No puedes añadir dos veces la misma variante.");
        if (!EXERCISE_CATALOG.some((variant) => variant.id === exercise.variantId)) {
          throw new InvalidSessionContentError("La variante seleccionada no está disponible en el catálogo.");
        }
        seen.add(exercise.variantId);
      }

      const blocks = input.blocks ?? plannedSession.blocks ?? [];
      const seenBlocks = new Set<string>();
      for (const block of blocks) {
        if (seenBlocks.has(block.id)) throw new InvalidSessionContentError("No puedes añadir dos veces el mismo bloque.");
        const canonical = findSessionBlock(block.id);
        if (!canonical || canonical.kind !== block.kind) throw new InvalidSessionContentError("El bloque seleccionado no está disponible en el catálogo.");
        seenBlocks.add(block.id);
      }

      const updatedProposal: PlanProposal = {
        ...proposal,
        week: {
          ...proposal.week,
          sessions: proposal.week.sessions.map((session, sessionIndex) => (
            sessionIndex === input.sessionIndex ? { ...session, exercises: input.exercises, blocks } : session
          ))
        }
      };
      await tx.update(trainingPlan)
        .set({ contentJson: JSON.stringify(updatedProposal), version: plan.version + 1 })
        .where(and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId)));
      return { sessionIndex: input.sessionIndex, exercises: input.exercises, blocks };
    });
  }

  return {
    applyEdit: (ownerId: string, planId: string, input: PlanEditInput) => runEdit(ownerId, planId, input),
    updateSessionContent: (ownerId: string, planId: string, input: PlanSessionContentInput) => updateSessionContent(ownerId, planId, input),
    listWeekAdjustments: (ownerId: string, planId: string, weekStartIso: string) =>
      database.select({ sessionIndex: sessionAdjustment.sessionIndex, kind: sessionAdjustment.kind, targetDay: sessionAdjustment.targetDay, opsJson: sessionAdjustment.opsJson })
        .from(sessionAdjustment)
        .where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, planId), eq(sessionAdjustment.isoWeekStart, weekStartIso)))
  };
}
