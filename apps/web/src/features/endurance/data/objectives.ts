import type { EnduranceObjective } from "@/contracts/endurance";

export type EnduranceSegmentKind = "warmup" | "work" | "recovery" | "cooldown";

export type EnduranceSegment = { kind: EnduranceSegmentKind; label: string; durationMin: number; intensityText: string };
export type EnduranceSegmentGroup = { repeat: number; work: EnduranceSegment; recovery: EnduranceSegment };
export type EnduranceStructureEntry = ({ type: "segment" } & EnduranceSegment) | ({ type: "group" } & EnduranceSegmentGroup);

export type EnduranceObjectiveTemplate = {
  id: EnduranceObjective;
  name: string;
  durationText: string;
  intensityText: string;
  purpose: string;
  /** Ordered warmup -> (work/group)* -> cooldown. Continuous objectives (base, recovery) omit this: a single continuous block. */
  structure?: EnduranceStructureEntry[];
};

/**
 * Fase 4: siete objetivos editoriales fijos (bloques calentamiento/trabajo/
 * recuperación-repetible/vuelta a la calma). La guía humana en `intensityText`
 * es lo primario; duración/ritmo/potencia/FC son capas opcionales que la
 * persona añade aparte (ver enduranceDesignInputSchema.optionalLayers).
 */
export const ENDURANCE_OBJECTIVES: EnduranceObjectiveTemplate[] = [
  {
    id: "base",
    name: "Base aeróbica",
    durationText: "30-50 min",
    intensityText: "Ritmo constante y cómodo: podrías mantener una conversación.",
    purpose: "Construir resistencia general sin acumular fatiga."
  },
  {
    id: "intervals",
    name: "Intervalos",
    durationText: "30-40 min",
    intensityText: "Tramos de trabajo fuertes con recuperación suave entre medio.",
    purpose: "Mejorar la capacidad de sostener un ritmo más alto.",
    structure: [
      { type: "segment", kind: "warmup", label: "Calentamiento", durationMin: 10, intensityText: "Ritmo suave, progresivo." },
      { type: "group", repeat: 6, work: { kind: "work", label: "Tramo fuerte", durationMin: 3, intensityText: "Ritmo exigente, sostenible durante el tramo." }, recovery: { kind: "recovery", label: "Recuperación", durationMin: 2, intensityText: "Trote o caminar suave." } },
      { type: "segment", kind: "cooldown", label: "Vuelta a la calma", durationMin: 8, intensityText: "Ritmo suave, bajando pulsaciones." }
    ]
  },
  {
    id: "sprints",
    name: "Series cortas",
    durationText: "25-35 min",
    intensityText: "Esfuerzos muy cortos y máximos, con recuperación larga.",
    purpose: "Trabajar potencia y técnica a alta intensidad.",
    structure: [
      { type: "segment", kind: "warmup", label: "Calentamiento", durationMin: 10, intensityText: "Progresivo, incluye 2-3 activaciones cortas." },
      { type: "group", repeat: 8, work: { kind: "work", label: "Sprint", durationMin: 0.5, intensityText: "Esfuerzo casi máximo." }, recovery: { kind: "recovery", label: "Recuperación", durationMin: 1.5, intensityText: "Caminar o parar." } },
      { type: "segment", kind: "cooldown", label: "Vuelta a la calma", durationMin: 8, intensityText: "Ritmo suave." }
    ]
  },
  {
    id: "long_run",
    name: "Tirada larga",
    durationText: "60-120 min",
    intensityText: "Ritmo cómodo y sostenido durante más tiempo del habitual.",
    purpose: "Acumular resistencia y tiempo en pie/pedal."
  },
  {
    id: "recovery",
    name: "Recuperación activa",
    durationText: "15-30 min",
    intensityText: "Muy suave, sin buscar ritmo ni esfuerzo.",
    purpose: "Favorecer la recuperación entre sesiones exigentes."
  },
  {
    id: "bike",
    name: "Bici",
    durationText: "30-60 min",
    intensityText: "Ritmo constante, cadencia cómoda.",
    purpose: "Actividad de bajo impacto para sumar resistencia."
  },
  {
    id: "walk",
    name: "Caminar",
    durationText: "20-45 min",
    intensityText: "Paso vivo, mantenible sin fatiga.",
    purpose: "Actividad accesible para sumar movimiento sin impacto."
  }
];

export function findEnduranceObjective(id: string): EnduranceObjectiveTemplate | undefined {
  return ENDURANCE_OBJECTIVES.find((objective) => objective.id === id);
}
