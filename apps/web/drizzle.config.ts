import type { Config } from "drizzle-kit";

export default {
  schema: "./apps/web/src/lib/db/schema.ts",
  out: "./apps/web/drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! }
} satisfies Config;
