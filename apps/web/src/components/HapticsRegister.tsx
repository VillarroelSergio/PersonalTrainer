"use client";

import { useEffect } from "react";

/** Short vibration on button taps, mirroring the prototype's wireHaptics.
 * No-ops where the Vibration API isn't supported (desktop, iOS Safari). */
export function HapticsRegister() {
  useEffect(() => {
    if (!("vibrate" in navigator)) return;
    function handleClick(event: MouseEvent) {
      if ((event.target as HTMLElement).closest('button, .btn, [role="button"]')) navigator.vibrate(10);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);
  return null;
}
