import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { findOwnedProposal, saveOwnedProposal } from "@/features/planning/domain/plan-proposal-repository";
import * as schema from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE plan_proposal (id text primary key, owner_id text not null, proposal_json text not null, status text not null default 'pending', created_at integer not null);
  `);
  const now = Date.now();
  for (const id of ["account-a", "account-b"]) {
    sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, id, `${id}@example.test`, 1, null, now, now);
  }
  return drizzle(sqlite, { schema });
}

const proposal: PlanProposal = {
  proposalId: "proposal-a",
  ruleVersion: "plan-proposal-v1",
  reasons: [],
  alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
  week: { sessions: [] }
};

describe("plan proposal repository", () => {
  it("finds a proposal only for its owner", async () => {
    const db = fixture();
    await saveOwnedProposal(db, "account-a", proposal);

    expect((await findOwnedProposal(db, "account-a", "proposal-a"))?.ownerId).toBe("account-a");
    expect(await findOwnedProposal(db, "account-b", "proposal-a")).toBeUndefined();
  });

  it("is idempotent: resubmitting the same clientOperationId overwrites instead of duplicating", async () => {
    const db = fixture();
    await saveOwnedProposal(db, "account-a", proposal);
    await saveOwnedProposal(db, "account-a", { ...proposal, confidence: 0.9 });

    const rows = db.select().from(schema.planProposal).all();
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].proposalJson).confidence).toBe(0.9);
  });
});
