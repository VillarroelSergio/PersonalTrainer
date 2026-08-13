import { and, desc, eq } from "drizzle-orm";
import type Database from "better-sqlite3";
import type { db as productionDb } from "@/lib/db/client";
import { activityImport, activityMetric, enduranceActivity, importFile, trainingPlan } from "@/lib/db/schema";
import type { CommitImportInput, ParsedActivity } from "@/contracts/endurance";
import type { PlanProposal } from "@/contracts/onboarding";
import { formatFromFilename, parseActivityFile } from "./parsers";
import { FileTooLargeError } from "./parsers/errors";
import { deleteUploadedFile, MAX_UPLOAD_BYTES, saveUploadedFile, sha256Hex } from "./storage";

type Db = typeof productionDb;

export class ImportNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Activity import not found."); }
}
export class ImportNotReadyError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor(status: string) { super(`This import cannot be committed from status "${status}".`); }
}
export class DuplicateNotForcedError extends Error {
  code = "VALIDATION_ERROR" as const;
  duplicateOfActivityId: string;
  constructor(duplicateOfActivityId: string) { super("A similar activity already exists. Pass force:true to import anyway."); this.duplicateOfActivityId = duplicateOfActivityId; }
}
export class SessionNotEnduranceError extends Error {
  code = "VALIDATION_ERROR" as const;
  constructor() { super("The requested session is not an endurance session."); }
}
export class ImportFileNotFoundError extends Error {
  code = "NOT_FOUND" as const;
  constructor() { super("Import file not found, or already deleted."); }
}

/** Rounds start-time to the minute and duration to the minute: two exports of the same real workout (e.g. re-saved from two apps) rarely match to the second, but do match at this grain. Soft signal only — see DuplicateNotForcedError. */
function computeFingerprint(sport: string, startedAtIso: string, durationS: number | null): string {
  const startedMinute = Math.floor(new Date(startedAtIso).getTime() / 60000);
  const durationMinute = durationS != null ? Math.round(durationS / 60) : "?";
  return `${sport}|${startedMinute}|${durationMinute}`;
}

export function createActivityImportRepository(database: Db, sqliteHandle: Database.Database) {
  const runUpload = sqliteHandle.transaction((ownerId: string, originalName: string, bytes: Buffer) => {
    if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new FileTooLargeError(MAX_UPLOAD_BYTES);
    const format = formatFromFilename(originalName); // throws UnsupportedFormatError for a bad extension

    const sha256 = sha256Hex(bytes);
    let fileRow = database.select().from(importFile).where(and(eq(importFile.ownerId, ownerId), eq(importFile.sha256, sha256))).get();
    if (!fileRow) {
      const storageKey = saveUploadedFile(bytes, format);
      const id = crypto.randomUUID();
      const now = new Date();
      database.insert(importFile).values({ id, ownerId, storageKey, originalName, format, sizeBytes: bytes.byteLength, sha256, uploadedAt: now, deletedAt: null }).run();
      fileRow = { id, ownerId, storageKey, originalName, format, sizeBytes: bytes.byteLength, sha256, uploadedAt: now, deletedAt: null };
    }

    // Byte-identical re-upload with an existing analysis: never re-parse, just hand back the same import (idempotent).
    const existingImport = database.select().from(activityImport).where(and(eq(activityImport.ownerId, ownerId), eq(activityImport.fileId, fileRow.id))).orderBy(desc(activityImport.createdAt)).get();
    if (existingImport) return existingImport;

    const importId = crypto.randomUUID();
    const now = new Date();
    let status: string;
    let errorCode: string | null = null;
    let analysisJson: string | null = null;
    let duplicateOfActivityId: string | null = null;

    try {
      const parsed = parseActivityFile(format, bytes);
      const fingerprint = computeFingerprint(parsed.sport, parsed.startedAt, parsed.durationS);
      const match = database.select({ id: enduranceActivity.id }).from(enduranceActivity).where(and(eq(enduranceActivity.ownerId, ownerId), eq(enduranceActivity.fingerprint, fingerprint))).get();
      analysisJson = JSON.stringify(parsed);
      if (match) { status = "duplicate"; duplicateOfActivityId = match.id; } else { status = "analyzed"; }
    } catch (cause) {
      status = "failed";
      errorCode = cause instanceof Error && "code" in cause ? String((cause as { code: unknown }).code) : "VALIDATION_ERROR";
      analysisJson = JSON.stringify({ message: cause instanceof Error ? cause.message : "No se pudo interpretar el archivo." });
    }

    database.insert(activityImport).values({ id: importId, ownerId, fileId: fileRow.id, format, status, errorCode, analysisJson, duplicateOfActivityId, createdAt: now }).run();
    return database.select().from(activityImport).where(eq(activityImport.id, importId)).get()!;
  });

  const runCommit = sqliteHandle.transaction((ownerId: string, importId: string, input: CommitImportInput) => {
    const importRow = database.select().from(activityImport).where(and(eq(activityImport.id, importId), eq(activityImport.ownerId, ownerId))).get();
    if (!importRow) throw new ImportNotFoundError();
    if (importRow.status === "duplicate" && !input.force) throw new DuplicateNotForcedError(importRow.duplicateOfActivityId!);
    if (importRow.status !== "analyzed" && importRow.status !== "duplicate") throw new ImportNotReadyError(importRow.status);

    const parsed = JSON.parse(importRow.analysisJson!) as ParsedActivity;

    let planId: string | null = null;
    if (input.isoWeekStart && input.sessionIndex != null) {
      const plan = database.select().from(trainingPlan).where(and(eq(trainingPlan.ownerId, ownerId), eq(trainingPlan.status, "active"))).get();
      if (plan) {
        const proposal = JSON.parse(plan.contentJson) as PlanProposal;
        const plannedSession = proposal.week?.sessions?.[input.sessionIndex];
        if (!plannedSession || plannedSession.kind !== "endurance") throw new SessionNotEnduranceError();
        planId = plan.id;
      }
    }

    const activityId = crypto.randomUUID();
    const now = new Date();
    const fingerprint = computeFingerprint(input.sport, parsed.startedAt, parsed.durationS);
    database
      .insert(enduranceActivity)
      .values({
        id: activityId, ownerId, importId, planId,
        isoWeekStart: planId ? input.isoWeekStart : null, sessionIndex: planId ? input.sessionIndex : null,
        sport: input.sport, name: input.name, source: "imported", fingerprint,
        startedAt: new Date(parsed.startedAt), durationS: parsed.durationS, distanceM: parsed.distanceM, createdAt: now
      })
      .run();

    for (const metric of parsed.metrics) {
      database.insert(activityMetric).values({ id: crypto.randomUUID(), activityId, metricType: metric.metricType, value: metric.value, unit: metric.unit, source: "file" }).run();
    }

    database.update(activityImport).set({ status: "saved" }).where(eq(activityImport.id, importId)).run();

    return {
      activity: database.select().from(enduranceActivity).where(eq(enduranceActivity.id, activityId)).get()!,
      metrics: database.select().from(activityMetric).where(eq(activityMetric.activityId, activityId)).all()
    };
  });

  /**
   * Minimal retention: deletes the raw uploaded bytes and marks the row
   * deleted, but never touches the derived `activity_import`/
   * `endurance_activity`/`activity_metric` rows — the analysis already ran
   * and lives independently in `analysisJson`/the committed activity, so
   * history stays intact after the source file is gone.
   */
  const runDeleteFile = sqliteHandle.transaction((ownerId: string, fileId: string) => {
    const fileRow = database.select().from(importFile).where(and(eq(importFile.id, fileId), eq(importFile.ownerId, ownerId))).get();
    if (!fileRow || fileRow.deletedAt) throw new ImportFileNotFoundError();
    deleteUploadedFile(fileRow.storageKey);
    database.update(importFile).set({ deletedAt: new Date() }).where(eq(importFile.id, fileId)).run();
  });

  return {
    uploadAndAnalyze: (ownerId: string, originalName: string, bytes: Buffer) => runUpload(ownerId, originalName, bytes),
    getImport: (ownerId: string, importId: string) => database.select().from(activityImport).where(and(eq(activityImport.id, importId), eq(activityImport.ownerId, ownerId))).get(),
    commit: (ownerId: string, importId: string, input: CommitImportInput) => runCommit(ownerId, importId, input),
    deleteImportFile: (ownerId: string, fileId: string) => runDeleteFile(ownerId, fileId)
  };
}
