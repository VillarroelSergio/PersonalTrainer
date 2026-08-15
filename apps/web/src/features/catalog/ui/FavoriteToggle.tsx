"use client";

import { useState } from "react";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { useOfflineSyncContext } from "@/lib/offline/OfflineSyncContext";
import { toggleFavoriteOffline } from "@/features/catalog/domain/favorites-offline";

export function FavoriteToggle({ variantId, initialFavorite, compact }: { variantId: string; initialFavorite: boolean; compact?: boolean }) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, setPending] = useState(false);
  const offlineData = useOfflineData();
  const sync = useOfflineSyncContext();

  async function toggle() {
    setPending(true);
    try {
      const response = await fetch(`/api/v1/me/favorites/exercise-variants/${variantId}`, { method: favorite ? "DELETE" : "PUT", credentials: "same-origin" });
      if (!response.ok) throw new Error("request failed");
      setFavorite((current) => !current);
    } catch {
      if (offlineData.snapshot) {
        const result = toggleFavoriteOffline(offlineData.snapshot, variantId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
        setFavorite((current) => !current);
      }
    }
    setPending(false);
  }

  return (
    <button
      type="button"
      className={`icon-btn favbtn${compact ? " favbtn--sm" : ""}`}
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorite}
      aria-label={favorite ? "Quitar de favoritas" : "Marcar como favorita"}
    >
      {favorite ? "★" : "☆"}
    </button>
  );
}
