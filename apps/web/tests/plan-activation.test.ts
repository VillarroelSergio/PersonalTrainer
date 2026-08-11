import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { createActivation, ProposalNotFoundError } from "@/features/planning/domain/activation";
import * as schema from "@/lib/db/schema";

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null);
    CREATE TABLE plan_proposal (id text primary key, owner_id text not null, proposal_json text not null, status text not null default 'pending', created_at integer not null);
  `);
  const now = Date.now();
  for (const id of ["account-a", "account-b"]) {
    sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, id, `${id}@example.test`, 1, null, now, now);
  }
  sqlite.prepare("INSERT INTO plan_proposal VALUES (?, ?, ?, ?, ?)").run("proposal-a", "account-a", JSON.stringify({ week: { sessions: [] } }), "pending", now);
  sqlite.prepare("INSERT INTO training_plan VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-old", "account-a", "Plan viejo", "active", 1, "{}", now);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

describe("createActivation", () => {
  it("archives the previous active plan and activates the new proposal for its owner", () => {
    const { db, sqlite } = fixture();
    const activateOwnedProposal = createActivation(db, sqlite);

    const result = activateOwnedProposal("account-a", "proposal-a");

    expect(result.ownerId).toBe("account-a");
    const plans = sqlite.prepare("SELECT id, status FROM training_plan WHERE owner_id = ? ORDER BY id").all("account-a") as Array<{ id: string; status: string }>;
    expect(plans.find((plan) => plan.id === "plan-old")?.status).toBe("archived");
    expect(plans.find((plan) => plan.id === result.id)?.status).toBe("active");
    const proposal = sqlite.prepare("SELECT status FROM plan_proposal WHERE id = ?").get("proposal-a") as { status: string };
    expect(proposal.status).toBe("activated");
  });

  it("does not activate another account's proposal and leaves no partial state", () => {
    const { db, sqlite } = fixture();
    const activateOwnedProposal = createActivation(db, sqlite);

    expect(() => activateOwnedProposal("account-b", "proposal-a")).toThrow(ProposalNotFoundError);
    const plans = sqlite.prepare("SELECT status FROM training_plan WHERE owner_id = ?").all("account-b") as Array<{ status: string }>;
    expect(plans).toHaveLength(0);
    const ownerAPlans = sqlite.prepare("SELECT status FROM training_plan WHERE owner_id = ?").all("account-a") as Array<{ status: string }>;
    expect(ownerAPlans).toEqual([{ status: "active" }]);
  });
});
