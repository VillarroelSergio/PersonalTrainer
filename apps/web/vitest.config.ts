import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "node",
    // ponytail: defaults to the disposable local test Postgres (docker run
    // postgres:16-alpine -p 55432:5432, db trainer_test, user/pass postgres/trainer)
    // so `auth.ts`'s eager `getDb()` at import time doesn't throw and live-DB
    // tests actually run instead of skipping. Override DATABASE_URL to point
    // elsewhere (e.g. CI's own disposable Postgres) when this default isn't running.
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://postgres:trainer@localhost:55432/trainer_test",
      // Tests set an explicit lower limit when they exercise the pilot cap;
      // the default must not depend on unrelated rows in the shared test DB.
      PILOT_ACCOUNT_LIMIT: "1000"
    },
    include: ["apps/web/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["apps/web/src/contracts/onboarding.ts", "apps/web/src/features/identity/authorization.ts", "apps/web/src/features/planning/domain/plan-proposal.ts", "apps/web/src/features/planning/domain/training-plan-repository.ts", "apps/web/src/app/api/v1/plan-proposals/handler.ts"],
      reporter: ["text", "json-summary"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }
    }
  }
});
