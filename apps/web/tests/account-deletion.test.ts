import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { deleteOwnAccount } from "@/features/account/domain/account-deletion";
import { saveUploadedFile } from "@/features/endurance/domain/storage";
import { getDb } from "@/lib/db/client";
import { importFile, session, trainingPlan, user, workoutSession } from "@/lib/db/schema";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

const uploadedKeys = new Set<string>();
const upload = vi.fn(async (path: string) => { uploadedKeys.add(path); return { data: { id: "1", path, fullPath: path }, error: null }; });
const remove = vi.fn(async (paths: string[]) => { paths.forEach((p) => uploadedKeys.delete(p)); return { data: [], error: null }; });
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn(() => ({ upload, remove })) } }))
}));

async function fixture() {
  const db = getDb();
  const now = new Date();
  const ownerA = `account-a-${crypto.randomUUID()}`;
  const ownerB = `account-b-${crypto.randomUUID()}`;
  for (const id of [ownerA, ownerB]) {
    await db.insert(user).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  }
  await db.insert(trainingPlan).values({ id: `plan-a-${ownerA}`, ownerId: ownerA, name: "Plan A", status: "active", version: 1, contentJson: "{}", createdAt: now });
  await db.insert(trainingPlan).values({ id: `plan-b-${ownerB}`, ownerId: ownerB, name: "Plan B", status: "active", version: 1, contentJson: "{}", createdAt: now });
  await db.insert(workoutSession).values({ id: `session-a-${ownerA}`, ownerId: ownerA, planId: `plan-a-${ownerA}`, sessionIndex: 0, status: "completed", version: 2, startedAt: now, endedAt: now, globalEffort: 7, createdAt: now });
  await db.insert(session).values({ id: `auth-session-${ownerA}`, expiresAt: new Date(now.getTime() + 86_400_000), token: `token-${ownerA}`, createdAt: now, updatedAt: now, userId: ownerA });
  return { db, ownerA, ownerB };
}

describe("deleteOwnAccount", () => {
  it("cascades to every owned row and unlinks any remaining private upload bytes, without touching another account", async () => {
    const { db, ownerA, ownerB } = await fixture();
    const storageKey = await saveUploadedFile(ownerA, Buffer.from("fit-bytes"), "fit");
    await db.insert(importFile).values({ id: `file-a-${ownerA}`, ownerId: ownerA, storageKey, originalName: "carrera.fit", format: "fit", sizeBytes: 9, sha256: `hash-${ownerA}`, uploadedAt: new Date() });
    expect(uploadedKeys.has(storageKey)).toBe(true);

    await deleteOwnAccount(db, ownerA);

    expect(await db.select().from(user).where(eq(user.id, ownerA))).toHaveLength(0);
    expect(await db.select().from(trainingPlan).where(eq(trainingPlan.ownerId, ownerA))).toHaveLength(0);
    expect(await db.select().from(workoutSession).where(eq(workoutSession.ownerId, ownerA))).toHaveLength(0);
    expect(await db.select().from(importFile).where(eq(importFile.ownerId, ownerA))).toHaveLength(0);
    expect(await db.select().from(session).where(eq(session.userId, ownerA))).toHaveLength(0);
    expect(uploadedKeys.has(storageKey)).toBe(false);
    expect(remove).toHaveBeenCalledWith([storageKey]);

    expect(await db.select().from(user).where(eq(user.id, ownerB))).toHaveLength(1);
    expect(await db.select().from(trainingPlan).where(eq(trainingPlan.ownerId, ownerB))).toHaveLength(1);

    await db.delete(user).where(eq(user.id, ownerB));
  });
});
