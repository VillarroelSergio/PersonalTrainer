import { describe, expect, it } from "vitest";
import { createOfflineSnapshotResponse } from "@/app/api/v1/offline-snapshot/handler";
import { getDb } from "@/lib/db/client";
import {
  account,
  activityImport,
  activityMetric,
  checkin,
  enduranceActivity,
  favoriteVariant,
  importFile,
  onboardingDraft,
  performanceBaseline,
  recoverySession,
  sessionExercise,
  setPerformance,
  trainingPlan,
  user,
  workoutSession
} from "@/lib/db/schema";

async function fixture(ownerId: string) {
  const db = getDb();
  const now = new Date();
  await db.insert(user).values({ id: ownerId, name: `Cuenta ${ownerId}`, email: `${ownerId}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  await db.insert(account).values({ id: `cred-${ownerId}`, accountId: ownerId, providerId: "credential", userId: ownerId, password: "super-secret-hash", createdAt: now, updatedAt: now });
  await db.insert(onboardingDraft).values({ ownerId, formJson: JSON.stringify({ heightCm: 170 }), updatedAt: now });
  await db.insert(trainingPlan).values({ id: `plan-${ownerId}`, ownerId, name: "Plan", status: "active", version: 1, contentJson: "{}", createdAt: now });
  const sessionId = `session-${ownerId}`;
  await db.insert(workoutSession).values({ id: sessionId, ownerId, planId: `plan-${ownerId}`, sessionIndex: 0, status: "completed", version: 1, startedAt: now, endedAt: now, createdAt: now });
  const exerciseId = `exercise-${ownerId}`;
  await db.insert(sessionExercise).values({ id: exerciseId, workoutSessionId: sessionId, variantId: "squat-back", position: 0, targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 });
  await db.insert(setPerformance).values({ id: `set-${ownerId}`, sessionExerciseId: exerciseId, setNumber: 1, loadKg: 40, repetitions: 10, completedAt: now });
  await db.insert(recoverySession).values({ id: `recovery-${ownerId}`, ownerId, planId: `plan-${ownerId}`, sessionIndex: 1, status: "completed", startedAt: now, endedAt: now, createdAt: now });
  await db.insert(checkin).values({ ownerId, checkinDate: "2026-08-15", energy: "high", createdAt: now });
  await db.insert(favoriteVariant).values({ ownerId, variantId: "squat-back", createdAt: now });
  const storageKey = `activity-imports/${ownerId}/secret-file.fit`;
  await db.insert(importFile).values({ id: `file-${ownerId}`, ownerId, storageKey, originalName: "carrera.fit", format: "fit", sizeBytes: 10, sha256: `hash-${ownerId}`, uploadedAt: now });
  await db.insert(activityImport).values({ id: `import-${ownerId}`, ownerId, fileId: `file-${ownerId}`, format: "fit", status: "saved", createdAt: now });
  const activityId = `activity-${ownerId}`;
  await db.insert(enduranceActivity).values({ id: activityId, ownerId, sport: "running", name: "Carrera", source: "manual", fingerprint: `fp-${ownerId}`, startedAt: now, durationS: 1800, distanceM: 5000, createdAt: now });
  await db.insert(activityMetric).values({ id: `metric-${ownerId}`, activityId, metricType: "avg_pace_sec_per_km", value: 300, unit: "s/km", source: "manual" });
  await db.insert(performanceBaseline).values({ ownerId, variantId: "squat-back", confidence: 60, summaryJson: JSON.stringify({ ruleVersion: "progression-v1", confidence: 0.6, hasBaseline: true, lastLoadKg: 40, lastRepetitions: 10, suggestion: { type: "maintain", reason: "test" } }), ruleVersion: "progression-v1", calculatedAt: now });
  return { db, storageKey };
}

async function cleanup(db: ReturnType<typeof getDb>, ownerId: string) {
  const { eq } = await import("drizzle-orm");
  await db.delete(user).where(eq(user.id, ownerId));
}

describe("GET /api/v1/offline-snapshot", () => {
  it("requires an authenticated account", async () => {
    const response = await createOfflineSnapshotResponse(new Request("http://localhost/api/v1/offline-snapshot"), null, getDb());
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("returns only the current account data", async () => {
    const ownerA = `account-a-${crypto.randomUUID()}`;
    const { db } = await fixture(ownerA);
    try {
      const request = new Request("http://localhost/api/v1/offline-snapshot");
      const response = await createOfflineSnapshotResponse(request, { id: ownerA }, db);
      expect(response.status).toBe(200);
      expect((await response.json()).data.snapshot.userId).toBe(ownerA);
    } finally {
      await cleanup(db, ownerA);
    }
  });

  it("never leaks another account's rows, credential records, or storage URLs/keys", async () => {
    const ownerA = `account-a-${crypto.randomUUID()}`;
    const ownerB = `account-b-${crypto.randomUUID()}`;
    const { db, storageKey: storageKeyA } = await fixture(ownerA);
    const { storageKey: storageKeyB } = await fixture(ownerB);
    try {
      const response = await createOfflineSnapshotResponse(new Request("http://localhost/api/v1/offline-snapshot"), { id: ownerA }, db);
      const body = await response.json();
      const serialized = JSON.stringify(body.data.snapshot.data);

      expect(body.data.snapshot.data).toMatchObject({ activePlan: { id: `plan-${ownerA}` } });
      expect(body.data.snapshot.data.enduranceActivities).toMatchObject([{ id: `activity-${ownerA}` }]);
      expect(body.data.snapshot.data.activityMetrics).toMatchObject([{ activityId: `activity-${ownerA}` }]);
      expect(body.data.snapshot.data.performanceBaselines).toMatchObject([{ ownerId: ownerA, variantId: "squat-back" }]);
      expect(serialized).not.toContain(ownerB);
      expect(serialized).not.toContain(storageKeyA);
      expect(serialized).not.toContain(storageKeyB);
      expect(serialized).not.toContain("super-secret-hash");
      expect(serialized).not.toContain("signedUrl");
    } finally {
      await cleanup(db, ownerA);
      await cleanup(db, ownerB);
    }
  });
});
