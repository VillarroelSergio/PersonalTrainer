import { and, eq, isNull } from "drizzle-orm";
import type Database from "better-sqlite3";
import type { db as productionDb } from "@/lib/db/client";
import { shareCopy, shareLink, trainingPlan } from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

type Db = typeof productionDb;

export class PlanNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Training plan not found."); }
}
export class ShareLinkNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Share link not found, revoked, or expired."); }
}

/** Structure only — no loads, no history, no future edits of the origin. Matches FUNCTIONAL-SPECIFICATION.md §9: "Compartir genera una copia independiente: jamás comparte cargas, historial ni cambios posteriores." content_json never stores loads (those live in set_performance/performance_baseline, owner-scoped tables this never touches), so copying it verbatim is already safe. */
export async function createShareLink(database: Db, ownerId: string, planId: string) {
  const plan = await database.query.trainingPlan.findFirst({ where: and(eq(trainingPlan.id, planId), eq(trainingPlan.ownerId, ownerId)) });
  if (!plan) throw new PlanNotFoundError();

  const id = crypto.randomUUID();
  await database.insert(shareLink).values({ id, ownerId, planId, createdAt: new Date() });
  return { token: id };
}

/** Scoped by owner id: only the account that created a link can list or revoke it. */
export async function listOwnedShareLinks(database: Db, ownerId: string) {
  return database.query.shareLink.findMany({ where: eq(shareLink.ownerId, ownerId), orderBy: (row, { desc }) => desc(row.createdAt) });
}

export async function revokeOwnedShareLink(database: Db, ownerId: string, linkId: string) {
  const [updated] = await database.update(shareLink).set({ revokedAt: new Date() }).where(and(eq(shareLink.id, linkId), eq(shareLink.ownerId, ownerId), isNull(shareLink.revokedAt))).returning();
  if (!updated) throw new ShareLinkNotFoundError();
}

export type SharedRoutinePreview = { planName: string; initialBlock: PlanProposal["initialBlock"]; sessionCount: number };

/** Never exposes the origin owner's identity, loads, or history — only the plan's structure. */
export async function previewSharedRoutine(database: Db, token: string): Promise<SharedRoutinePreview> {
  const link = await database.query.shareLink.findFirst({ where: and(eq(shareLink.id, token), isNull(shareLink.revokedAt)) });
  if (!link) throw new ShareLinkNotFoundError();
  const plan = await database.query.trainingPlan.findFirst({ where: eq(trainingPlan.id, link.planId) });
  if (!plan) throw new ShareLinkNotFoundError();

  const content = JSON.parse(plan.contentJson) as PlanProposal;
  return { planName: plan.name, initialBlock: content.initialBlock, sessionCount: content.week?.sessions?.length ?? 0 };
}

/**
 * All writes wrapped in better-sqlite3's synchronous `.transaction()` (see
 * activation.ts for why), built from injected `database`/`sqliteHandle` so
 * tests can use an in-memory database. Archiving the copier's previous
 * active plan mirrors createActivation(): "only one active plan per owner"
 * is an invariant this repository never breaks either.
 */
export function createShareCopyRepository(database: Db, sqliteHandle: Database.Database) {
  const runCopy = sqliteHandle.transaction((token: string, copyingOwnerId: string) => {
    const link = database.select().from(shareLink).where(and(eq(shareLink.id, token), isNull(shareLink.revokedAt))).get();
    if (!link) throw new ShareLinkNotFoundError();
    const originPlan = database.select().from(trainingPlan).where(eq(trainingPlan.id, link.planId)).get();
    if (!originPlan) throw new ShareLinkNotFoundError();

    database.update(trainingPlan).set({ status: "archived" }).where(and(eq(trainingPlan.ownerId, copyingOwnerId), eq(trainingPlan.status, "active"))).run();

    const copiedPlanId = crypto.randomUUID();
    database.insert(trainingPlan).values({ id: copiedPlanId, ownerId: copyingOwnerId, name: originPlan.name, status: "active", version: 1, contentJson: originPlan.contentJson, createdAt: new Date() }).run();
    database.insert(shareCopy).values({ id: crypto.randomUUID(), shareLinkId: link.id, copiedByOwnerId: copyingOwnerId, copiedPlanId, createdAt: new Date() }).run();

    return { planId: copiedPlanId };
  });

  return { copySharedRoutine: (token: string, copyingOwnerId: string) => runCopy(token, copyingOwnerId) };
}
