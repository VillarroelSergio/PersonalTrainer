import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { loadOwnedDraft, saveOwnedDraft } from "@/features/onboarding/domain/onboarding-draft-repository";
import { getDb } from "@/lib/db/client";
import { user } from "@/lib/db/schema";

async function fixtureOwner() {
  const db = getDb();
  const id = `account-${crypto.randomUUID()}`;
  const now = new Date();
  await db.insert(user).values({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  return { db, id };
}

describe("onboarding draft repository", () => {
  it("survives a reload by persisting each step and merging on top of the previous draft", async () => {
    const { db, id } = await fixtureOwner();
    await saveOwnedDraft(db, id, { goals: ["strength"] });
    await saveOwnedDraft(db, id, { heightCm: 178 });

    const draft = await loadOwnedDraft(db, id);
    expect(draft).toEqual({ goals: ["strength"], heightCm: 178 });

    await db.delete(user).where(eq(user.id, id));
  });

  it("keeps drafts isolated between accounts", async () => {
    const { db, id: ownerA } = await fixtureOwner();
    const { id: ownerB } = await fixtureOwner();
    await saveOwnedDraft(db, ownerA, { heightCm: 178 });

    expect(await loadOwnedDraft(db, ownerB)).toBeNull();

    await db.delete(user).where(eq(user.id, ownerA));
    await db.delete(user).where(eq(user.id, ownerB));
  });
});
