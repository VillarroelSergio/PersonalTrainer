"use client";

import { useEffect } from "react";

/** Reports uncaught client errors to /api/client-error so they land in Vercel Runtime Logs.
 * keepalive lets the request survive a page unload; reporting itself must never throw. */
export function ClientErrorReporter() {
  useEffect(() => {
    function report(payload: { message: string; stack?: string; url?: string; name?: string }) {
      fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
    function handleError(event: ErrorEvent) {
      report({ message: event.message, stack: event.error?.stack, url: location.href, name: event.error?.name });
    }
    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      if (reason instanceof Error) {
        report({ message: reason.message, stack: reason.stack, url: location.href, name: reason.name });
      } else {
        report({ message: String(reason), url: location.href });
      }
    }
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);
  return null;
}
