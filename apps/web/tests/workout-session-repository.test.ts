import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createWorkoutSessionRepository, WorkoutNotFoundError } from "@/features/workouts/domain/workout-session-repository";
import { getDb } from "@/lib/db/client";
import { setPerformance, trainingPlan, user, workoutSession } from "@/lib/db/schema";
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

async function fixture() {
  const db = getDb();
  const now = new Date();
  const ownerA = `account-a-${crypto.randomUUID()}`;
  const ownerB = `account-b-${crypto.randomUUID()}`;
  const planA = `plan-a-${ownerA}`;
  for (const id of [ownerA, ownerB]) {
    await db.insert(user).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  }
  await db.insert(trainingPlan).values({ id: planA, ownerId: ownerA, name: "Plan A", status: "active", version: 1, contentJson: JSON.stringify(proposal), createdAt: now });
  return { db, ownerA, ownerB, planA };
}

async function cleanup(db: ReturnType<typeof getDb>, ownerA: string, ownerB: string) {
  await db.delete(user).where(eq(user.id, ownerA));
  await db.delete(user).where(eq(user.id, ownerB));
}

async function completeThreeSets(repo: ReturnType<typeof createWorkoutSessionRepository>, ownerId: string, workoutSessionId: string, sessionExerciseId: string, repetitions: number) {
  for (let setNumber = 1; setNumber <= 3; setNumber += 1) {
    await repo.recordSet(ownerId, workoutSessionId, sessionExerciseId, setNumber, 40, repetitions, "just_right");
  }
}

describe("workout session repository", () => {
  it("starts a session from the plan, resumes the same in-progress workout, and records sets", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createWorkoutSessionRepository(db);

    const started = await repo.startOrResumeWorkout(ownerA, planA, 0);
    expect(started.sessionExercises).toHaveLength(1);
    const resumed = await repo.startOrResumeWorkout(ownerA, planA, 0);
    expect(resumed.workoutSession.id).toBe(started.workoutSession.id);

    await repo.recordSet(ownerA, started.workoutSession.id, started.sessionExercises[0].id, 1, 40, 10, "just_right");
    const sets = await db.select({ loadKg: setPerformance.loadKg, repetitions: setPerformance.repetitions }).from(setPerformance).where(eq(setPerformance.sessionExerciseId, started.sessionExercises[0].id));
    expect(sets).toEqual([{ loadKg: 40, repetitions: 10 }]);

    await cleanup(db, ownerA, ownerB);
  });

  it("removes a recorded set so resuming the workout does not mark it as completed", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createWorkoutSessionRepository(db);
    const started = await repo.startOrResumeWorkout(ownerA, planA, 0);
    const exerciseId = started.sessionExercises[0].id;

    await repo.recordSet(ownerA, started.workoutSession.id, exerciseId, 1, 40, 10, "just_right");
    await repo.removeSet(ownerA, started.workoutSession.id, exerciseId, 1);

    expect(await db.select().from(setPerformance).where(eq(setPerformance.sessionExerciseId, exerciseId))).toEqual([]);
    const resumed = await repo.startOrResumeWorkout(ownerA, planA, 0);
    expect((resumed.sessionExercises[0] as { sets?: unknown[] }).sets ?? []).toEqual([]);

    await cleanup(db, ownerA, ownerB);
  });

  it("produces correct history and an explainable suggestion after three complete exposures of a variant", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createWorkoutSessionRepository(db);

    for (let exposure = 0; exposure < 3; exposure += 1) {
      const started = await repo.startOrResumeWorkout(ownerA, planA, 0);
      await completeThreeSets(repo, ownerA, started.workoutSession.id, started.sessionExercises[0].id, 10);
      await repo.finishWorkout(ownerA, started.workoutSession.id, crypto.randomUUID(), started.workoutSession.version, "completed", 7, null, null);
    }

    const baseline = await repo.getBaseline(ownerA, "squat-barbell");
    expect(baseline).toBeDefined();
    const summary = JSON.parse(baseline!.summaryJson);
    expect(summary.ruleVersion).toBe("progression-v1");
    expect(summary.suggestion.type).toBe("increase_load");
    expect(summary.suggestion.reason).toEqual(expect.any(String));

    await cleanup(db, ownerA, ownerB);
  });

  it("keeps both variants' histories independent after substituting mid-plan", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createWorkoutSessionRepository(db);

    const started = await repo.startOrResumeWorkout(ownerA, planA, 0);
    await completeThreeSets(repo, ownerA, started.workoutSession.id, started.sessionExercises[0].id, 10);
    const replacement = await repo.substituteVariant(ownerA, started.workoutSession.id, started.sessionExercises[0].id, "squat-dumbbell");
    await completeThreeSets(repo, ownerA, started.workoutSession.id, replacement.id, 12);
    await repo.finishWorkout(ownerA, started.workoutSession.id, crypto.randomUUID(), started.workoutSession.version, "completed", 7, null, null);

    const barbellSets = await db.select().from(setPerformance).where(eq(setPerformance.sessionExerciseId, started.sessionExercises[0].id));
    const dumbbellSets = await db.select().from(setPerformance).where(eq(setPerformance.sessionExerciseId, replacement.id));
    expect(barbellSets).toHaveLength(3);
    expect(dumbbellSets).toHaveLength(3);
    expect(await repo.getBaseline(ownerA, "squat-barbell")).toBeDefined();
    expect(await repo.getBaseline(ownerA, "squat-dumbbell")).toBeDefined();

    await cleanup(db, ownerA, ownerB);
  });

  it("keeps partial/adapted/completed close states correct and distinct", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createWorkoutSessionRepository(db);

    const partial = await repo.startOrResumeWorkout(ownerA, planA, 0);
    await repo.recordSet(ownerA, partial.workoutSession.id, partial.sessionExercises[0].id, 1, 40, 10, "just_right");
    await repo.finishWorkout(ownerA, partial.workoutSession.id, crypto.randomUUID(), partial.workoutSession.version, "partial", 5, null, null);

    const adapted = await repo.startOrResumeWorkout(ownerA, planA, 0);
    await completeThreeSets(repo, ownerA, adapted.workoutSession.id, adapted.sessionExercises[0].id, 10);
    await repo.finishWorkout(ownerA, adapted.workoutSession.id, crypto.randomUUID(), adapted.workoutSession.version, "adapted", 6, "cambié el ejercicio por molestia", null);

    const statuses = await db.select({ status: workoutSession.status }).from(workoutSession).where(eq(workoutSession.ownerId, ownerA)).orderBy(workoutSession.startedAt);
    expect(statuses.map((row) => row.status)).toEqual(["partial", "adapted"]);

    const baseline = await repo.getBaseline(ownerA, "squat-barbell");
    const summary = JSON.parse(baseline!.summaryJson);
    expect(summary.suggestion.type).toBe("maintain");

    await cleanup(db, ownerA, ownerB);
  });

  it("never resumes or finishes another account's workout", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    const repo = createWorkoutSessionRepository(db);

    const started = await repo.startOrResumeWorkout(ownerA, planA, 0);
    await expect(repo.finishWorkout(ownerB, started.workoutSession.id, crypto.randomUUID(), started.workoutSession.version, "completed", 5, null, null)).rejects.toThrow(WorkoutNotFoundError);
    await expect(repo.recordSet(ownerB, started.workoutSession.id, started.sessionExercises[0].id, 1, 40, 10, "just_right")).rejects.toThrow(WorkoutNotFoundError);

    await cleanup(db, ownerA, ownerB);
  });
});
