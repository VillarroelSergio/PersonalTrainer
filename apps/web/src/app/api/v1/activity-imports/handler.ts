import { z } from "zod";
import { commitImportInputSchema } from "@/contracts/endurance";
import {
  DuplicateNotForcedError,
  ImportFileNotFoundError,
  ImportNotFoundError,
  ImportNotReadyError,
  SessionNotEnduranceError,
  createActivityImportRepository
} from "@/features/endurance/domain/import-repository";
import { FileTooLargeError, UnsupportedFormatError } from "@/features/endurance/domain/parsers";
import { readUploadedFile, sha256Hex } from "@/features/endurance/domain/storage";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/lib/db/schema";

type SessionUser = { id: string } | null;
type Db = PostgresJsDatabase<typeof schema>;

const confirmUploadSchema = z.object({
  storageKey: z.string().min(1),
  originalName: z.string().min(1),
  sha256: z.string().min(1),
  sizeBytes: z.number().int().nonnegative()
});

/**
 * Step 2 of the browser-direct-upload flow (Task 5): the browser already PUT its bytes
 * straight to Storage (see upload-url/handler.ts) and hands us the storage key + a
 * client-computed sha256. This downloads the bytes back, verifies ownership of the key and
 * the hash (tamper/integrity check), then reuses the same dedupe→parse→analyze→persist
 * path as the legacy single-step upload — it just never re-uploads.
 */
export async function confirmActivityImportResponse(request: Request, user: SessionUser, database: Db): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = confirmUploadSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Datos de confirmación inválidos.", parsed.error.flatten());
  const { storageKey, originalName, sha256, sizeBytes } = parsed.data;

  // Owner-scoped key prefix, not the person-supplied filename: prevents confirming someone
  // else's key or a forged path (createPrivateUploadKey always mints under this prefix).
  if (!storageKey.startsWith(`activity-imports/${user.id}/`)) return error(404, "NOT_FOUND", "No encontramos ese archivo.");

  let bytes: Buffer;
  try {
    bytes = await readUploadedFile(storageKey);
  } catch {
    return error(404, "NOT_FOUND", "No encontramos ese archivo.");
  }

  if (bytes.byteLength !== sizeBytes) return error(422, "VALIDATION_ERROR", "El tamaño del archivo subido no coincide con lo esperado.");
  if (sha256Hex(bytes) !== sha256.toLowerCase()) return error(422, "VALIDATION_ERROR", "El archivo subido no coincide con lo esperado (verificación de integridad fallida).");

  try {
    const repository = createActivityImportRepository(database);
    const importRow = await repository.confirmUpload(user.id, storageKey, originalName, bytes);
    return Response.json({ data: toClientImport(importRow), meta: {} });
  } catch (cause) {
    if (cause instanceof UnsupportedFormatError) return error(422, "UNSUPPORTED_ACTIVITY_FILE", cause.message);
    if (cause instanceof FileTooLargeError) return error(413, "VALIDATION_ERROR", cause.message);
    throw cause;
  }
}

export async function getActivityImportResponse(user: SessionUser, database: Db, importId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");
  const repository = createActivityImportRepository(database);
  const importRow = await repository.getImport(user.id, importId);
  if (!importRow) return error(404, "NOT_FOUND", "No encontramos esa importación.");
  return Response.json({ data: toClientImport(importRow), meta: {} });
}

export async function commitActivityImportResponse(request: Request, user: SessionUser, database: Db, importId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser JSON válido.");
  }

  const parsed = commitImportInputSchema.safeParse(body);
  if (!parsed.success) return error(400, "VALIDATION_ERROR", "Datos de confirmación inválidos.", parsed.error.flatten());

  try {
    const repository = createActivityImportRepository(database);
    const result = await repository.commit(user.id, importId, parsed.data);
    return Response.json({ data: result, meta: {} });
  } catch (cause) {
    if (cause instanceof ImportNotFoundError) return error(404, "NOT_FOUND", "No encontramos esa importación.");
    if (cause instanceof DuplicateNotForcedError) return error(409, "DUPLICATE_ACTIVITY", "Esta actividad se parece a una que ya tienes guardada.", { duplicateOfActivityId: cause.duplicateOfActivityId });
    if (cause instanceof ImportNotReadyError) return error(400, "VALIDATION_ERROR", cause.message);
    if (cause instanceof SessionNotEnduranceError) return error(400, "VALIDATION_ERROR", "La sesión indicada no es de resistencia.");
    throw cause;
  }
}

/** Deletes the raw uploaded bytes (minimal retention, Fase 5) — the derived import/activity/metric rows are untouched and history stays intact. */
export async function deleteActivityImportFileResponse(user: SessionUser, database: Db, importId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  try {
    const repository = createActivityImportRepository(database);
    const importRow = await repository.getImport(user.id, importId);
    if (!importRow) return error(404, "NOT_FOUND", "No encontramos esa importación.");
    await repository.deleteImportFile(user.id, importRow.fileId);
    return Response.json({ data: { ok: true }, meta: {} });
  } catch (cause) {
    if (cause instanceof ImportFileNotFoundError) return error(404, "NOT_FOUND", "Ese archivo ya no está disponible.");
    throw cause;
  }
}

function toClientImport(row: { id: string; status: string; format: string; errorCode: string | null; analysisJson: string | null; duplicateOfActivityId: string | null }) {
  return { id: row.id, status: row.status, format: row.format, errorCode: row.errorCode, analysis: row.analysisJson ? JSON.parse(row.analysisJson) : null, duplicateOfActivityId: row.duplicateOfActivityId };
}

function error(status: number, code: string, message: string, details: unknown = {}) {
  return Response.json({ error: { code, message, details } }, { status });
}
