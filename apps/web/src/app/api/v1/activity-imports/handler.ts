import { commitImportInputSchema } from "@/contracts/endurance";
import {
  DuplicateNotForcedError,
  ImportFileNotFoundError,
  ImportNotFoundError,
  ImportNotReadyError,
  SessionNotEnduranceError,
  createActivityImportRepository
} from "@/features/endurance/domain/import-repository";
import { formatFromFilename, validateMimeType, FileTooLargeError, UnsupportedFormatError, UnsupportedMimeTypeError } from "@/features/endurance/domain/parsers";
import { MAX_UPLOAD_BYTES } from "@/features/endurance/domain/storage";
import type { db as productionDb } from "@/lib/db/client";
import type Database from "better-sqlite3";

type SessionUser = { id: string } | null;

export async function uploadActivityImportResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  // request.formData() itself buffers the whole multipart body before we can inspect
  // any part, so it depends on the server/reverse-proxy request-body size limit —
  // that is an infrastructure prerequisite for deployment, not something this handler
  // configures. The file.size check below is the application-level backstop once we
  // do have the parsed File part.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error(400, "VALIDATION_ERROR", "El cuerpo debe ser multipart/form-data.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return error(400, "VALIDATION_ERROR", "Falta el archivo (campo \"file\").");

  // Reject by declared size before reading the body into memory — file.size is metadata
  // the runtime already has from the multipart part, so this never buffers an oversized upload.
  if (file.size > MAX_UPLOAD_BYTES) return error(413, "VALIDATION_ERROR", new FileTooLargeError(MAX_UPLOAD_BYTES).message);

  try {
    const format = formatFromFilename(file.name);
    validateMimeType(format, file.type ?? "");

    const bytes = Buffer.from(await file.arrayBuffer());
    const repository = createActivityImportRepository(database, sqliteHandle);
    const importRow = repository.uploadAndAnalyze(user.id, file.name, bytes);
    return Response.json({ data: toClientImport(importRow), meta: {} });
  } catch (cause) {
    if (cause instanceof UnsupportedFormatError) return error(422, "UNSUPPORTED_ACTIVITY_FILE", cause.message);
    if (cause instanceof UnsupportedMimeTypeError) return error(422, "UNSUPPORTED_ACTIVITY_FILE", cause.message);
    if (cause instanceof FileTooLargeError) return error(413, "VALIDATION_ERROR", cause.message);
    throw cause;
  }
}

export async function getActivityImportResponse(user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database, importId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");
  const repository = createActivityImportRepository(database, sqliteHandle);
  const importRow = repository.getImport(user.id, importId);
  if (!importRow) return error(404, "NOT_FOUND", "No encontramos esa importación.");
  return Response.json({ data: toClientImport(importRow), meta: {} });
}

export async function commitActivityImportResponse(request: Request, user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database, importId: string): Promise<Response> {
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
    const repository = createActivityImportRepository(database, sqliteHandle);
    const result = repository.commit(user.id, importId, parsed.data);
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
export async function deleteActivityImportFileResponse(user: SessionUser, database: typeof productionDb, sqliteHandle: Database.Database, importId: string): Promise<Response> {
  if (!user) return error(401, "UNAUTHENTICATED", "Necesitas iniciar sesión.");

  try {
    const repository = createActivityImportRepository(database, sqliteHandle);
    const importRow = repository.getImport(user.id, importId);
    if (!importRow) return error(404, "NOT_FOUND", "No encontramos esa importación.");
    repository.deleteImportFile(user.id, importRow.fileId);
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
