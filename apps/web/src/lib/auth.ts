import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export function createAuth(disableSignUp = true) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true, disableSignUp },
    trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"]
  });
}

/** The app instance never exposes public account registration. */
export const auth = createAuth();
