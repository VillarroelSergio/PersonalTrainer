import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { PLAN_TEMPLATES } from "@/features/planning/data/plan-templates";
import { deleteOwnedPlan, findOwnedPlan, renameOwnedPlan } from "@/features/planning/domain/training-plan-repository";
import { getDb } from "@/lib/db/client";
import { trainingPlan, user } from "@/lib/db/schema";

async function fixture() {
  const db = getDb();
  const suffix = crypto.randomUUID();
  const ownerA = `account-a-${suffix}`;
  const ownerB = `account-b-${suffix}`;
  const planA = `plan-a-${suffix}`;
  const now = new Date();
  await db.insert(user).values({ id: ownerA, name: "A", email: `${ownerA}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  await db.insert(user).values({ id: ownerB, name: "B", email: `${ownerB}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  await db.insert(trainingPlan).values({ id: planA, ownerId: ownerA, name: "Plan A", status: "draft", version: 1, contentJson: "{}", createdAt: now });
  return { db, ownerA, ownerB, planA };
}

async function cleanup(db: ReturnType<typeof getDb>, ...ownerIds: string[]) {
  for (const id of ownerIds) await db.delete(user).where(eq(user.id, id));
}

describe("training plan owner repository", () => {
  it("does not return or update another account's plan", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();
    expect(await findOwnedPlan(db, planA, ownerB)).toBeUndefined();
    expect(await renameOwnedPlan(db, planA, ownerB, "Intrusión")).toBeUndefined();
    expect((await findOwnedPlan(db, planA, ownerA))?.name).toBe("Plan A");

    await cleanup(db, ownerA, ownerB);
  });

  it("deletes only the authenticated owner's plan", async () => {
    const { db, ownerA, ownerB, planA } = await fixture();

    expect(await deleteOwnedPlan(db, planA, ownerB)).toBe(false);
    expect(await findOwnedPlan(db, planA, ownerA)).toBeDefined();

    expect(await deleteOwnedPlan(db, planA, ownerA)).toBe(true);
    expect(await findOwnedPlan(db, planA, ownerA)).toBeUndefined();

    await cleanup(db, ownerA, ownerB);
  });

  it("keeps an activated template copy's content unchanged when the library template is updated afterwards", async () => {
    const db = getDb();
    const ownerA = `account-a-${crypto.randomUUID()}`;
    const planId = `plan-template-copy-${ownerA}`;
    const now = new Date();
    await db.insert(user).values({ id: ownerA, name: "A", email: `${ownerA}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });

    const template = PLAN_TEMPLATES.find((candidate) => candidate.templateId === "full-body-gym")!;
    const originalVersion = template.versions.find((candidate) => candidate.version === "1.0.0")!;
    // The snapshot is taken (and persisted) at activation time, matching what activation.ts does with contentJson.
    const snapshotAtActivation = JSON.stringify(originalVersion.content);
    await db.insert(trainingPlan).values({
      id: planId, ownerId: ownerA, name: "Plan activo", status: "active", version: 1, contentJson: snapshotAtActivation, createdAt: now,
      source: "template", sourceTemplateId: template.templateId, sourceTemplateVersion: originalVersion.version, catalogVersion: originalVersion.catalogVersion
    });

    // A newer library version is published afterwards (mutating the in-memory catalog, as a real
    // content update to plan-templates.ts would).
    template.versions.push({ ...originalVersion, version: "2.0.0", content: { ...originalVersion.content, blockBlueprints: [] } });

    const activated = await findOwnedPlan(db, planId, ownerA);
    expect(activated?.contentJson).toBe(snapshotAtActivation);
    expect(activated?.sourceTemplateVersion).toBe("1.0.0");

    await cleanup(db, ownerA);
  });
});
