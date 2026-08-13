/**
 * Bloque no ligado a series/repeticiones (Task 3). Los bloques de
 * movilidad/calentamiento/vuelta a la calma nunca alimentan progresión ni
 * volumen de fuerza: solo `kind: "strength"` cuenta como exposición de fuerza.
 */
export type TrainingBlock = {
  id: string;
  kind: "strength" | "warmup" | "mobility" | "cooldown";
  estimatedMinutes: number;
  instructions: string;
  variantIds?: string[];
};

export function contributesToStrengthProgression(block: TrainingBlock): boolean {
  return block.kind === "strength";
}
