import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb, getSql } from "@/lib/db/client";

async function run() {
  await migrate(getDb(), { migrationsFolder: "apps/web/drizzle" });
  await getSql().end();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
