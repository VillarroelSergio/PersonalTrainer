import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { isTrustedDevelopmentOrigin } from "@/lib/auth-origin";

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
    : [localOrigin];

  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
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
