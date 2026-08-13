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
    include: ["apps/web/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["apps/web/src/contracts/onboarding.ts", "apps/web/src/features/identity/authorization.ts", "apps/web/src/features/planning/domain/plan-proposal.ts", "apps/web/src/features/planning/domain/training-plan-repository.ts", "apps/web/src/app/api/v1/plan-proposals/handler.ts"],
      reporter: ["text", "json-summary"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }
    }
  }
});
