import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Outside apps/web/public (Next.js only serves public/ statically), never web-reachable directly. */
const PRIVATE_UPLOAD_ROOT = path.resolve(process.cwd(), "private-uploads", "activity-imports");

/** Conservative default (spike question open in DATA-MODEL-PROPOSAL.md §"Preguntas para el spike técnico"): real FIT/TCX/GPX activity files are typically well under this. Adjustable without a schema change. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Writes bytes under a random, non-guessable key (never the person-supplied filename, avoiding path traversal from an attacker-controlled name) and returns that storageKey. */
export function saveUploadedFile(bytes: Buffer, format: string): string {
  mkdirSync(PRIVATE_UPLOAD_ROOT, { recursive: true });
  const storageKey = `${randomUUID()}.${format}`;
  writeFileSync(path.join(PRIVATE_UPLOAD_ROOT, storageKey), bytes);
  return storageKey;
}

export function readUploadedFile(storageKey: string): Buffer {
  return readFileSync(path.join(PRIVATE_UPLOAD_ROOT, storageKey));
}

export function deleteUploadedFile(storageKey: string): void {
  try {
    unlinkSync(path.join(PRIVATE_UPLOAD_ROOT, storageKey));
  } catch {
    // ponytail: ya borrado o nunca escrito — no es un error operable aquí.
  }
}
