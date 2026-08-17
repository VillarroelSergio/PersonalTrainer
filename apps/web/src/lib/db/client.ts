import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let sql: Sql | undefined;
let db: PostgresJsDatabase<typeof schema> | undefined;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return url;
}

export function getSql(): Sql {
  // Vercel functions are short-lived. Keep the pool bounded while allowing
  // independent reads in one render to overlap; prepared statements are
  // incompatible with Supabase transaction pooling.
  // 8, now that DATABASE_URL points at Supabase's transaction pooler (port 6543) rather than
  // the session pooler (5432). Under session pooling each client connection held a real
  // Postgres backend for its whole life, so a wide pool per warm instance ate into the 60
  // available; transaction pooling hands the backend back between statements, so this mostly
  // costs pooler client slots. It exists so /api/v1/offline-snapshot's 16 independent reads
  // actually overlap instead of draining two at a time. prepare:false is required here — the
  // transaction pooler cannot carry prepared statements across statements.
  if (!sql) sql = postgres(connectionString(), { prepare: false, max: 8 });
  return sql;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!db) db = drizzle(getSql(), { schema });
  return db;
}
