import { createAuthClient } from "better-auth/react";

// Keep authentication on the origin that served the app. This avoids a
// cross-origin request when a Vercel alias or an installed PWA is in use.
export const authClient = createAuthClient();
