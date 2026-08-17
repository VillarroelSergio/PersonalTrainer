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
  // max was 2, which capped /api/v1/offline-snapshot's 16 independent reads at two in
  // flight no matter how they were issued. 8 keeps the per-instance footprint small
  // against Supabase's transaction pooler while letting that endpoint's widest wave
  // actually overlap. ponytail: raise further only if a wider read shows up.
  if (!sql) sql = postgres(connectionString(), { prepare: false, max: 8 });
  return sql;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!db) db = drizzle(getSql(), { schema });
  return db;
}
