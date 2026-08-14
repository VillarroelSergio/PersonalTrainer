import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  InvalidSessionIndexError,
  InvalidSessionContentError,
  InvalidWeekStartError,
  PastWeekError,
  PlanNotFoundError,
  SessionAlreadyExecutedError,
  createPlanEditRepository
} from "@/features/planning/domain/plan-edit-repository";
import { getDb } from "@/lib/db/client";
import { sessionAdjustment, trainingPlan, user, workoutSession } from "@/lib/db/schema";
import { isoDate, isoWeekStart, parseIsoDateLocal } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

const proposal: PlanProposal = {
  proposalId: "p1", ruleVersion: "plan-proposal-v1", reasons: [], alternatives: [],
  initialBlock: { name: "Adaptación", purpose: "Base", weeks: 4 },
  week: { sessions: [{ day: "monday", kind: "strength", title: "Piernas", estimatedMinutes: 60, exercises: [
    { variantId: "squat-barbell", targetSets: 3, targetRepsMin: 6, targetRepsMax: 10 },
    { variantId: "push-h-bench", targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }
  ] }] }
};

async function fixture() {
  const db = getDb();
  const ownerId = `account-a-${crypto.randomUUID()}`;
  const planId = `plan-a-${ownerId}`;
  await db.insert(user).values({ id: ownerId, name: ownerId, email: `${ownerId}@example.test`, emailVerified: true, createdAt: new Date(0), updatedAt: new Date(0) });
  await db.insert(trainingPlan).values({ id: planId, ownerId, name: "Plan A", status: "active", version: 1, contentJson: JSON.stringify(proposal), createdAt: new Date(0) });
  return { db, ownerId, planId };
}

async function cleanup(db: ReturnType<typeof getDb>, ownerId: string) {
  await db.delete(user).where(eq(user.id, ownerId));
}

function nextWeekStart(): string {
  const today = new Date();
  const nextMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
  return isoWeekStart(nextMonday);
}
function pastWeekStart(): string {
  const today = new Date();
  const lastMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 14);
  return isoWeekStart(lastMonday);
}

describe("plan edit repository", () => {
  it("moves a future session and re-applying the same move overwrites in place instead of duplicating the agenda entry", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createPlanEditRepository(db);
    const week = nextWeekStart();

    await repo.applyEdit(ownerId, planId, { kind: "move", isoWeekStart: week, sessionIndex: 0, targetDay: "friday" });
    await repo.applyEdit(ownerId, planId, { kind: "move", isoWeekStart: week, sessionIndex: 0, targetDay: "saturday" });

    const rows = await db.select().from(sessionAdjustment).where(eq(sessionAdjustment.ownerId, ownerId));
    expect(rows).toHaveLength(1);
    expect(rows[0].targetDay).toBe("saturday");

    await cleanup(db, ownerId);
  });

  it("moving a session to the weekday it's already on clears any adjustment instead of storing a same-day reschedule (which buildWeekView would render as two rows for the same day)", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createPlanEditRepository(db);
    const week = nextWeekStart();

    await repo.applyEdit(ownerId, planId, { kind: "move", isoWeekStart: week, sessionIndex: 0, targetDay: "friday" });
    await repo.applyEdit(ownerId, planId, { kind: "move", isoWeekStart: week, sessionIndex: 0, targetDay: "monday" }); // back to its template day

    expect(await db.select().from(sessionAdjustment).where(eq(sessionAdjustment.ownerId, ownerId))).toHaveLength(0);

    await cleanup(db, ownerId);
  });

  it("rejects editing a session in a week that has already passed", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createPlanEditRepository(db);
    await expect(repo.applyEdit(ownerId, planId, { kind: "skip", isoWeekStart: pastWeekStart(), sessionIndex: 0 })).rejects.toThrow(PastWeekError);

    await cleanup(db, ownerId);
  });

  it("rejects editing a session that already has an execution record for that week (never rewrites a started/closed session)", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createPlanEditRepository(db);
    const week = isoWeekStart();
    await db.insert(workoutSession).values({
      id: `ws-${ownerId}`, ownerId, planId, sessionIndex: 0, status: "completed", version: 1,
      lastFinishOperationId: null, startedAt: new Date(), endedAt: null, globalEffort: null, comment: null, discomfortJson: null, createdAt: new Date()
    });

    await expect(repo.applyEdit(ownerId, planId, { kind: "move", isoWeekStart: week, sessionIndex: 0, targetDay: "friday" })).rejects.toThrow(SessionAlreadyExecutedError);

    await cleanup(db, ownerId);
  });

  it("rejects an isoWeekStart that isn't the Monday of its own ISO week", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createPlanEditRepository(db);
    const weekDate = parseIsoDateLocal(nextWeekStart());
    const notMonday = isoDate(new Date(weekDate.getFullYear(), weekDate.getMonth(), weekDate.getDate() + 2));
    await expect(repo.applyEdit(ownerId, planId, { kind: "skip", isoWeekStart: notMonday, sessionIndex: 0 })).rejects.toThrow(InvalidWeekStartError);

    await cleanup(db, ownerId);
  });

  it("rejects a sessionIndex that doesn't exist in the plan template", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createPlanEditRepository(db);
    await expect(repo.applyEdit(ownerId, planId, { kind: "skip", isoWeekStart: nextWeekStart(), sessionIndex: 9 })).rejects.toThrow(InvalidSessionIndexError);

    await cleanup(db, ownerId);
  });

  it("restore clears any adjustment for that occurrence, returning it to the plain plan", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createPlanEditRepository(db);
    const week = nextWeekStart();
    await repo.applyEdit(ownerId, planId, { kind: "skip", isoWeekStart: week, sessionIndex: 0 });
    await repo.applyEdit(ownerId, planId, { kind: "restore", isoWeekStart: week, sessionIndex: 0 });
    expect(await db.select().from(sessionAdjustment).where(eq(sessionAdjustment.ownerId, ownerId))).toHaveLength(0);

    await cleanup(db, ownerId);
  });

  it("never edits another account's plan", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createPlanEditRepository(db);
    await expect(repo.applyEdit("account-b-nonexistent", planId, { kind: "skip", isoWeekStart: nextWeekStart(), sessionIndex: 0 })).rejects.toThrow(PlanNotFoundError);

    await cleanup(db, ownerId);
  });

  it("updates, adds and removes exercises in a future session without touching other session data", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createPlanEditRepository(db);
    const updated = await repo.updateSessionContent(ownerId, planId, {
      isoWeekStart: nextWeekStart(),
      sessionIndex: 0,
      exercises: [
        { variantId: "squat-dumbbell", targetSets: 4, targetRepsMin: 8, targetRepsMax: 12 },
        { variantId: "pull-h-dumbbell-row", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }
      ]
    });

    expect(updated.exercises.map((exercise) => exercise.variantId)).toEqual(["squat-dumbbell", "pull-h-dumbbell-row"]);
    const saved = await db.select().from(trainingPlan).where(eq(trainingPlan.id, planId));
    const savedProposal = JSON.parse(saved[0].contentJson) as PlanProposal;
    expect(savedProposal.week.sessions[0].title).toBe("Piernas");
    expect(savedProposal.week.sessions[0].exercises).toEqual(updated.exercises);

    await cleanup(db, ownerId);
  });

  it("rejects duplicate or unknown variants when editing session content", async () => {
    const { db, ownerId, planId } = await fixture();
    const repo = createPlanEditRepository(db);
    const input = { isoWeekStart: nextWeekStart(), sessionIndex: 0, exercises: [
      { variantId: "squat-dumbbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 },
      { variantId: "squat-dumbbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }
    ] };
    await expect(repo.updateSessionContent(ownerId, planId, input)).rejects.toThrow(InvalidSessionContentError);
    await expect(repo.updateSessionContent(ownerId, planId, { ...input, exercises: [{ ...input.exercises[0], variantId: "not-in-catalog" }] })).rejects.toThrow(InvalidSessionContentError);

    await cleanup(db, ownerId);
  });
});
