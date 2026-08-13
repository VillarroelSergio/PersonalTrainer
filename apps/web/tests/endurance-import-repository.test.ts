import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DuplicateNotForcedError,
  ImportFileNotFoundError,
  ImportNotReadyError,
  SessionNotEnduranceError,
  createActivityImportRepository
} from "@/features/endurance/domain/import-repository";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

vi.mock("@supabase/supabase-js", () => {
  const upload = vi.fn(async (path: string) => ({ data: { id: "1", path, fullPath: path }, error: null }));
  const remove = vi.fn(async () => ({ data: [], error: null }));
  return { createClient: vi.fn(() => ({ storage: { from: vi.fn(() => ({ upload, remove })) } })) };
});

const proposal: PlanProposal = {
  proposalId: "proposal-a",
  ruleVersion: "plan-proposal-v1",
  reasons: [],
  alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Fuerza: piernas", estimatedMinutes: 60, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] },
      { day: "tuesday", kind: "endurance", title: "Carrera suave", estimatedMinutes: 40 }
    ]
  }
};

const VALID_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx><trk><type>running</type><trkseg>
  <trkpt lat="40.0000" lon="-3.0000"><ele>600</ele><time>2026-08-10T08:00:00Z</time></trkpt>
  <trkpt lat="40.0100" lon="-3.0000"><ele>610</ele><time>2026-08-10T08:20:00Z</time></trkpt>
</trkseg></trk></gpx>`;

// Same start-minute and duration-minute as VALID_GPX, so its fingerprint matches after commit — used to exercise duplicate detection.
const VALID_GPX_SAME_ACTIVITY = `<?xml version="1.0" encoding="UTF-8"?>
<gpx><trk><type>running</type><trkseg>
  <trkpt lat="41.0000" lon="-4.0000"><ele>500</ele><time>2026-08-10T08:00:05Z</time></trkpt>
  <trkpt lat="41.0200" lon="-4.0000"><ele>520</ele><time>2026-08-10T08:20:05Z</time></trkpt>
</trkseg></trk></gpx>`;

const createdOwnerIds: string[] = [];

async function fixture() {
  const db = getDb();
  const ownerId = crypto.randomUUID();
  createdOwnerIds.push(ownerId);
  const now = new Date();
  await db.insert(schema.user).values({ id: ownerId, name: ownerId, email: `${ownerId}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  const planId = crypto.randomUUID();
  await db.insert(schema.trainingPlan).values({ id: planId, ownerId, name: "Plan A", status: "active", version: 1, contentJson: JSON.stringify(proposal), createdAt: now });
  return { db, ownerId, planId };
}

afterEach(async () => {
  const db = getDb();
  // Cascades to training_plan/import_file/activity_import/endurance_activity/activity_metric.
  while (createdOwnerIds.length) {
    const ownerId = createdOwnerIds.pop()!;
    await db.delete(schema.user).where(eq(schema.user.id, ownerId));
  }
});

describe("activity import repository", () => {
  it("analyzes a valid GPX upload and re-uploading the exact same bytes is idempotent (never re-parses, never duplicates the row)", async () => {
    const { db, ownerId } = await fixture();
    const repo = createActivityImportRepository(db);
    const bytes = Buffer.from(VALID_GPX, "utf-8");

    const first = await repo.uploadAndAnalyze(ownerId, "carrera.gpx", bytes);
    expect(first.status).toBe("analyzed");

    const second = await repo.uploadAndAnalyze(ownerId, "carrera.gpx", bytes);
    expect(second.id).toBe(first.id);

    const files = await db.select().from(schema.importFile).where(eq(schema.importFile.ownerId, ownerId));
    expect(files).toHaveLength(1);
    const imports = await db.select().from(schema.activityImport).where(eq(schema.activityImport.ownerId, ownerId));
    expect(imports).toHaveLength(1);
  });

  it("rejects an unsupported extension before touching storage or the database", async () => {
    const { db, ownerId } = await fixture();
    const repo = createActivityImportRepository(db);
    await expect(repo.uploadAndAnalyze(ownerId, "carrera.csv", Buffer.from("x"))).rejects.toThrow();
    expect(await db.select().from(schema.importFile).where(eq(schema.importFile.ownerId, ownerId))).toHaveLength(0);
  });

  it("stores an invalid (right extension, corrupt content) file as status failed, not a thrown error", async () => {
    const { db, ownerId } = await fixture();
    const repo = createActivityImportRepository(db);
    const result = await repo.uploadAndAnalyze(ownerId, "corrupto.gpx", Buffer.from("<gpx>not valid</gpx", "utf-8"));
    expect(result.status).toBe("failed");
  });

  it("commits an analyzed import into a real endurance_activity + activity_metric rows and marks the import saved", async () => {
    const { db, ownerId } = await fixture();
    const repo = createActivityImportRepository(db);
    const uploaded = await repo.uploadAndAnalyze(ownerId, "carrera.gpx", Buffer.from(VALID_GPX, "utf-8"));

    const result = await repo.commit(ownerId, uploaded.id, { name: "Carrera del martes", sport: "running", isoWeekStart: "2026-08-10", sessionIndex: 1 });
    expect(result.activity.name).toBe("Carrera del martes");
    expect(result.activity.sessionIndex).toBe(1);

    const savedImport = (await db.select().from(schema.activityImport).where(eq(schema.activityImport.id, uploaded.id))).at(0);
    expect(savedImport?.status).toBe("saved");
  });

  it("refuses to associate a commit with a strength session", async () => {
    const { db, ownerId } = await fixture();
    const repo = createActivityImportRepository(db);
    const uploaded = await repo.uploadAndAnalyze(ownerId, "carrera.gpx", Buffer.from(VALID_GPX, "utf-8"));
    await expect(repo.commit(ownerId, uploaded.id, { name: "x", sport: "running", isoWeekStart: "2026-08-10", sessionIndex: 0 })).rejects.toThrow(SessionNotEnduranceError);
  });

  it("a second activity that fingerprints the same as an already-saved one is flagged duplicate and never silently double-counted", async () => {
    const { db, ownerId } = await fixture();
    const repo = createActivityImportRepository(db);

    const uploaded1 = await repo.uploadAndAnalyze(ownerId, "carrera-1.gpx", Buffer.from(VALID_GPX, "utf-8"));
    await repo.commit(ownerId, uploaded1.id, { name: "Carrera", sport: "running" });

    const uploaded2 = await repo.uploadAndAnalyze(ownerId, "carrera-2.gpx", Buffer.from(VALID_GPX_SAME_ACTIVITY, "utf-8"));
    expect(uploaded2.status).toBe("duplicate");

    await expect(repo.commit(ownerId, uploaded2.id, { name: "Carrera otra vez", sport: "running" })).rejects.toThrow(DuplicateNotForcedError);
    expect(await db.select().from(schema.enduranceActivity).where(eq(schema.enduranceActivity.ownerId, ownerId))).toHaveLength(1);

    const forced = await repo.commit(ownerId, uploaded2.id, { name: "Carrera otra vez", sport: "running", force: true });
    expect(forced.activity.id).not.toBe(uploaded1.id);
    expect(await db.select().from(schema.enduranceActivity).where(eq(schema.enduranceActivity.ownerId, ownerId))).toHaveLength(2);
  });

  it("refuses to commit an import that failed to parse", async () => {
    const { db, ownerId } = await fixture();
    const repo = createActivityImportRepository(db);
    const failed = await repo.uploadAndAnalyze(ownerId, "corrupto.gpx", Buffer.from("<gpx>not valid</gpx", "utf-8"));
    await expect(repo.commit(ownerId, failed.id, { name: "x", sport: "running" })).rejects.toThrow(ImportNotReadyError);
  });

  it("deletes the raw file's bytes and marks it deleted, but keeps the committed activity in history", async () => {
    const { db, ownerId } = await fixture();
    const repo = createActivityImportRepository(db);
    const uploaded = await repo.uploadAndAnalyze(ownerId, "carrera.gpx", Buffer.from(VALID_GPX, "utf-8"));
    await repo.commit(ownerId, uploaded.id, { name: "Carrera", sport: "running" });

    const fileRow = (await db.select({ id: schema.importFile.id, deletedAt: schema.importFile.deletedAt }).from(schema.importFile).where(eq(schema.importFile.ownerId, ownerId))).at(0)!;
    expect(fileRow.deletedAt).toBeNull();

    await repo.deleteImportFile(ownerId, fileRow.id);

    const afterDelete = (await db.select({ deletedAt: schema.importFile.deletedAt }).from(schema.importFile).where(eq(schema.importFile.id, fileRow.id))).at(0)!;
    expect(afterDelete.deletedAt).not.toBeNull();
    expect(await db.select().from(schema.enduranceActivity).where(eq(schema.enduranceActivity.ownerId, ownerId))).toHaveLength(1);

    await expect(repo.deleteImportFile(ownerId, fileRow.id)).rejects.toThrow(ImportFileNotFoundError);
    await expect(repo.deleteImportFile("account-b-does-not-exist", fileRow.id)).rejects.toThrow(ImportFileNotFoundError);
  });
});
