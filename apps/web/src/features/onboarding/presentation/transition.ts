export const TRANSITION_DURATION_MS = 5000;
export const TRANSITION_MAX_PERCENT = 99;

export const TRANSITION_PHASES: Array<{ upTo: number; text: string }> = [
  { upTo: 34, text: "Ordenamos tu semana" },
  { upTo: 69, text: "Equilibramos fuerza y actividad exterior" },
  { upTo: 99, text: "Preparamos alternativas compatibles" }
];

// Deriva el % 0-99 del tiempo transcurrido (no de pasos fijos) para que la
// franja completa dure exactamente TRANSITION_DURATION_MS con un solo driver.
export function percentForElapsed(elapsedMs: number, durationMs: number = TRANSITION_DURATION_MS): number {
  const pct = Math.floor((elapsedMs / durationMs) * (TRANSITION_MAX_PERCENT + 1));
  return Math.max(0, Math.min(TRANSITION_MAX_PERCENT, pct));
}

export function phaseForPercent(pct: number): { upTo: number; text: string } {
  return TRANSITION_PHASES.find((phase) => pct <= phase.upTo) ?? TRANSITION_PHASES[TRANSITION_PHASES.length - 1];
}
