"use client";

import { useEffect, useState } from "react";

/** Reads the real display-mode at mount instead of the old server-side placeholder text.
 * ponytail: a factual read of matchMedia/navigator.standalone, no install-prompt capture. */
export function InstallStatus() {
  const [installed, setInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true);
  }, []);

  if (installed === null) return null;
  return <>{installed ? "Instalada en este dispositivo." : "Se puede instalar desde el menú del navegador."}</>;
}
