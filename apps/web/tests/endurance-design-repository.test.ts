import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { ActivePlanNotFoundError, SessionNotEnduranceError, createEnduranceDesignRepository } from "@/features/endurance/domain/design-repository";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

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

const createdOwnerIds: string[] = [];

async function fixture(withPlan = true) {
  const db = getDb();
  const ownerId = crypto.randomUUID();
  createdOwnerIds.push(ownerId);
  const now = new Date();
  await db.insert(schema.user).values({ id: ownerId, name: ownerId, email: `${ownerId}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  if (withPlan) {
    await db.insert(schema.trainingPlan).values({ id: crypto.randomUUID(), ownerId, name: "Plan A", status: "active", version: 1, contentJson: JSON.stringify(proposal), createdAt: now });
  }
  return { db, ownerId };
}

afterEach(async () => {
  const db = getDb();
  // Cascades to training_plan/endurance_session_design.
  while (createdOwnerIds.length) {
    const ownerId = createdOwnerIds.pop()!;
    await db.delete(schema.user).where(eq(schema.user.id, ownerId));
  }
});

describe("endurance design repository", () => {
  it("saves a block design for an endurance occurrence and re-saving the same occurrence overwrites instead of duplicating", async () => {
    const { db, ownerId } = await fixture();
    const repo = createEnduranceDesignRepository(db);

    const first = await repo.saveDesign(ownerId, { isoWeekStart: "2026-08-10", sessionIndex: 1, objective: "intervals", environment: "outdoors" });
    expect(first.objective).toBe("intervals");

    const second = await repo.saveDesign(ownerId, { isoWeekStart: "2026-08-10", sessionIndex: 1, objective: "base", environment: "treadmill" });
    expect(second.id).toBe(first.id);
    expect(second.objective).toBe("base");

    const all = await db.select().from(schema.enduranceSessionDesign).where(eq(schema.enduranceSessionDesign.ownerId, ownerId));
    expect(all).toHaveLength(1);
  });

  it("refuses to attach a design to a strength session", async () => {
    const { db, ownerId } = await fixture();
    const repo = createEnduranceDesignRepository(db);
    await expect(repo.saveDesign(ownerId, { isoWeekStart: "2026-08-10", sessionIndex: 0, objective: "base" })).rejects.toThrow(SessionNotEnduranceError);
  });

  it("requires an active plan", async () => {
    const { db, ownerId } = await fixture(false);
    const repo = createEnduranceDesignRepository(db);
    await expect(repo.saveDesign(ownerId, { isoWeekStart: "2026-08-10", sessionIndex: 1, objective: "base" })).rejects.toThrow(ActivePlanNotFoundError);
  });

  it("confirming watch prep sets a timestamp, and a fresh save resets it (the blocks may have changed)", async () => {
    const { db, ownerId } = await fixture();
    const repo = createEnduranceDesignRepository(db);
    const design = await repo.saveDesign(ownerId, { isoWeekStart: "2026-08-10", sessionIndex: 1, objective: "base" });
    expect(design.watchPreparedAt).toBeNull();

    const confirmed = await repo.confirmWatchPrep(ownerId, design.id);
    expect(confirmed.watchPreparedAt).toBeInstanceOf(Date);

    const resaved = await repo.saveDesign(ownerId, { isoWeekStart: "2026-08-10", sessionIndex: 1, objective: "long_run" });
    expect(resaved.watchPreparedAt).toBeNull();
  });
});
