import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createHistoryRepository } from "@/features/history/domain/history-repository";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { getDb } from "@/lib/db/client";
import { sessionAdjustment, trainingPlan, user, workoutSession } from "@/lib/db/schema";
import { parseIsoDateLocal } from "@/lib/weekdays";
import type { PlanProposal } from "@/contracts/onboarding";

const proposal: PlanProposal = {
  proposalId: "proposal-a",
  ruleVersion: "plan-proposal-v1",
  reasons: [],
  alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Fuerza: piernas", estimatedMinutes: 60, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] }
    ]
  }
};

async function fixture(planCreatedAt: Date) {
  const db = getDb();
  const ownerA = `account-a-${crypto.randomUUID()}`;
  const planA = `plan-a-${ownerA}`;
  await db.insert(user).values({ id: ownerA, name: ownerA, email: `${ownerA}@example.test`, emailVerified: true, createdAt: planCreatedAt, updatedAt: planCreatedAt });
  await db.insert(trainingPlan).values({ id: planA, ownerId: ownerA, name: "Plan A", status: "active", version: 1, contentJson: JSON.stringify(proposal), createdAt: planCreatedAt });
  return { db, ownerA, planA };
}

async function cleanup(db: ReturnType<typeof getDb>, ...ownerIds: string[]) {
  for (const id of ownerIds) await db.delete(user).where(eq(user.id, id));
}

async function completeExposure(workoutRepo: ReturnType<typeof createWorkoutSessionRepository>, db: ReturnType<typeof getDb>, ownerId: string, planId: string, startedAt: Date, status: "completed" | "adapted" | "partial") {
  const started = await workoutRepo.startOrResumeWorkout(ownerId, planId, 0);
  for (let setNumber = 1; setNumber <= 3; setNumber += 1) await workoutRepo.recordSet(ownerId, started.workoutSession.id, started.sessionExercises[0].id, setNumber, 40, 10, "just_right");
  await workoutRepo.finishWorkout(ownerId, started.workoutSession.id, crypto.randomUUID(), 1, status, 7, null, null);
  await db.update(workoutSession).set({ startedAt }).where(eq(workoutSession.id, started.workoutSession.id));
}

describe("history repository", () => {
  it("derives adherence, variant progress, weekly load and chronological history from real persisted sessions, not fixtures", async () => {
    const week1 = parseIsoDateLocal("2026-08-03"); // Monday
    const week2 = parseIsoDateLocal("2026-08-10");
    const week3 = parseIsoDateLocal("2026-08-17");
    const { db, ownerA, planA } = await fixture(week1);
    const workoutRepo = createWorkoutSessionRepository(db);
    const historyRepo = createHistoryRepository(db);

    await completeExposure(workoutRepo, db, ownerA, planA, week1, "completed");
    await completeExposure(workoutRepo, db, ownerA, planA, week2, "adapted");
    await completeExposure(workoutRepo, db, ownerA, planA, week3, "partial");

    const adherence = await historyRepo.computeAdherence(ownerA, planA, week3);
    expect(adherence).toEqual({ previstas: 3, completadas: 1, adaptadas: 1, parciales: 1, omitidas: 0, recolocadas: 0, recuperacionValida: 0 });

    const progress = await historyRepo.listVariantProgress(ownerA);
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ variantId: "squat-barbell", exerciseName: "Sentadilla", hasBaseline: true });

    const weeklyLoad = await historyRepo.computeWeeklyLoad(ownerA, "2026-08-17");
    expect(weeklyLoad).toEqual({ piernas: 3, treSuperior: 0, resistenciaMinutos: 0 });

    const history = await historyRepo.listSessionHistory(ownerA, planA);
    expect(history).toHaveLength(3);
    expect(history[0].startedAt.getTime()).toBe(week3.getTime()); // most recent first
    expect(history.every((entry) => entry.title === "Fuerza: piernas" && entry.day === "monday")).toBe(true);

    await cleanup(db, ownerA);
  });

  it("never mixes up a different account's sessions into adherence or history", async () => {
    const week1 = parseIsoDateLocal("2026-08-03");
    const { db, ownerA, planA } = await fixture(week1);
    const ownerB = `account-b-${crypto.randomUUID()}`;
    const planB = `plan-b-${ownerB}`;
    await db.insert(user).values({ id: ownerB, name: ownerB, email: `${ownerB}@example.test`, emailVerified: true, createdAt: week1, updatedAt: week1 });
    await db.insert(trainingPlan).values({ id: planB, ownerId: ownerB, name: "Plan B", status: "active", version: 1, contentJson: JSON.stringify(proposal), createdAt: week1 });
    const workoutRepoB = createWorkoutSessionRepository(db);
    const historyRepo = createHistoryRepository(db);

    await workoutRepoB.startOrResumeWorkout(ownerB, planB, 0);

    expect(await historyRepo.listSessionHistory(ownerA, planA)).toHaveLength(0);
    expect((await historyRepo.computeAdherence(ownerA, planA, week1))?.previstas).toBe(1);
    expect((await historyRepo.computeAdherence(ownerA, planA, week1))?.omitidas).toBe(1);

    await cleanup(db, ownerA, ownerB);
  });

  it("counts a rescheduled occurrence as recolocada, never as omitida", async () => {
    const week1 = parseIsoDateLocal("2026-08-03");
    const { db, ownerA, planA } = await fixture(week1);
    const historyRepo = createHistoryRepository(db);

    await db.insert(sessionAdjustment).values({
      id: `adj-${ownerA}`, ownerId: ownerA, planId: planA, isoWeekStart: "2026-08-03", sessionIndex: 0,
      originDay: "monday", kind: "reschedule", targetDay: "wednesday", opsJson: "[]", recommendationId: null, createdAt: week1
    });

    const adherence = await historyRepo.computeAdherence(ownerA, planA, week1);
    expect(adherence).toEqual({ previstas: 1, completadas: 0, adaptadas: 0, parciales: 0, omitidas: 0, recolocadas: 1, recuperacionValida: 0 });

    await cleanup(db, ownerA);
  });
});
