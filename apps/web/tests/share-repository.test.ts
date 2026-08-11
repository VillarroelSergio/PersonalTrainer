import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { createShareCopyRepository, createShareLink, previewSharedRoutine, revokeOwnedShareLink, ShareLinkNotFoundError } from "@/features/planning/domain/share-repository";
import * as schema from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

const proposal: PlanProposal = {
  proposalId: "proposal-a",
  ruleVersion: "plan-proposal-v1",
  reasons: [],
  alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
  week: { sessions: [{ day: "monday", kind: "strength", title: "Fuerza: piernas", estimatedMinutes: 60, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] }] }
};

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null);
    CREATE TABLE share_link (id text primary key, owner_id text not null, plan_id text not null, created_at integer not null, revoked_at integer);
    CREATE TABLE share_copy (id text primary key, share_link_id text not null, copied_by_owner_id text not null, copied_plan_id text not null, created_at integer not null);
  `);
  const now = Date.now();
  for (const id of ["account-a", "account-b"]) {
    sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, id, `${id}@example.test`, 1, null, now, now);
  }
  sqlite.prepare("INSERT INTO training_plan VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, JSON.stringify(proposal), now);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

describe("share-repository", () => {
  it("creates an independent copy that never links back to the origin's loads, history, or later edits", async () => {
    const { db, sqlite } = fixture();
    const { token } = await createShareLink(db, "account-a", "plan-a");

    const preview = await previewSharedRoutine(db, token);
    expect(preview.planName).toBe("Plan A");
    expect(preview.sessionCount).toBe(1);
    expect(preview).not.toHaveProperty("ownerId");
    expect(preview).not.toHaveProperty("loads");

    const copyRepo = createShareCopyRepository(db, sqlite);
    const { planId: copiedPlanId } = copyRepo.copySharedRoutine(token, "account-b");
    expect(copiedPlanId).not.toBe("plan-a");

    const copiedRow = sqlite.prepare("SELECT owner_id, content_json, status FROM training_plan WHERE id = ?").get(copiedPlanId) as { owner_id: string; content_json: string; status: string };
    expect(copiedRow.owner_id).toBe("account-b");
    expect(copiedRow.status).toBe("active");
    expect(JSON.parse(copiedRow.content_json)).toEqual(proposal);

    // Editing the origin afterwards never touches the already-made copy.
    sqlite.prepare("UPDATE training_plan SET content_json = ? WHERE id = ?").run(JSON.stringify({ ...proposal, initialBlock: { ...proposal.initialBlock, name: "Bloque cambiado" } }), "plan-a");
    const stillOriginal = sqlite.prepare("SELECT content_json FROM training_plan WHERE id = ?").get(copiedPlanId) as { content_json: string };
    expect(JSON.parse(stillOriginal.content_json).initialBlock.name).toBe("Bloque");
  });

  it("archives the copier's previous active plan, same invariant as activating a proposal", async () => {
    const { db, sqlite } = fixture();
    const now = Date.now();
    sqlite.prepare("INSERT INTO training_plan VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-b-old", "account-b", "Plan viejo de B", "active", 1, "{}", now);
    const { token } = await createShareLink(db, "account-a", "plan-a");

    const copyRepo = createShareCopyRepository(db, sqlite);
    copyRepo.copySharedRoutine(token, "account-b");

    const old = sqlite.prepare("SELECT status FROM training_plan WHERE id = ?").get("plan-b-old") as { status: string };
    expect(old.status).toBe("archived");
    const activeCount = sqlite.prepare("SELECT COUNT(*) as n FROM training_plan WHERE owner_id = 'account-b' AND status = 'active'").get() as { n: number };
    expect(activeCount.n).toBe(1);
  });

  it("a revoked link can no longer be previewed or copied", async () => {
    const { db, sqlite } = fixture();
    const { token } = await createShareLink(db, "account-a", "plan-a");
    const created = await db.query.shareLink.findFirst({ where: (row, { eq }) => eq(row.id, token) });
    await revokeOwnedShareLink(db, "account-a", created!.id);

    await expect(previewSharedRoutine(db, token)).rejects.toThrow(ShareLinkNotFoundError);
    const copyRepo = createShareCopyRepository(db, sqlite);
    expect(() => copyRepo.copySharedRoutine(token, "account-b")).toThrow(ShareLinkNotFoundError);
  });
});
