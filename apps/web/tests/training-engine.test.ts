import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { evaluateCheckin } from "@/features/training-engine/domain/engine";
import { RecommendationAlreadyDecidedError, createWorkoutTrainingEngineRepository } from "@/features/training-engine/domain/repository";
import { applyAdjustmentOps, createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { getDb } from "@/lib/db/client";
import { enduranceActivity, recommendation, sessionAdjustment, trainingPlan, user } from "@/lib/db/schema";
import { isoWeekStart, parseIsoDateLocal } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";
import type { CheckinInput } from "@/contracts/training-engine";

const basicProposal: PlanProposal = {
  proposalId: "proposal-a",
  ruleVersion: "plan-proposal-v1",
  reasons: [],
  alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
  week: {
    sessions: [
      {
        day: "monday", kind: "strength", title: "Fuerza: empuje", estimatedMinutes: 60,
        exercises: [
          { variantId: "push-h-bench", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 },
          { variantId: "push-v-dumbbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }
        ]
      }
    ]
  }
};

const legsProximityProposal: PlanProposal = {
  ...basicProposal,
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Fuerza: piernas", estimatedMinutes: 60, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] },
      { day: "tuesday", kind: "endurance", title: "Carrera larga", estimatedMinutes: 60 }
    ]
  }
};

const emptyCheckin: CheckinInput = {};

function pureFixtureToday() {
  // 2026-08-10 is a Monday, matching both fixture proposals' "monday" session.
  return "monday" as const;
}

describe("evaluateCheckin (pure rule engine)", () => {
  it("proposes dropping the last accessory when declared time is below the planned duration", () => {
    const result = evaluateCheckin({ timeAvailableMinutes: 40 }, pureFixtureToday(), basicProposal);
    const change = result.changes.find((c) => c.code === "TIME_CONSTRAINT");
    expect(change).toBeDefined();
    expect(change!.ops).toEqual([{ op: "remove_exercise", position: 1 }]);
    expect(result.decisionRequired).toBe(true);
  });

  it("proposes bodyweight substitutions when equipment is declared unavailable, never auto-applied", () => {
    const result = evaluateCheckin({ equipmentUnavailable: true }, pureFixtureToday(), basicProposal);
    const change = result.changes.find((c) => c.code === "EQUIPMENT_UNAVAILABLE");
    expect(change).toBeDefined();
    expect(change!.ops.every((op) => op.op === "replace_variant")).toBe(true);
    // The candidate is only a proposal: nothing about the plan itself changed.
    expect(basicProposal.week.sessions[0].exercises![0].variantId).toBe("push-h-bench");
  });

  it("uses prudent, non-diagnostic language and offers stop/adapt for important discomfort", () => {
    const result = evaluateCheckin({ discomfort: { zone: "knee", intensity: "important" } }, pureFixtureToday(), basicProposal);
    expect(result.importantDiscomfort).toBe(true);
    const change = result.changes.find((c) => c.code === "IMPORTANT_DISCOMFORT");
    expect(change).toBeDefined();
    expect(change!.description).not.toMatch(/lesión/i);
    expect(change!.description).toMatch(/no es un diagnóstico/i);
    expect(result.decisionRequired).toBe(true);
  });

  it("warns about a legs-heavy session near a long/intense endurance session and offers move/keep, never moves it silently", () => {
    const result = evaluateCheckin(emptyCheckin, pureFixtureToday(), legsProximityProposal);
    const change = result.changes.find((c) => c.code === "LOWER_BODY_PROXIMITY");
    expect(change).toBeDefined();
    expect(change!.kind).toBe("reschedule");
    expect(change!.ops).toEqual([{ op: "reschedule", targetDay: "wednesday" }]);
    // A keep-planned alternative is always present alongside the guardrail.
    expect(result.changes.some((c) => c.code === "KEEP_PLANNED")).toBe(true);
  });

  it("does not warn when there is no session today", () => {
    const result = evaluateCheckin(emptyCheckin, "sunday", basicProposal);
    expect(result.sessionIndex).toBeNull();
    expect(result.decisionRequired).toBe(false);
    expect(result.reasonCodes).toEqual(["NO_SESSION_TODAY"]);
  });

  it("a confirmed real activity near a legs-heavy session offers to move it, sourced from what actually happened, and mentions the real duration", () => {
    const evidence = { sport: "running", startedAt: "2026-08-09T08:00:00Z", hoursAgo: 20, durationS: 52 * 60, distanceM: 9000 };
    const result = evaluateCheckin(emptyCheckin, "monday", legsProximityProposal, evidence);
    const change = result.changes.find((c) => c.code === "EXTERNAL_LEGS_PROXIMITY");
    expect(change).toBeDefined();
    expect(change!.description).toMatch(/52 min/);
    expect(result.externalEvidence).toEqual(evidence);
    expect(result.humanReason).toMatch(/52 min/);
  });

  it("a real activity that is not legs-adjacent or substantial is still surfaced in the explanation, without forcing an alternative", () => {
    const evidence = { sport: "running", startedAt: "2026-08-09T08:00:00Z", hoursAgo: 20, durationS: 15 * 60, distanceM: 2000 };
    const result = evaluateCheckin(emptyCheckin, "monday", basicProposal, evidence);
    expect(result.changes.some((c) => c.code === "EXTERNAL_LEGS_PROXIMITY")).toBe(false);
    expect(result.humanReason).toMatch(/15 min/);
    expect(result.humanReason).toMatch(/mantenemos/i);
  });

  it("never invents a duration when the real activity doesn't have one, and flags it as missing data", () => {
    const evidence = { sport: "running", startedAt: "2026-08-09T08:00:00Z", hoursAgo: 20, durationS: null, distanceM: null };
    const result = evaluateCheckin(emptyCheckin, "monday", basicProposal, evidence);
    expect(result.humanReason).toMatch(/sin duración registrada/);
    expect(result.humanReason).not.toMatch(/\d+ min/);
    expect(result.missingData).toContain("externalActivityDuration");
  });

  it("without any confirmed activity, keeps the exact same behavior as before Bloqueante 2 (no evidence branch, no mention of activity)", () => {
    const result = evaluateCheckin(emptyCheckin, "monday", legsProximityProposal);
    expect(result.externalEvidence).toBeNull();
    expect(result.changes.some((c) => c.code === "EXTERNAL_LEGS_PROXIMITY")).toBe(false);
  });
});

async function fixture(proposal: PlanProposal) {
  const db = getDb();
  const now = new Date();
  const ownerA = `account-a-${crypto.randomUUID()}`;
  const planA = `plan-a-${ownerA}`;
  await db.insert(user).values({ id: ownerA, name: ownerA, email: `${ownerA}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  await db.insert(trainingPlan).values({ id: planA, ownerId: ownerA, name: "Plan A", status: "active", version: 1, contentJson: JSON.stringify(proposal), createdAt: now });
  return { db, ownerA, planA };
}

async function cleanup(db: ReturnType<typeof getDb>, ...ownerIds: string[]) {
  for (const ownerId of ownerIds) await db.delete(user).where(eq(user.id, ownerId));
}

describe("training engine repository", () => {
  it("resubmitting a check-in the same day overwrites the recommendation, never duplicates it", async () => {
    const { db, ownerA } = await fixture(basicProposal);
    const repo = createWorkoutTrainingEngineRepository(db);

    const first = await repo.submitCheckin(ownerA, "2026-08-10", { timeAvailableMinutes: 40 });
    const second = await repo.submitCheckin(ownerA, "2026-08-10", { timeAvailableMinutes: 20 });
    expect(first.recommendationId).not.toBe(second.recommendationId);

    const rows = await db.select().from(recommendation).where(eq(recommendation.ownerId, ownerA));
    expect(rows).toHaveLength(1);

    await cleanup(db, ownerA);
  });

  it("recording keep/reject leaves the session states untouched (no silent adjustment)", async () => {
    const { db, ownerA } = await fixture(basicProposal);
    const repo = createWorkoutTrainingEngineRepository(db);

    const rec = await repo.submitCheckin(ownerA, "2026-08-10", { timeAvailableMinutes: 40 });
    await repo.decideRecommendation(ownerA, { recommendationId: rec.recommendationId, decision: "keep" });

    const adjustments = await db.select().from(sessionAdjustment).where(eq(sessionAdjustment.ownerId, ownerA));
    expect(adjustments).toHaveLength(0);
    await expect(repo.decideRecommendation(ownerA, { recommendationId: rec.recommendationId, decision: "keep" })).rejects.toThrow(RecommendationAlreadyDecidedError);

    await cleanup(db, ownerA);
  });

  it("applying a candidate creates one session_adjustment; re-deciding the same weekly occurrence overwrites it, never duplicates", async () => {
    const { db, ownerA, planA } = await fixture(basicProposal);
    const repo = createWorkoutTrainingEngineRepository(db);

    const first = await repo.submitCheckin(ownerA, "2026-08-10", { timeAvailableMinutes: 40 });
    await repo.decideRecommendation(ownerA, { recommendationId: first.recommendationId, decision: "apply", changeCode: "TIME_CONSTRAINT" });

    // Same ISO week, same planned session index (resubmitting the same day's check-in regenerates a fresh, undecided recommendation): must overwrite, not add a row.
    const second = await repo.submitCheckin(ownerA, "2026-08-10", { timeAvailableMinutes: 20 });
    await repo.decideRecommendation(ownerA, { recommendationId: second.recommendationId, decision: "apply", changeCode: "TIME_CONSTRAINT" });

    const week = isoWeekStart(parseIsoDateLocal("2026-08-10"));
    const adjustments = await db.select().from(sessionAdjustment).where(and(eq(sessionAdjustment.ownerId, ownerA), eq(sessionAdjustment.planId, planA), eq(sessionAdjustment.isoWeekStart, week), eq(sessionAdjustment.sessionIndex, 0)));
    expect(adjustments).toHaveLength(1);

    await cleanup(db, ownerA);
  });

  it("an applied equipment-substitution adjustment actually changes the assigned exercises when the session starts", async () => {
    const { db, ownerA, planA } = await fixture(basicProposal);
    const engineRepo = createWorkoutTrainingEngineRepository(db);
    const workoutRepo = createWorkoutSessionRepository(db);

    const rec = await engineRepo.submitCheckin(ownerA, "2026-08-10", { equipmentUnavailable: true });
    const change = rec.changes.find((c) => c.code === "EQUIPMENT_UNAVAILABLE")!;
    await engineRepo.decideRecommendation(ownerA, { recommendationId: rec.recommendationId, decision: "apply", changeCode: change.code });

    const adjustment = (await engineRepo.getAdjustment(ownerA, planA, isoWeekStart(parseIsoDateLocal("2026-08-10")), 0))!;
    expect(adjustment).toBeDefined();
    const ops = JSON.parse(adjustment.opsJson);

    const started = await workoutRepo.startOrResumeWorkout(ownerA, planA, 0, ops);
    expect(started.sessionExercises[0].variantId).not.toBe("push-h-bench");
    expect(started.sessionExercises[0].variantId).toBe("push-h-pushup");

    await cleanup(db, ownerA);
  });

  it("a confirmed imported activity from yesterday changes today's recommendation and is persisted as evidence", async () => {
    const { db, ownerA } = await fixture(legsProximityProposal);
    const repo = createWorkoutTrainingEngineRepository(db);
    const yesterday = new Date("2026-08-09T08:00:00Z");
    await db.insert(enduranceActivity).values({ id: crypto.randomUUID(), ownerId: ownerA, sport: "running", name: "Carrera", source: "imported", fingerprint: "running|1|52", startedAt: yesterday, durationS: 52 * 60, distanceM: 9000, createdAt: yesterday });

    const rec = await repo.submitCheckin(ownerA, "2026-08-10", {});
    expect(rec.externalEvidence).not.toBeNull();
    expect(rec.externalEvidence!.durationS).toBe(52 * 60);
    const change = rec.changes.find((c) => c.code === "EXTERNAL_LEGS_PROXIMITY");
    expect(change).toBeDefined();

    const row = (await db.select({ externalEvidenceJson: recommendation.externalEvidenceJson }).from(recommendation).where(eq(recommendation.id, rec.recommendationId)))[0];
    expect(JSON.parse(row.externalEvidenceJson!).sport).toBe("running");

    await cleanup(db, ownerA);
  });

  it("never mixes another account's activity into this account's recommendation", async () => {
    const { db, ownerA } = await fixture(legsProximityProposal);
    const ownerB = `account-b-${crypto.randomUUID()}`;
    const now = new Date();
    await db.insert(user).values({ id: ownerB, name: ownerB, email: `${ownerB}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
    const repo = createWorkoutTrainingEngineRepository(db);
    const yesterday = new Date("2026-08-09T08:00:00Z");
    await db.insert(enduranceActivity).values({ id: crypto.randomUUID(), ownerId: ownerB, sport: "running", name: "Carrera", source: "imported", fingerprint: "running|1|52", startedAt: yesterday, durationS: 52 * 60, distanceM: 9000, createdAt: yesterday });

    const rec = await repo.submitCheckin(ownerA, "2026-08-10", {});
    expect(rec.externalEvidence).toBeNull();

    await cleanup(db, ownerA, ownerB);
  });
});

describe("applyAdjustmentOps (pure)", () => {
  const exercises = [
    { variantId: "push-h-bench", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 },
    { variantId: "push-v-dumbbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }
  ];

  it("removes the exercise at the given position without mutating the input", () => {
    const result = applyAdjustmentOps(exercises, [{ op: "remove_exercise", position: 1 }]);
    expect(result).toHaveLength(1);
    expect(exercises).toHaveLength(2);
  });

  it("ignores ops it does not recognize (e.g. reschedule has no exercise-level effect)", () => {
    const result = applyAdjustmentOps(exercises, [{ op: "reschedule", targetDay: "wednesday" }]);
    expect(result).toEqual(exercises);
  });
});
