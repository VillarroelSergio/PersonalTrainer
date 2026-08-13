import { createHash } from "node:crypto";
import { createPrivateUploadKey, deletePrivateUpload, readPrivateUpload, uploadPrivateFile } from "@/lib/storage/supabase-server";

/** Conservative default (spike question open in DATA-MODEL-PROPOSAL.md §"Preguntas para el spike técnico"): real FIT/TCX/GPX activity files are typically well under this. Adjustable without a schema change. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Uploads bytes under an owner-scoped, non-guessable key and returns that storageKey. */
export async function saveUploadedFile(ownerId: string, bytes: Buffer, format: string): Promise<string> {
  const storageKey = createPrivateUploadKey(ownerId, format);
  await uploadPrivateFile(storageKey, bytes, contentTypeFor(format));
  return storageKey;
}

export async function readUploadedFile(storageKey: string): Promise<Buffer> {
  return readPrivateUpload(storageKey);
}

export async function deleteUploadedFile(storageKey: string): Promise<void> {
  await deletePrivateUpload(storageKey);
}

function contentTypeFor(format: string): string {
  // ponytail: only used to label the object in the bucket; the app never trusts this for parsing (parsers re-derive format from the stored `format` DB column).
  if (format === "gpx") return "application/gpx+xml";
  if (format === "tcx") return "application/vnd.garmin.tcx+xml";
  return "application/octet-stream";
}
