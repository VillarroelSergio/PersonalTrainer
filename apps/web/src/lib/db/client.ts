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
  // max stays at 2 deliberately: /api/v1/offline-snapshot issues its 16 independent reads
  // concurrently, so a wider pool would finish it faster, but 2 keeps the per-instance
  // footprint predictable against Supabase's connection limits across many warm instances.
  // Raise it only with a look at the Supabase connection budget first.
  if (!sql) sql = postgres(connectionString(), { prepare: false, max: 2 });
  return sql;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!db) db = drizzle(getSql(), { schema });
  return db;
}
