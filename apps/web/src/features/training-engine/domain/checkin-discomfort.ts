import type { Discomfort } from "@/features/onboarding/presentation/types";

export type MolestiaLevel = "none" | "mild" | "moderate" | "important";

/** Picker de 4 niveles compartido por /checkin y el cierre de sesión de fuerza (prototype/js/views/strength.js MOLESTIA_CIERRE_OPCIONES): una sola fuente de las etiquetas. */
export const MOLESTIA_OPTIONS: Array<{ value: MolestiaLevel; label: string }> = [
  { value: "none", label: "Ninguna" },
  { value: "mild", label: "Leve" },
  { value: "moderate", label: "Moderada" },
  { value: "important", label: "Importante" }
];

/** El mapa corporal solo se revela cuando se declara una molestia (VISUAL-PARITY-CONTRACT.md §/checkin). */
export function isBodyMapVisible(level: MolestiaLevel): boolean {
  return level !== "none";
}

/** Al volver a "Ninguna" la zona declarada se descarta antes de enviar: nunca se envía una zona huérfana de un nivel ya retirado. */
export function resolveDiscomfortForSubmit(level: MolestiaLevel, discomfort: Discomfort | null): Discomfort | null {
  return level === "none" ? null : discomfort;
}
