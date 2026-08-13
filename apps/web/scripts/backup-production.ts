import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { listAllUploads, readPrivateUpload } from "@/lib/storage/supabase-server";

/**
 * Local operator CLI for a full pre-migration/pre-promotion backup: `pg_dump` of Postgres
 * plus a full download of the `trainer-private` Storage bucket, with a manifest of
 * SHA-256 checksums. Never imported from application code that runs on Vercel —
 * standalone only, run via `npm run backup:production` (tsx). Requires `pg_dump` on the
 * operator's PATH (not part of this repo's toolchain — install it locally, e.g. via the
 * Postgres client tools for your OS).
 */

const execFileAsync = promisify(execFile);

export interface PostgresDumpResult {
  path: string;
  sizeBytes: number;
  sha256: string;
}

export interface StorageObjectResult {
  key: string;
  sizeBytes: number;
  sha256: string;
}

export interface BackupManifestInput {
  schemaVersion: string;
  timestamp: string;
  postgres: PostgresDumpResult;
  storageObjects: StorageObjectResult[];
}

export interface BackupManifest {
  schemaVersion: string;
  timestamp: string;
  postgres: PostgresDumpResult;
  storage: {
    objectCount: number;
    manifestSha256: string;
    objects: StorageObjectResult[];
  };
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Never includes the connection string or any other secret — only shaped, checksummed data. */
export function createBackupManifest(input: BackupManifestInput): BackupManifest {
  const listing = input.storageObjects.map(({ key, sha256: hash, sizeBytes }) => ({ key, sha256: hash, sizeBytes }));
  const manifestSha256 = sha256(Buffer.from(JSON.stringify(listing)));
  return {
    schemaVersion: input.schemaVersion,
    timestamp: input.timestamp,
    postgres: { ...input.postgres },
    storage: { objectCount: input.storageObjects.length, manifestSha256, objects: input.storageObjects }
  };
}

/** Strips connection strings and the service-role key value from an error message before it's ever logged or rethrown. */
function sanitize(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  message = message.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted-connection-string]");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) message = message.split(serviceRoleKey).join("[redacted-service-role-key]");
  return message;
}

// ponytail: version tag of the last applied migration, not a dynamic schema hash — good enough
// to know which migration state a dump corresponds to; falls back to "unknown" if unreadable.
function readSchemaVersion(): string {
  try {
    const journalPath = path.join(process.cwd(), "apps/web/drizzle/meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries?: { tag?: string }[] };
    return journal.entries?.at(-1)?.tag ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function defaultRunPgDump(databaseUrl: string, outputPath: string): Promise<void> {
  try {
    await execFileAsync("pg_dump", ["--format=custom", "--no-owner", "--no-acl", `--file=${outputPath}`, databaseUrl]);
  } catch (error) {
    throw new Error(`pg_dump failed: ${sanitize(error)}`);
  }
}

export interface BackupDeps {
  databaseUrl: string;
  outputDir: string;
  runPgDump: (databaseUrl: string, outputPath: string) => Promise<void>;
  listAllUploads: () => Promise<{ key: string }[]>;
  readPrivateUpload: (key: string) => Promise<Buffer>;
  now?: () => Date;
}

export async function runBackup(deps: BackupDeps): Promise<{ manifest: BackupManifest; manifestPath: string }> {
  await mkdir(deps.outputDir, { recursive: true });

  const dumpPath = path.join(deps.outputDir, "postgres.dump");
  try {
    await deps.runPgDump(deps.databaseUrl, dumpPath);
  } catch (error) {
    // Re-thrown sanitized regardless of which runPgDump implementation raised it — the
    // connection string must never survive into a caught/logged error either.
    throw new Error(sanitize(error));
  }
  const dumpBytes = await readFile(dumpPath);
  const postgres: PostgresDumpResult = { path: dumpPath, sizeBytes: dumpBytes.length, sha256: sha256(dumpBytes) };

  const storageDir = path.join(deps.outputDir, "storage");
  await mkdir(storageDir, { recursive: true });
  const objects = await deps.listAllUploads();
  const storageObjects: StorageObjectResult[] = [];
  for (const { key } of objects) {
    const bytes = await deps.readPrivateUpload(key);
    await writeFile(path.join(storageDir, key.replace(/\//g, "__")), bytes);
    storageObjects.push({ key, sizeBytes: bytes.length, sha256: sha256(bytes) });
  }

  const manifest = createBackupManifest({
    schemaVersion: readSchemaVersion(),
    timestamp: (deps.now?.() ?? new Date()).toISOString(),
    postgres,
    storageObjects
  });

  const manifestPath = path.join(deps.outputDir, "manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return { manifest, manifestPath };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exitCode = 1;
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join("apps/web/.backups", timestamp);

  const { manifest, manifestPath } = await runBackup({
    databaseUrl,
    outputDir,
    runPgDump: defaultRunPgDump,
    listAllUploads,
    readPrivateUpload,
    now: () => new Date()
  });

  console.log(`Backup completo: ${manifestPath}`);
  console.log(`Objetos de Storage respaldados: ${manifest.storage.objectCount}`);
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(sanitize(error));
    process.exitCode = 1;
  });
}
