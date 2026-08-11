/** Minimal, non-clinical recovery/mobility template (Bloqueante 3). General wellness framing only — never a diagnosis, treatment, or exercise prescription for an injury. */
export type RecoveryBlock = { title: string; instruction: string; durationMinutes: number };

export const RECOVERY_TEMPLATE: RecoveryBlock[] = [
  { title: "Movilidad general", instruction: "Movimientos suaves y de rango amplio en las articulaciones principales, sin forzar ni buscar dolor.", durationMinutes: 5 },
  { title: "Activación ligera", instruction: "Ejercicios de bajo impacto muy por debajo de tu esfuerzo habitual, respirando de forma controlada.", durationMinutes: 10 },
  { title: "Vuelta a la calma", instruction: "Estiramientos suaves y respiración pausada para cerrar la sesión.", durationMinutes: 5 }
];

export const RECOVERY_TOTAL_MINUTES = RECOVERY_TEMPLATE.reduce((sum, block) => sum + block.durationMinutes, 0);

export const RECOVERY_WELLBEING_NOTE = "Sesión de bienestar general, no un tratamiento ni un diagnóstico. Si la molestia persiste o es intensa, consulta a un profesional de salud.";
