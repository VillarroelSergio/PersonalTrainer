import { and, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/lib/db/schema";
import { activityImport, activityMetric, enduranceActivity, importFile, trainingPlan } from "@/lib/db/schema";
import type { CommitImportInput, ParsedActivity } from "@/contracts/endurance";
import type { PlanProposal } from "@/contracts/onboarding";
import { formatFromFilename, parseActivityFile } from "./parsers";
import { FileTooLargeError } from "./parsers/errors";
import { deleteUploadedFile, MAX_UPLOAD_BYTES, saveUploadedFile, sha256Hex } from "./storage";

type Db = PostgresJsDatabase<typeof schema>;

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

type ImportFileRow = typeof importFile.$inferSelect;

export function createActivityImportRepository(database: Db) {
  /** Dedupe-by-sha256: reuses an existing `import_file` row for byte-identical content, otherwise inserts one under `storageKey` (calling `getStorageKey` lazily — only when actually needed — so the caller controls whether that means "upload now" or "already uploaded, just record it"). */
  async function findOrCreateFileRow(
    tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
    ownerId: string,
    originalName: string,
    format: string,
    bytes: Buffer,
    sha256: string,
    getStorageKey: () => Promise<string>
  ): Promise<ImportFileRow> {
    const existing = (await tx.select().from(importFile).where(and(eq(importFile.ownerId, ownerId), eq(importFile.sha256, sha256)))).at(0);
    if (existing) return existing;
    const storageKey = await getStorageKey();
    const id = crypto.randomUUID();
    const now = new Date();
    const row = { id, ownerId, storageKey, originalName, format, sizeBytes: bytes.byteLength, sha256, uploadedAt: now, deletedAt: null };
    await tx.insert(importFile).values(row);
    return row;
  }

  /** Byte-identical re-upload with an existing analysis: never re-parse, just hand back the same import (idempotent). Otherwise parses, dedupe-checks against saved activities, and persists the `activity_import` row. */
  async function analyzeAndPersist(
    tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
    ownerId: string,
    format: string,
    bytes: Buffer,
    fileRow: ImportFileRow
  ) {
    const existingImport = (await tx.select().from(activityImport).where(and(eq(activityImport.ownerId, ownerId), eq(activityImport.fileId, fileRow.id))).orderBy(desc(activityImport.createdAt))).at(0);
    if (existingImport) return existingImport;

    const importId = crypto.randomUUID();
    const now = new Date();
    let status: string;
    let errorCode: string | null = null;
    let analysisJson: string | null = null;
    let duplicateOfActivityId: string | null = null;

    try {
      const parsed = parseActivityFile(format as Parameters<typeof parseActivityFile>[0], bytes);
      const fingerprint = computeFingerprint(parsed.sport, parsed.startedAt, parsed.durationS);
      const match = (await tx.select({ id: enduranceActivity.id }).from(enduranceActivity).where(and(eq(enduranceActivity.ownerId, ownerId), eq(enduranceActivity.fingerprint, fingerprint)))).at(0);
      analysisJson = JSON.stringify(parsed);
      if (match) { status = "duplicate"; duplicateOfActivityId = match.id; } else { status = "analyzed"; }
    } catch (cause) {
      status = "failed";
      errorCode = cause instanceof Error && "code" in cause ? String((cause as { code: unknown }).code) : "VALIDATION_ERROR";
      analysisJson = JSON.stringify({ message: cause instanceof Error ? cause.message : "No se pudo interpretar el archivo." });
    }

    await tx.insert(activityImport).values({ id: importId, ownerId, fileId: fileRow.id, format, status, errorCode, analysisJson, duplicateOfActivityId, createdAt: now });
    return (await tx.select().from(activityImport).where(eq(activityImport.id, importId))).at(0)!;
  }

  /** Legacy single-step path: server receives the raw bytes, uploads them to Storage itself, then parses+persists. Kept for existing callers; the browser-direct-upload flow (Task 5) uses `runConfirmUpload` instead, which skips the upload step because the browser already did it. */
  async function runUpload(ownerId: string, originalName: string, bytes: Buffer) {
    if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new FileTooLargeError(MAX_UPLOAD_BYTES);
    const format = formatFromFilename(originalName); // throws UnsupportedFormatError for a bad extension

    return database.transaction(async (tx) => {
      const sha256 = sha256Hex(bytes);
      const fileRow = await findOrCreateFileRow(tx, ownerId, originalName, format, bytes, sha256, () => saveUploadedFile(ownerId, bytes, format));
      return analyzeAndPersist(tx, ownerId, format, bytes, fileRow);
    });
  }

  /** Browser-direct-upload confirm path: `storageKey` is already populated in Storage (the browser PUT the bytes there directly), and `bytes` here is what the server downloaded back to verify integrity/derive the analysis — this never re-uploads. */
  async function runConfirmUpload(ownerId: string, storageKey: string, originalName: string, bytes: Buffer) {
    if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new FileTooLargeError(MAX_UPLOAD_BYTES);
    const format = formatFromFilename(originalName); // throws UnsupportedFormatError for a bad extension

    return database.transaction(async (tx) => {
      const sha256 = sha256Hex(bytes);
      const fileRow = await findOrCreateFileRow(tx, ownerId, originalName, format, bytes, sha256, () => Promise.resolve(storageKey));
      return analyzeAndPersist(tx, ownerId, format, bytes, fileRow);
    });
  }

  async function runCommit(ownerId: string, importId: string, input: CommitImportInput) {
    return database.transaction(async (tx) => {
      const importRow = (await tx.select().from(activityImport).where(and(eq(activityImport.id, importId), eq(activityImport.ownerId, ownerId)))).at(0);
      if (!importRow) throw new ImportNotFoundError();
      if (importRow.status === "duplicate" && !input.force) throw new DuplicateNotForcedError(importRow.duplicateOfActivityId!);
      if (importRow.status !== "analyzed" && importRow.status !== "duplicate") throw new ImportNotReadyError(importRow.status);

      const parsed = JSON.parse(importRow.analysisJson!) as ParsedActivity;

      let planId: string | null = null;
      if (input.isoWeekStart && input.sessionIndex != null) {
        const plan = (await tx.select().from(trainingPlan).where(and(eq(trainingPlan.ownerId, ownerId), eq(trainingPlan.status, "active")))).at(0);
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
      await tx
        .insert(enduranceActivity)
        .values({
          id: activityId, ownerId, importId, planId,
          isoWeekStart: planId ? input.isoWeekStart : null, sessionIndex: planId ? input.sessionIndex : null,
          sport: input.sport, name: input.name, source: "imported", fingerprint,
          startedAt: new Date(parsed.startedAt), durationS: parsed.durationS, distanceM: parsed.distanceM, createdAt: now
        });

      for (const metric of parsed.metrics) {
        await tx.insert(activityMetric).values({ id: crypto.randomUUID(), activityId, metricType: metric.metricType, value: metric.value, unit: metric.unit, source: "file" });
      }

      await tx.update(activityImport).set({ status: "saved" }).where(eq(activityImport.id, importId));

      return {
        activity: (await tx.select().from(enduranceActivity).where(eq(enduranceActivity.id, activityId))).at(0)!,
        metrics: await tx.select().from(activityMetric).where(eq(activityMetric.activityId, activityId))
      };
    });
  }

  /**
   * Minimal retention: deletes the raw uploaded bytes and marks the row
   * deleted, but never touches the derived `activity_import`/
   * `endurance_activity`/`activity_metric` rows — the analysis already ran
   * and lives independently in `analysisJson`/the committed activity, so
   * history stays intact after the source file is gone.
   */
  async function runDeleteFile(ownerId: string, fileId: string) {
    return database.transaction(async (tx) => {
      const fileRow = (await tx.select().from(importFile).where(and(eq(importFile.id, fileId), eq(importFile.ownerId, ownerId)))).at(0);
      if (!fileRow || fileRow.deletedAt) throw new ImportFileNotFoundError();
      await deleteUploadedFile(fileRow.storageKey);
      await tx.update(importFile).set({ deletedAt: new Date() }).where(eq(importFile.id, fileId));
    });
  }

  return {
    uploadAndAnalyze: (ownerId: string, originalName: string, bytes: Buffer) => runUpload(ownerId, originalName, bytes),
    confirmUpload: (ownerId: string, storageKey: string, originalName: string, bytes: Buffer) => runConfirmUpload(ownerId, storageKey, originalName, bytes),
    getImport: async (ownerId: string, importId: string) => (await database.select().from(activityImport).where(and(eq(activityImport.id, importId), eq(activityImport.ownerId, ownerId)))).at(0),
    commit: (ownerId: string, importId: string, input: CommitImportInput) => runCommit(ownerId, importId, input),
    deleteImportFile: (ownerId: string, fileId: string) => runDeleteFile(ownerId, fileId)
  };
}
