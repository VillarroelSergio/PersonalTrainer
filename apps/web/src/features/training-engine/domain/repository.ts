import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/lib/db/schema";
import { checkin, enduranceActivity, recommendation, sessionAdjustment, trainingPlan } from "@/lib/db/schema";
import { evaluateCheckin } from "./engine";
import { isoWeekStart, parseIsoDateLocal, todayWeekday } from "@/lib/weekdays";
import type { CheckinInput, DecideRecommendationInput, ExternalActivityEvidence, Recommendation, RecommendationOp } from "@/contracts/training-engine";
import type { PlanProposal } from "@/contracts/onboarding";

/** How far back a real activity still counts as "recent, comparable evidence" for today's check-in — covers "yesterday evening" through "this morning", never today's own future. */
const RECENT_ACTIVITY_WINDOW_HOURS = 30;

async function findRecentActivityEvidence(database: Pick<Db, "select">, ownerId: string, checkinDate: string): Promise<ExternalActivityEvidence | null> {
  const checkinMidnight = parseIsoDateLocal(checkinDate);
  const windowStart = new Date(checkinMidnight.getTime() - RECENT_ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000);
  const row = (
    await database
      .select({ sport: enduranceActivity.sport, startedAt: enduranceActivity.startedAt, durationS: enduranceActivity.durationS, distanceM: enduranceActivity.distanceM })
      .from(enduranceActivity)
      .where(and(eq(enduranceActivity.ownerId, ownerId), gte(enduranceActivity.startedAt, windowStart), lt(enduranceActivity.startedAt, checkinMidnight)))
      .orderBy(desc(enduranceActivity.startedAt))
      .limit(1)
  ).at(0);
  if (!row) return null;
  const hoursAgo = Math.round((checkinMidnight.getTime() - row.startedAt.getTime()) / (60 * 60 * 1000));
  return { sport: row.sport, startedAt: row.startedAt.toISOString(), hoursAgo, durationS: row.durationS, distanceM: row.distanceM };
}

type Db = PostgresJsDatabase<typeof schema>;

export class ActivePlanNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("No active training plan for this account."); }
}
export class RecommendationNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Recommendation not found."); }
}
export class RecommendationChangeNotFoundError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("changeCode does not match any candidate on this recommendation."); }
}
export class RecommendationAlreadyDecidedError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("This recommendation already has a decision."); }
}

function rowToRecommendation(row: typeof recommendation.$inferSelect): Recommendation {
  return {
    recommendationId: row.id,
    ruleVersion: row.ruleVersion as Recommendation["ruleVersion"],
    confidence: row.confidence as Recommendation["confidence"],
    decisionRequired: JSON.parse(row.changesJson).length > 1,
    reasonCodes: JSON.parse(row.reasonCodesJson),
    humanReason: row.humanReason,
    changes: JSON.parse(row.changesJson),
    alternatives: JSON.parse(row.alternativesJson),
    missingData: JSON.parse(row.missingDataJson),
    externalEvidence: row.externalEvidenceJson ? JSON.parse(row.externalEvidenceJson) : null,
    importantDiscomfort: Boolean(row.importantDiscomfort),
    sessionIndex: row.sessionIndex,
    decision: { status: row.decisionStatus as Recommendation["decision"]["status"], decidedChangeCode: row.decidedChangeCode, decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null }
  };
}

/**
 * Submits (or overwrites, same-day resubmission never duplicates) today's
 * check-in and immediately evaluates it against the active plan, persisting
 * the rule-engine output as the auditable recommendation row. Writes run
 * inside a real, async `database.transaction()` (Postgres).
 */
export function createWorkoutTrainingEngineRepository(database: Db) {
  const runSubmitCheckin = async (ownerId: string, checkinDate: string, input: CheckinInput) => {
    return database.transaction(async (tx) => {
      const plan = (await tx.select().from(trainingPlan).where(and(eq(trainingPlan.ownerId, ownerId), eq(trainingPlan.status, "active"))).limit(1)).at(0);
      if (!plan) throw new ActivePlanNotFoundError();
      const proposal = JSON.parse(plan.contentJson) as PlanProposal;

      const now = new Date();
      await tx
        .insert(checkin)
        .values({ ownerId, checkinDate, energy: input.energy ?? null, motivation: input.motivation ?? null, timeAvailableMinutes: input.timeAvailableMinutes ?? null, equipmentUnavailable: input.equipmentUnavailable ?? false, discomfortJson: input.discomfort ? JSON.stringify(input.discomfort) : null, createdAt: now })
        .onConflictDoUpdate({
          target: [checkin.ownerId, checkin.checkinDate],
          set: { energy: input.energy ?? null, motivation: input.motivation ?? null, timeAvailableMinutes: input.timeAvailableMinutes ?? null, equipmentUnavailable: input.equipmentUnavailable ?? false, discomfortJson: input.discomfort ? JSON.stringify(input.discomfort) : null }
        });

      const externalEvidence = await findRecentActivityEvidence(tx, ownerId, checkinDate);
      const evaluated = evaluateCheckin(input, todayWeekday(parseIsoDateLocal(checkinDate)), proposal, externalEvidence);
      const id = crypto.randomUUID();
      // Resubmitting the same day always mints a fresh recommendation id (a new evaluation, never a patched-in-place
      // one). Deleting the old row first — instead of onConflictDoUpdate mutating its id in place — keeps this safe
      // under a real FK: session_adjustment.recommendationId is ON DELETE SET NULL, so any adjustment decided against
      // yesterday's evaluation just loses that back-reference instead of blocking on an update-time FK violation.
      await tx.delete(recommendation).where(and(eq(recommendation.ownerId, ownerId), eq(recommendation.planId, plan.id), eq(recommendation.checkinDate, checkinDate)));
      await tx
        .insert(recommendation)
        .values({
          id, ownerId, planId: plan.id, checkinDate, sessionIndex: evaluated.sessionIndex,
          ruleVersion: evaluated.ruleVersion, confidence: evaluated.confidence,
          reasonCodesJson: JSON.stringify(evaluated.reasonCodes), humanReason: evaluated.humanReason,
          changesJson: JSON.stringify(evaluated.changes), alternativesJson: JSON.stringify(evaluated.alternatives),
          missingDataJson: JSON.stringify(evaluated.missingData), externalEvidenceJson: evaluated.externalEvidence ? JSON.stringify(evaluated.externalEvidence) : null,
          importantDiscomfort: evaluated.importantDiscomfort,
          decisionStatus: "pending", createdAt: now
        });

      const row = (await tx.select().from(recommendation).where(eq(recommendation.id, id)).limit(1)).at(0);
      if (!row) throw new RecommendationNotFoundError();
      return rowToRecommendation(row);
    });
  };

  const runDecide = async (ownerId: string, input: DecideRecommendationInput) => {
    return database.transaction(async (tx) => {
      const row = (await tx.select().from(recommendation).where(and(eq(recommendation.id, input.recommendationId), eq(recommendation.ownerId, ownerId))).limit(1)).at(0);
      if (!row) throw new RecommendationNotFoundError();
      if (row.decisionStatus !== "pending") throw new RecommendationAlreadyDecidedError();

      const changes = JSON.parse(row.changesJson) as Recommendation["changes"];
      const now = new Date();

      if (input.decision === "keep" || input.decision === "reject") {
        await tx.update(recommendation).set({ decisionStatus: input.decision === "keep" ? "kept" : "rejected", decidedAt: now }).where(eq(recommendation.id, row.id));
        return rowToRecommendation({ ...row, decisionStatus: input.decision === "keep" ? "kept" : "rejected", decidedAt: now });
      }

      const change = changes.find((candidate) => candidate.code === input.changeCode);
      if (!change) throw new RecommendationChangeNotFoundError();

      await tx.update(recommendation).set({ decisionStatus: "applied", decidedChangeCode: change.code, decidedAt: now }).where(eq(recommendation.id, row.id));

      if (change.ops.length > 0 && row.sessionIndex != null) {
        const plan = (await tx.select().from(trainingPlan).where(eq(trainingPlan.id, row.planId)).limit(1)).at(0)!;
        const proposal = JSON.parse(plan.contentJson) as PlanProposal;
        const plannedSession = proposal.week.sessions[row.sessionIndex];
        const weekStart = isoWeekStart(parseIsoDateLocal(row.checkinDate));
        const rescheduleOp = change.ops.find((op): op is Extract<RecommendationOp, { op: "reschedule" }> => op.op === "reschedule");
        const adjustmentId = crypto.randomUUID();
        await tx
          .insert(sessionAdjustment)
          .values({
            id: adjustmentId, ownerId, planId: row.planId, isoWeekStart: weekStart, sessionIndex: row.sessionIndex,
            originDay: plannedSession.day, kind: change.kind, targetDay: rescheduleOp?.targetDay ?? null,
            opsJson: JSON.stringify(change.ops), recommendationId: row.id, createdAt: now
          })
          .onConflictDoUpdate({
            target: [sessionAdjustment.ownerId, sessionAdjustment.planId, sessionAdjustment.isoWeekStart, sessionAdjustment.sessionIndex],
            set: { id: adjustmentId, originDay: plannedSession.day, kind: change.kind, targetDay: rescheduleOp?.targetDay ?? null, opsJson: JSON.stringify(change.ops), recommendationId: row.id, createdAt: now }
          });
      }

      return rowToRecommendation({ ...row, decisionStatus: "applied", decidedChangeCode: change.code, decidedAt: now });
    });
  };

  return {
    submitCheckin: (ownerId: string, checkinDate: string, input: CheckinInput) => runSubmitCheckin(ownerId, checkinDate, input),
    decideRecommendation: (ownerId: string, input: DecideRecommendationInput) => runDecide(ownerId, input),
    getAdjustment: async (ownerId: string, planId: string, weekStart: string, sessionIndex: number) =>
      (await database.select().from(sessionAdjustment).where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, planId), eq(sessionAdjustment.isoWeekStart, weekStart), eq(sessionAdjustment.sessionIndex, sessionIndex))).limit(1)).at(0),
    /** All adjustments ever accepted for this plan, for adherence's "recolocadas" bucket (Fase 3) — unlike getAdjustment, not scoped to a single week. */
    listAdjustments: async (ownerId: string, planId: string) =>
      database.select({ sessionIndex: sessionAdjustment.sessionIndex, isoWeekStart: sessionAdjustment.isoWeekStart, kind: sessionAdjustment.kind }).from(sessionAdjustment).where(and(eq(sessionAdjustment.ownerId, ownerId), eq(sessionAdjustment.planId, planId)))
  };
}
