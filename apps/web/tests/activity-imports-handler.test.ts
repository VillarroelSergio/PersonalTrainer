import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmActivityImportResponse } from "@/app/api/v1/activity-imports/handler";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { MAX_UPLOAD_BYTES } from "@/features/endurance/domain/storage";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

const VALID_GPX = `<?xml version="1.0" encoding="UTF-8"?><gpx><trk><type>running</type><trkseg><trkpt lat="1" lon="1"><time>2026-08-10T08:00:00Z</time></trkpt><trkpt lat="1" lon="1"><time>2026-08-10T08:05:00Z</time></trkpt></trkseg></trk></gpx>`;
const VALID_GPX_BYTES = Buffer.from(VALID_GPX, "utf-8");
const VALID_GPX_SHA256 = createHash("sha256").update(VALID_GPX_BYTES).digest("hex");

const download = vi.fn(async () => ({ data: new Blob([VALID_GPX_BYTES]), error: null }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: vi.fn(() => ({ download })) } }))
}));

const createdOwnerIds: string[] = [];

async function fixture() {
  const db = getDb();
  const ownerId = crypto.randomUUID();
  createdOwnerIds.push(ownerId);
  const now = new Date();
  await db.insert(schema.user).values({ id: ownerId, name: ownerId, email: `${ownerId}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  return { db, ownerId };
}

beforeEach(() => {
  download.mockClear();
  download.mockResolvedValue({ data: new Blob([VALID_GPX_BYTES]), error: null } as never);
});

afterEach(async () => {
  const db = getDb();
  while (createdOwnerIds.length) {
    const ownerId = createdOwnerIds.pop()!;
    await db.delete(schema.user).where(eq(schema.user.id, ownerId));
  }
});

function confirmRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/activity-imports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/v1/activity-imports — confirm (browser-direct-upload flow)", () => {
  it("rejects when unauthenticated", async () => {
    const response = await confirmActivityImportResponse(
      confirmRequest({ storageKey: "activity-imports/x/f.gpx", originalName: "carrera.gpx", sha256: VALID_GPX_SHA256, sizeBytes: VALID_GPX_BYTES.byteLength }),
      null,
      getDb()
    );
    expect(response.status).toBe(401);
  });

  it("rejects a storageKey that does not belong to the authenticated owner", async () => {
    const { db, ownerId } = await fixture();
    const response = await confirmActivityImportResponse(
      confirmRequest({ storageKey: "activity-imports/someone-else/f.gpx", originalName: "carrera.gpx", sha256: VALID_GPX_SHA256, sizeBytes: VALID_GPX_BYTES.byteLength }),
      { id: ownerId },
      db
    );
    expect(response.status).toBe(404);
    expect(download).not.toHaveBeenCalled();
  });

  it("rejects when the client-declared sha256 does not match the downloaded bytes", async () => {
    const { db, ownerId } = await fixture();
    const response = await confirmActivityImportResponse(
      confirmRequest({ storageKey: `activity-imports/${ownerId}/f.gpx`, originalName: "carrera.gpx", sha256: "0".repeat(64), sizeBytes: VALID_GPX_BYTES.byteLength }),
      { id: ownerId },
      db
    );
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects when the client-declared sizeBytes does not match the downloaded bytes", async () => {
    const { db, ownerId } = await fixture();
    const response = await confirmActivityImportResponse(
      confirmRequest({ storageKey: `activity-imports/${ownerId}/f.gpx`, originalName: "carrera.gpx", sha256: VALID_GPX_SHA256, sizeBytes: VALID_GPX_BYTES.byteLength + 1 }),
      { id: ownerId },
      db
    );
    expect(response.status).toBe(422);
  });

  it("confirms a valid upload: downloads, verifies, parses, and persists — same dedupe/parse/analyze behavior as the legacy single-step upload", async () => {
    const { db, ownerId } = await fixture();
    const storageKey = `activity-imports/${ownerId}/f.gpx`;
    const response = await confirmActivityImportResponse(
      confirmRequest({ storageKey, originalName: "carrera.gpx", sha256: VALID_GPX_SHA256, sizeBytes: VALID_GPX_BYTES.byteLength }),
      { id: ownerId },
      db
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("analyzed");
    expect(download).toHaveBeenCalledTimes(1);

    const files = await db.select().from(schema.importFile).where(eq(schema.importFile.ownerId, ownerId));
    expect(files).toHaveLength(1);
    expect(files[0]!.storageKey).toBe(storageKey);

    // Confirming the exact same content again (e.g. duplicate confirm call) is idempotent: no re-upload, no duplicate rows.
    const second = await confirmActivityImportResponse(
      confirmRequest({ storageKey: `activity-imports/${ownerId}/other.gpx`, originalName: "carrera.gpx", sha256: VALID_GPX_SHA256, sizeBytes: VALID_GPX_BYTES.byteLength }),
      { id: ownerId },
      db
    );
    expect(second.status).toBe(200);
    expect((await db.select().from(schema.importFile).where(eq(schema.importFile.ownerId, ownerId)))).toHaveLength(1);
  });

  it("rejects when the downloaded bytes exceed MAX_UPLOAD_BYTES", async () => {
    const { db, ownerId } = await fixture();
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    const oversizedSha256 = createHash("sha256").update(oversized).digest("hex");
    download.mockResolvedValueOnce({ data: new Blob([oversized]), error: null } as never);

    const response = await confirmActivityImportResponse(
      confirmRequest({ storageKey: `activity-imports/${ownerId}/f.gpx`, originalName: "carrera.gpx", sha256: oversizedSha256, sizeBytes: oversized.byteLength }),
      { id: ownerId },
      db
    );
    expect(response.status).toBe(413);
  });
});
