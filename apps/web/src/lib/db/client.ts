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
  if (!sql) sql = postgres(connectionString());
  return sql;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!db) db = drizzle(getSql(), { schema });
  return db;
}
