"use client";

import { createClientId } from "@/lib/client-id";
import type { OutboxOperation, SubmitResult } from "@/lib/offline/outbox";
import type { EnduranceSport, ParsedActivity } from "@/contracts/endurance";

export type OfflineImportData = {
  id: string;
  status: string;
  format: string;
  errorCode: string | null;
  analysis: ParsedActivity | { message: string } | null;
  duplicateOfActivityId: string | null;
};

export type OfflineImportFile = {
  id: string;
  userId: string;
  status: "staged" | "ready_to_save";
  blob: Blob | null;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
  createdAt: number;
  importData?: OfflineImportData;
};

export type OfflineImportFileSummary = Pick<OfflineImportFile, "id" | "originalName" | "sizeBytes" | "createdAt" | "status" | "importData">;

export interface OfflineImportFileStore {
  get(userId: string, fileId: string): Promise<OfflineImportFile | undefined>;
  put(file: OfflineImportFile): Promise<void>;
  remove(userId: string, fileId: string): Promise<void>;
  list(userId: string): Promise<OfflineImportFile[]>;
}

const OFFLINE_IMPORT_FILES_CHANGED_EVENT = "trainer:offline-import-files-changed";
type OfflineImportFilesChangedEvent = CustomEvent<{ userId: string }>;

export function notifyOfflineImportFilesChanged(userId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFLINE_IMPORT_FILES_CHANGED_EVENT, { detail: { userId } }));
}

export function listenOfflineImportFilesChanged(userId: string, onChanged: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as OfflineImportFilesChangedEvent).detail;
    if (detail?.userId === userId) onChanged();
  };
  window.addEventListener(OFFLINE_IMPORT_FILES_CHANGED_EVENT, handler);
  return () => window.removeEventListener(OFFLINE_IMPORT_FILES_CHANGED_EVENT, handler);
}

export async function refreshOfflineImportFileSummaries(
  fileStore: OfflineImportFileStore,
  userId: string,
  isCurrent: () => boolean
): Promise<OfflineImportFileSummary[] | null> {
  try {
    const files = await fileStore.list(userId);
    if (!isCurrent()) return null;
    return files.map(({ id, originalName, sizeBytes, createdAt, status, importData }) => ({ id, originalName, sizeBytes, createdAt, status, importData }));
  } catch {
    return isCurrent() ? [] : null;
  }
}

export type StageActivityImportInput = {
  file: File;
  userId: string;
  fileStore: OfflineImportFileStore;
  createId?: () => string;
};

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function stageActivityImportOffline(input: StageActivityImportInput): Promise<{ file: OfflineImportFile; operation: OutboxOperation }> {
  const createId = input.createId ?? createClientId;
  const fileId = createId();
  const bytes = await input.file.arrayBuffer();
  const stagedFile: OfflineImportFile = {
    id: fileId,
    userId: input.userId,
    status: "staged",
    blob: input.file,
    originalName: input.file.name,
    sizeBytes: input.file.size,
    mimeType: input.file.type || "application/octet-stream",
    sha256: await sha256Hex(bytes),
    createdAt: Date.now()
  };
  await input.fileStore.put(stagedFile);

  return {
    file: stagedFile,
    operation: {
      id: createId(),
      kind: "stage_activity_import",
      createdAt: Date.now(),
      status: "pending",
      payload: {
        fileId: stagedFile.id,
        userId: stagedFile.userId,
        originalName: stagedFile.originalName,
        sizeBytes: stagedFile.sizeBytes,
        mimeType: stagedFile.mimeType,
        sha256: stagedFile.sha256
      }
    }
  };
}

type FetchFn = typeof fetch;

export async function submitStagedActivityImport(
  operation: OutboxOperation,
  dependencies: { fileStore: OfflineImportFileStore; fetchFn?: FetchFn; currentUserId?: string }
): Promise<SubmitResult> {
  if (operation.kind !== "stage_activity_import") return { status: "rejected", message: "Operación de importación no compatible." };

  const fetchFn = dependencies.fetchFn ?? fetch;
  const { fileId, userId, originalName, sizeBytes, mimeType, sha256 } = operation.payload;
  if (dependencies.currentUserId !== undefined && dependencies.currentUserId !== userId) return { status: "network_error" };
  const stagedFile = await dependencies.fileStore.get(userId, fileId);
  if (!stagedFile) return { status: "rejected", message: "No encontramos el archivo preparado para importar." };
  if (!stagedFile.blob) return stagedFile.status === "ready_to_save" ? { status: "ok" } : { status: "rejected", message: "No encontramos el archivo preparado para importar." };

  let uploadUrlResponse: Response;
  try {
    uploadUrlResponse = await fetchFn("/api/v1/activity-imports/upload-url", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "idempotency-key": operation.id },
      body: JSON.stringify({ name: originalName, sizeBytes, mimeType })
    });
  } catch {
    return { status: "network_error" };
  }
  const uploadUrlBody = await uploadUrlResponse.json().catch(() => null);
  if (!uploadUrlResponse.ok) return responseToSubmitResult(uploadUrlResponse, uploadUrlBody);

  const signed = uploadUrlBody?.data as { storageKey?: string; signedUrl?: string } | undefined;
  if (!signed?.storageKey || !signed.signedUrl) return { status: "rejected", message: "No pudimos preparar la subida." };

  let uploadResponse: Response;
  try {
    uploadResponse = await fetchFn(signed.signedUrl, {
      method: "PUT",
      body: stagedFile.blob,
      headers: { "content-type": mimeType }
    });
  } catch {
    return { status: "network_error" };
  }
  if (!uploadResponse.ok) return uploadResponse.status >= 500 ? { status: "network_error" } : { status: "rejected", message: "No pudimos subir el archivo." };

  let confirmResponse: Response;
  try {
    confirmResponse = await fetchFn("/api/v1/activity-imports", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "idempotency-key": operation.id },
      body: JSON.stringify({ storageKey: signed.storageKey, originalName, sha256, sizeBytes })
    });
  } catch {
    return { status: "network_error" };
  }
  const confirmBody = await confirmResponse.json().catch(() => null);
  if (!confirmResponse.ok) return responseToSubmitResult(confirmResponse, confirmBody);

  await dependencies.fileStore.put({ ...stagedFile, status: "ready_to_save", blob: null, importData: confirmBody?.data as OfflineImportData });
  notifyOfflineImportFilesChanged(userId);
  return { status: "ok" };
}

export function readyImportToWizardState(file: OfflineImportFile): { importData: OfflineImportData; name: string; sport: EnduranceSport } | null {
  if (file.status !== "ready_to_save" || !file.importData) return null;
  const analysis = file.importData.analysis;
  const sport = typeof analysis === "object" && analysis !== null && "sport" in analysis && analysis.sport !== "other" ? analysis.sport : "running";
  return {
    importData: file.importData,
    name: file.originalName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " "),
    sport
  };
}

function responseToSubmitResult(response: Response, body: unknown): SubmitResult {
  if (response.status >= 500) return { status: "network_error" };
  if (response.status === 409) return { status: "conflict", currentVersion: 0 };
  const message = (body as { error?: { message?: string } } | null)?.error?.message;
  return { status: "rejected", message: message ?? "No pudimos completar la operación." };
}
