import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "@/lib/db/client";

migrate(db, { migrationsFolder: "apps/web/drizzle" });
sqlite.close();
