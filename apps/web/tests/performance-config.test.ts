import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");

describe("production performance configuration", () => {
  it("runs Vercel functions next to the Supabase Europe region", () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as { regions?: string[] };

    expect(vercel.regions).toEqual(["fra1"]);
  });

  it("uses a serverless-safe Postgres client configuration", () => {
    const client = readFileSync(join(ROOT, "apps", "web", "src", "lib", "db", "client.ts"), "utf8");

    expect(client).toContain("postgres(connectionString(), { prepare: false, max: 2 })");
  });
});
