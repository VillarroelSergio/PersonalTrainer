import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.fn(async (prefix: string) => {
  if (prefix === "") return { data: [{ name: "activity-imports", id: null, metadata: null }], error: null };
  if (prefix === "activity-imports") return { data: [{ name: "account-a", id: null, metadata: null }], error: null };
  if (prefix === "activity-imports/account-a") {
    return { data: [{ name: "x.fit", id: "1", metadata: { size: 5 } }], error: null };
  }
  return { data: [], error: null };
});
const download = vi.fn(async () => ({ data: new Blob([Buffer.from("stored-bytes")]), error: null }));
const from = vi.fn(() => ({ list, download }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from } }))
}));

let outputDir: string;

beforeEach(async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key-value";
  outputDir = await mkdtemp(path.join(tmpdir(), "trainer-backup-test-"));
});

afterEach(async () => {
  await rm(outputDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe("listAllUploads (via mocked Supabase Storage client)", () => {
  it("walks folders recursively and returns file keys only", async () => {
    const { listAllUploads } = await import("@/lib/storage/supabase-server");
    const result = await listAllUploads();
    expect(result).toEqual([{ key: "activity-imports/account-a/x.fit" }]);
  });
});

describe("runBackup / createBackupManifest", () => {
  it("produces a manifest with a valid postgres sha256 and matches the mocked Storage listing", async () => {
    const { runBackup } = await import("../scripts/backup-production");
    const { listAllUploads, readPrivateUpload } = await import("@/lib/storage/supabase-server");

    const fakeRunPgDump = vi.fn(async (_databaseUrl: string, outputPath: string) => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(outputPath, "fake-dump-bytes");
    });

    const { manifest, manifestPath } = await runBackup({
      databaseUrl: "postgres://user:secret-pw@example.test:5432/trainer",
      outputDir,
      runPgDump: fakeRunPgDump,
      listAllUploads,
      readPrivateUpload,
      now: () => new Date("2026-08-13T00:00:00.000Z")
    });

    expect(manifest.postgres.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.storage.objectCount).toBe(1);
    expect(manifest.storage.objects).toEqual([
      { key: "activity-imports/account-a/x.fit", sizeBytes: expect.any(Number), sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }
    ]);
    expect(manifestPath).toContain(outputDir);
  });

  it("never leaks the connection string or the service-role key into the serialized manifest", async () => {
    const { runBackup } = await import("../scripts/backup-production");
    const { listAllUploads, readPrivateUpload } = await import("@/lib/storage/supabase-server");

    const secretDatabaseUrl = "postgres://user:super-secret-pw@example.test:5432/trainer";
    const fakeRunPgDump = vi.fn(async (_databaseUrl: string, outputPath: string) => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(outputPath, "fake-dump-bytes");
    });

    const { manifest } = await runBackup({
      databaseUrl: secretDatabaseUrl,
      outputDir,
      runPgDump: fakeRunPgDump,
      listAllUploads,
      readPrivateUpload,
      now: () => new Date("2026-08-13T00:00:00.000Z")
    });

    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toContain("postgres://");
    expect(serialized).not.toContain("super-secret-pw");
    expect(serialized).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY as string);
  });

  it("propagates a pg_dump failure without writing manifest.json and without leaking the connection string in the error", async () => {
    const { runBackup } = await import("../scripts/backup-production");
    const { listAllUploads, readPrivateUpload } = await import("@/lib/storage/supabase-server");
    const { access } = await import("node:fs/promises");

    const secretDatabaseUrl = "postgres://user:another-secret@example.test:5432/trainer";
    const failingRunPgDump = vi.fn(async (databaseUrl: string) => {
      throw new Error(`pg_dump exited with code 1 while dumping ${databaseUrl}`);
    });

    await expect(
      runBackup({
        databaseUrl: secretDatabaseUrl,
        outputDir,
        runPgDump: failingRunPgDump,
        listAllUploads,
        readPrivateUpload,
        now: () => new Date("2026-08-13T00:00:00.000Z")
      })
    ).rejects.toThrow(/redacted-connection-string/);

    let rejectionMessage = "";
    try {
      await runBackup({
        databaseUrl: secretDatabaseUrl,
        outputDir,
        runPgDump: failingRunPgDump,
        listAllUploads,
        readPrivateUpload,
        now: () => new Date("2026-08-13T00:00:00.000Z")
      });
    } catch (error) {
      rejectionMessage = error instanceof Error ? error.message : String(error);
    }
    expect(rejectionMessage).not.toContain("another-secret");
    expect(rejectionMessage).not.toContain("postgres://");

    await expect(access(path.join(outputDir, "manifest.json"))).rejects.toThrow();
  });
});
