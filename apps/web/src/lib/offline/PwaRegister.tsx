"use client";

import { useEffect } from "react";

/** Registers /sw.js once on mount. Silently no-ops where service workers aren't supported (e.g. some in-app browsers) — installability degrades gracefully, it never blocks the app. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
