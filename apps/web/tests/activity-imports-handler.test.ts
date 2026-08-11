import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { uploadActivityImportResponse } from "@/app/api/v1/activity-imports/handler";
import * as schema from "@/lib/db/schema";
import { MAX_UPLOAD_BYTES } from "@/features/endurance/domain/storage";

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE import_file (id text primary key, owner_id text not null, storage_key text not null, original_name text not null, format text not null, size_bytes integer not null, sha256 text not null, uploaded_at integer not null, deleted_at integer);
    CREATE UNIQUE INDEX import_file_owner_sha256_idx ON import_file (owner_id, sha256);
    CREATE TABLE activity_import (id text primary key, owner_id text not null, file_id text not null, format text not null, status text not null, error_code text, analysis_json text, duplicate_of_activity_id text, created_at integer not null);
  `);
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "account-a", "a@example.test", 1, null, 0, 0);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

function requestWithFile(file: File): Request {
  const formData = new FormData();
  formData.set("file", file);
  return new Request("http://localhost/api/v1/activity-imports", { method: "POST", body: formData });
}

describe("POST /api/v1/activity-imports — Bloqueante 4 hardening", () => {
  it("rejects an oversized file by declared size", async () => {
    const { db, sqlite } = fixture();
    const oversized = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "carrera.gpx", { type: "" });
    expect(oversized.size).toBe(MAX_UPLOAD_BYTES + 1);

    const response = await uploadActivityImportResponse(requestWithFile(oversized), { id: "account-a" }, db, sqlite);
    expect(response.status).toBe(413);
  });

  it("rejects a MIME type that doesn't match the extension", async () => {
    const { db, sqlite } = fixture();
    const file = new File([new Uint8Array(10)], "carrera.gpx", { type: "application/pdf" });
    const response = await uploadActivityImportResponse(requestWithFile(file), { id: "account-a" }, db, sqlite);
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("UNSUPPORTED_ACTIVITY_FILE");
  });

  it("allows an empty or generic application/octet-stream MIME (common for watch exports)", async () => {
    const validGpx = `<?xml version="1.0"?><gpx><trk><type>running</type><trkseg><trkpt lat="1" lon="1"><time>2026-08-10T08:00:00Z</time></trkpt><trkpt lat="1" lon="1"><time>2026-08-10T08:05:00Z</time></trkpt></trkseg></trk></gpx>`;

    const { db: dbA, sqlite: sqliteA } = fixture();
    const emptyMime = new File([validGpx], "carrera.gpx", { type: "" });
    const responseEmpty = await uploadActivityImportResponse(requestWithFile(emptyMime), { id: "account-a" }, dbA, sqliteA);
    expect(responseEmpty.status).toBe(200);

    const { db: dbB, sqlite: sqliteB } = fixture();
    const octetStream = new File([validGpx], "carrera.gpx", { type: "application/octet-stream" });
    const responseOctet = await uploadActivityImportResponse(requestWithFile(octetStream), { id: "account-a" }, dbB, sqliteB);
    expect(responseOctet.status).toBe(200);
  });
});
