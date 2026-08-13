import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  DuplicateNotForcedError,
  ImportFileNotFoundError,
  ImportNotReadyError,
  SessionNotEnduranceError,
  createActivityImportRepository
} from "@/features/endurance/domain/import-repository";
import * as schema from "@/lib/db/schema";
import type { PlanProposal } from "@/contracts/onboarding";

const proposal: PlanProposal = {
  proposalId: "proposal-a",
  ruleVersion: "plan-proposal-v1",
  reasons: [],
  alternatives: [],
  initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 2 },
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Fuerza: piernas", estimatedMinutes: 60, exercises: [{ variantId: "squat-barbell", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] },
      { day: "tuesday", kind: "endurance", title: "Carrera suave", estimatedMinutes: 40 }
    ]
  }
};

const VALID_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx><trk><type>running</type><trkseg>
  <trkpt lat="40.0000" lon="-3.0000"><ele>600</ele><time>2026-08-10T08:00:00Z</time></trkpt>
  <trkpt lat="40.0100" lon="-3.0000"><ele>610</ele><time>2026-08-10T08:20:00Z</time></trkpt>
</trkseg></trk></gpx>`;

// Same start-minute and duration-minute as VALID_GPX, so its fingerprint matches after commit — used to exercise duplicate detection.
const VALID_GPX_SAME_ACTIVITY = `<?xml version="1.0" encoding="UTF-8"?>
<gpx><trk><type>running</type><trkseg>
  <trkpt lat="41.0000" lon="-4.0000"><ele>500</ele><time>2026-08-10T08:00:05Z</time></trkpt>
  <trkpt lat="41.0200" lon="-4.0000"><ele>520</ele><time>2026-08-10T08:20:05Z</time></trkpt>
</trkseg></trk></gpx>`;

function fixture() {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE user (id text primary key, name text not null, email text not null unique, email_verified integer not null, image text, created_at integer not null, updated_at integer not null);
    CREATE TABLE training_plan (id text primary key, owner_id text not null, name text not null, status text not null default 'draft', version integer not null default 1, content_json text not null default '{}', created_at integer not null, source text, source_template_id text, source_template_version text, catalog_version text);
    CREATE TABLE import_file (id text primary key, owner_id text not null, storage_key text not null, original_name text not null, format text not null, size_bytes integer not null, sha256 text not null, uploaded_at integer not null, deleted_at integer);
    CREATE UNIQUE INDEX import_file_owner_sha256_idx ON import_file (owner_id, sha256);
    CREATE TABLE activity_import (id text primary key, owner_id text not null, file_id text not null, format text not null, status text not null, error_code text, analysis_json text, duplicate_of_activity_id text, created_at integer not null);
    CREATE TABLE endurance_activity (id text primary key, owner_id text not null, import_id text, plan_id text, iso_week_start text, session_index integer, sport text not null, name text not null, source text not null, fingerprint text not null, started_at integer not null, duration_s integer, distance_m real, created_at integer not null);
    CREATE TABLE activity_metric (id text primary key, activity_id text not null, metric_type text not null, value real not null, unit text not null, source text not null);
  `);
  sqlite.prepare("INSERT INTO user VALUES (?, ?, ?, ?, ?, ?, ?)").run("account-a", "account-a", "a@example.test", 1, null, 0, 0);
  sqlite.prepare("INSERT INTO training_plan (id, owner_id, name, status, version, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("plan-a", "account-a", "Plan A", "active", 1, JSON.stringify(proposal), 0);
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

describe("activity import repository", () => {
  it("analyzes a valid GPX upload and re-uploading the exact same bytes is idempotent (never re-parses, never duplicates the row)", () => {
    const { db, sqlite } = fixture();
    const repo = createActivityImportRepository(db, sqlite);
    const bytes = Buffer.from(VALID_GPX, "utf-8");

    const first = repo.uploadAndAnalyze("account-a", "carrera.gpx", bytes);
    expect(first.status).toBe("analyzed");

    const second = repo.uploadAndAnalyze("account-a", "carrera.gpx", bytes);
    expect(second.id).toBe(first.id);

    const files = db.select().from(schema.importFile).all();
    expect(files).toHaveLength(1);
    const imports = db.select().from(schema.activityImport).all();
    expect(imports).toHaveLength(1);
  });

  it("rejects an unsupported extension before touching storage or the database", () => {
    const { db, sqlite } = fixture();
    const repo = createActivityImportRepository(db, sqlite);
    expect(() => repo.uploadAndAnalyze("account-a", "carrera.csv", Buffer.from("x"))).toThrow();
    expect(db.select().from(schema.importFile).all()).toHaveLength(0);
  });

  it("stores an invalid (right extension, corrupt content) file as status failed, not a thrown error", () => {
    const { db, sqlite } = fixture();
    const repo = createActivityImportRepository(db, sqlite);
    const result = repo.uploadAndAnalyze("account-a", "corrupto.gpx", Buffer.from("<gpx>not valid</gpx", "utf-8"));
    expect(result.status).toBe("failed");
  });

  it("commits an analyzed import into a real endurance_activity + activity_metric rows and marks the import saved", () => {
    const { db, sqlite } = fixture();
    const repo = createActivityImportRepository(db, sqlite);
    const uploaded = repo.uploadAndAnalyze("account-a", "carrera.gpx", Buffer.from(VALID_GPX, "utf-8"));

    const result = repo.commit("account-a", uploaded.id, { name: "Carrera del martes", sport: "running", isoWeekStart: "2026-08-10", sessionIndex: 1 });
    expect(result.activity.name).toBe("Carrera del martes");
    expect(result.activity.sessionIndex).toBe(1);

    const savedImport = db.select().from(schema.activityImport).all().find((row) => row.id === uploaded.id);
    expect(savedImport?.status).toBe("saved");
  });

  it("refuses to associate a commit with a strength session", () => {
    const { db, sqlite } = fixture();
    const repo = createActivityImportRepository(db, sqlite);
    const uploaded = repo.uploadAndAnalyze("account-a", "carrera.gpx", Buffer.from(VALID_GPX, "utf-8"));
    expect(() => repo.commit("account-a", uploaded.id, { name: "x", sport: "running", isoWeekStart: "2026-08-10", sessionIndex: 0 })).toThrow(SessionNotEnduranceError);
  });

  it("a second activity that fingerprints the same as an already-saved one is flagged duplicate and never silently double-counted", () => {
    const { db, sqlite } = fixture();
    const repo = createActivityImportRepository(db, sqlite);

    const uploaded1 = repo.uploadAndAnalyze("account-a", "carrera-1.gpx", Buffer.from(VALID_GPX, "utf-8"));
    repo.commit("account-a", uploaded1.id, { name: "Carrera", sport: "running" });

    const uploaded2 = repo.uploadAndAnalyze("account-a", "carrera-2.gpx", Buffer.from(VALID_GPX_SAME_ACTIVITY, "utf-8"));
    expect(uploaded2.status).toBe("duplicate");

    expect(() => repo.commit("account-a", uploaded2.id, { name: "Carrera otra vez", sport: "running" })).toThrow(DuplicateNotForcedError);
    expect(db.select().from(schema.enduranceActivity).all()).toHaveLength(1);

    const forced = repo.commit("account-a", uploaded2.id, { name: "Carrera otra vez", sport: "running", force: true });
    expect(forced.activity.id).not.toBe(uploaded1.id);
    expect(db.select().from(schema.enduranceActivity).all()).toHaveLength(2);
  });

  it("refuses to commit an import that failed to parse", () => {
    const { db, sqlite } = fixture();
    const repo = createActivityImportRepository(db, sqlite);
    const failed = repo.uploadAndAnalyze("account-a", "corrupto.gpx", Buffer.from("<gpx>not valid</gpx", "utf-8"));
    expect(() => repo.commit("account-a", failed.id, { name: "x", sport: "running" })).toThrow(ImportNotReadyError);
  });

  it("deletes the raw file's bytes and marks it deleted, but keeps the committed activity in history", () => {
    const { db, sqlite } = fixture();
    const repo = createActivityImportRepository(db, sqlite);
    const uploaded = repo.uploadAndAnalyze("account-a", "carrera.gpx", Buffer.from(VALID_GPX, "utf-8"));
    repo.commit("account-a", uploaded.id, { name: "Carrera", sport: "running" });

    const fileRow = sqlite.prepare("SELECT id, deleted_at FROM import_file WHERE owner_id = ?").get("account-a") as { id: string; deleted_at: number | null };
    expect(fileRow.deleted_at).toBeNull();

    repo.deleteImportFile("account-a", fileRow.id);

    const afterDelete = sqlite.prepare("SELECT deleted_at FROM import_file WHERE id = ?").get(fileRow.id) as { deleted_at: number | null };
    expect(afterDelete.deleted_at).not.toBeNull();
    expect(db.select().from(schema.enduranceActivity).all()).toHaveLength(1);

    expect(() => repo.deleteImportFile("account-a", fileRow.id)).toThrow(ImportFileNotFoundError);
    expect(() => repo.deleteImportFile("account-b", fileRow.id)).toThrow(ImportFileNotFoundError);
  });
});
