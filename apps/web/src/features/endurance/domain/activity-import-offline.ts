"use client";

import { createClientId } from "@/lib/client-id";
import type { OutboxOperation, SubmitResult } from "@/lib/offline/outbox";

export type OfflineImportFile = {
  id: string;
  userId: string;
  blob: Blob;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  sha256: string;
  createdAt: number;
};

export interface OfflineImportFileStore {
  get(userId: string, fileId: string): Promise<OfflineImportFile | undefined>;
  put(file: OfflineImportFile): Promise<void>;
  remove(userId: string, fileId: string): Promise<void>;
  list(userId: string): Promise<OfflineImportFile[]>;
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
  dependencies: { fileStore: OfflineImportFileStore; fetchFn?: FetchFn }
): Promise<SubmitResult> {
  if (operation.kind !== "stage_activity_import") return { status: "rejected", message: "Operación de importación no compatible." };

  const fetchFn = dependencies.fetchFn ?? fetch;
  const { fileId, userId, originalName, sizeBytes, mimeType, sha256 } = operation.payload;
  const stagedFile = await dependencies.fileStore.get(userId, fileId);
  if (!stagedFile) return { status: "rejected", message: "No encontramos el archivo preparado para importar." };

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

  await dependencies.fileStore.remove(userId, fileId);
  return { status: "ok" };
}

function responseToSubmitResult(response: Response, body: unknown): SubmitResult {
  if (response.status >= 500) return { status: "network_error" };
  if (response.status === 409) return { status: "conflict", currentVersion: 0 };
  const message = (body as { error?: { message?: string } } | null)?.error?.message;
  return { status: "rejected", message: message ?? "No pudimos completar la operación." };
}
