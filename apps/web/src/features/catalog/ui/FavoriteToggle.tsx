"use client";

import { useState } from "react";

export function FavoriteToggle({ variantId, initialFavorite }: { variantId: string; initialFavorite: boolean }) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const response = await fetch(`/api/v1/me/favorites/exercise-variants/${variantId}`, { method: favorite ? "DELETE" : "PUT", credentials: "same-origin" });
    if (response.ok) setFavorite((current) => !current);
    setPending(false);
  }

  return (
    <button
      type="button"
      className="icon-btn favbtn"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorite}
      aria-label={favorite ? "Quitar de favoritas" : "Marcar como favorita"}
    >
      {favorite ? "★" : "☆"}
    </button>
  );
}
