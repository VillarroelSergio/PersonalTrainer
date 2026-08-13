import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { isTrustedDevelopmentOrigin } from "@/lib/auth-origin";

export function productionTrustedOrigins(
  configuredOrigin: string,
  vercelProductionDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL,
  vercelDeploymentDomain = process.env.VERCEL_URL,
  vercelBranchDomain = process.env.VERCEL_BRANCH_URL
): string[] {
  const origins = [configuredOrigin];

  for (const domain of [vercelProductionDomain, vercelDeploymentDomain, vercelBranchDomain]) {
    if (!domain) continue;
    try {
      origins.push(new URL(`https://${domain}`).origin);
    } catch {
      // Vercel's system values are optional; invalid values must not broaden trust.
    }
  }

  // Vercel creates project-scoped aliases such as
  // personaltrainerhub-git-main-lupercal.vercel.app. An installed PWA can keep
  // one of those aliases even after a later deployment is promoted, so allow
  // only aliases belonging to this project — never arbitrary Vercel domains.
  origins.push("https://personaltrainerhub-*.vercel.app");

  return [...new Set(origins)];
}

export function createAuth(disableSignUp = true) {
  const localOrigin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const trustedOrigins = process.env.NODE_ENV === "development"
    ? (request?: Request) => {
      const origin = request?.headers.get("origin");
      return [...new Set([
        localOrigin,
        "http://127.0.0.1:3000",
        ...(isTrustedDevelopmentOrigin(origin) && origin ? [origin] : [])
      ])];
    }
    : productionTrustedOrigins(localOrigin);

  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: { enabled: true, disableSignUp },
    trustedOrigins
  });
}

/**
 * Production keeps registration closed because accounts are provisioned
 * manually. The local development app needs a recovery path after a test
 * account is deliberately deleted, so the login page can create a new local
 * account without changing production behaviour.
 */
export const auth = createAuth(process.env.NODE_ENV !== "development");
