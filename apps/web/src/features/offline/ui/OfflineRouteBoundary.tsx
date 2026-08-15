"use client";

import type { ReactNode } from "react";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";

/**
 * Reusable client boundary for pages that build their view from
 * `snapshot.data` (Fase 5, Task 6). Renders `children` only once a snapshot
 * exists — before that (still hydrating, or genuinely offline on a device
 * that never completed the first sync) it renders a minimal placeholder
 * instead of a half-built page.
 */
export function OfflineRouteBoundary({ children }: { children: ReactNode }) {
  const { snapshot, status } = useOfflineData();

  if (!snapshot) {
    if (status === "needs-initial-sync") {
      return (
        <div className="empty-state">
          <p>Conexión inicial necesaria. Conéctate una vez para poder usar esta vista sin conexión.</p>
        </div>
      );
    }
    // "loading" (still hydrating from IndexedDB/network) or "offline"/"synced" with a snapshot
    // not yet applied to state — never the "needs-initial-sync" message during this window.
    return (
      <div className="empty-state">
        <p>Cargando…</p>
      </div>
    );
  }

  return <>{children}</>;
}
