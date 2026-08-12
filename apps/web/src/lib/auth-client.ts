import { createAuthClient } from "better-auth/react";

// Without an explicit public URL, keep authentication on the current origin.
// This lets local development work consistently through localhost or 127.0.0.1.
export const authClient = createAuthClient(
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL
    ? { baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL }
    : {}
);
