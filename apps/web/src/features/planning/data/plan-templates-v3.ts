import type { Goal } from "@/contracts/onboarding";
import type { EquipmentCapability } from "@/features/catalog/domain/editorial-content";
import type { PlanTemplate, SessionBlockBlueprint } from "@/features/planning/domain/plan-template";

const EDITORIAL_NOTE = "Punto de partida editorial para entrenar; no es una prescripción profesional ni garantiza resultados. Puedes editar cada sesión antes de activarla.";

function gymTemplate(
  templateId: string,
  name: string,
  level: "beginner" | "intermediate" | "advanced",
  goals: Goal[],
  durationMinutes: 60 | 90,
  essentialCapabilities: EquipmentCapability[],
  blockBlueprints: SessionBlockBlueprint[]
): PlanTemplate {
  return {
    templateId,
    versions: [{
      templateId,
      version: "1.0.0",
      catalogVersion: "catalog-v3",
      name,
      environmentKind: "full_gym",
      editorialNote: EDITORIAL_NOTE,
      catalog: { level, goals, durationMinutes },
      content: { essentialCapabilities, blockBlueprints }
    }]
  };
}

export const GYM_PLAN_TEMPLATES_V3: PlanTemplate[] = [
  gymTemplate("full-body-strength-3d-gym", "Fuerza full-body · 3 días", "beginner", ["strength", "active_lifestyle"], 60, ["free_weights", "benches_supports"], [
    { title: "Fuerza A", patterns: ["squat", "push_horizontal", "pull_horizontal", "core"] },
    { title: "Fuerza B", patterns: ["hinge", "push_vertical", "pull_vertical", "core"] },
    { title: "Fuerza C", patterns: ["lunge", "push_horizontal", "pull_horizontal", "plantarflexion"] }
  ]),
  gymTemplate("full-body-hypertrophy-3d-gym", "Hipertrofia full-body · 3 días", "intermediate", ["muscle_gain"], 60, ["free_weights", "benches_supports", "cables_torso"], [
    { title: "Volumen A", patterns: ["squat", "push_horizontal", "pull_horizontal", "elbow_flexion"] },
    { title: "Volumen B", patterns: ["hinge", "push_vertical", "pull_vertical", "elbow_extension"] },
    { title: "Volumen C", patterns: ["lunge", "push_horizontal", "pull_horizontal", "core"] }
  ]),
  gymTemplate("full-body-machines-3d-gym", "Máquinas guiadas · 3 días", "beginner", ["muscle_gain", "active_lifestyle"], 60, ["leg_machines", "cables_torso"], [
    { title: "Máquinas A", patterns: ["squat", "push_horizontal", "pull_horizontal", "core"] },
    { title: "Máquinas B", patterns: ["hinge", "push_vertical", "pull_vertical", "plantarflexion"] },
    { title: "Máquinas C", patterns: ["lunge", "push_horizontal", "elbow_flexion", "elbow_extension"] }
  ]),
  gymTemplate("full-body-athletic-3d-gym", "Potencia y base atlética · 3 días", "intermediate", ["strength", "active_lifestyle"], 60, ["free_weights", "benches_supports"], [
    { title: "Potencia A", patterns: ["squat", "push_horizontal", "pull_horizontal", "core"] },
    { title: "Potencia B", patterns: ["hinge", "lunge", "push_vertical", "pull_vertical"] },
    { title: "Potencia C", patterns: ["squat", "hinge", "push_horizontal", "plantarflexion"] }
  ]),
  gymTemplate("upper-lower-strength-4d-gym", "Torso / pierna de fuerza · 4 días", "intermediate", ["strength"], 90, ["free_weights", "benches_supports"], [
    { title: "Torso fuerza", patterns: ["push_horizontal", "pull_horizontal", "push_vertical", "pull_vertical"] },
    { title: "Pierna fuerza", patterns: ["squat", "hinge", "core", "plantarflexion"] },
    { title: "Torso volumen", patterns: ["push_horizontal", "pull_horizontal", "elbow_flexion", "elbow_extension"] },
    { title: "Pierna volumen", patterns: ["hinge", "lunge", "squat", "core"] }
  ]),
  gymTemplate("upper-lower-machines-4d-gym", "Torso / pierna en máquinas · 4 días", "beginner", ["muscle_gain", "active_lifestyle"], 60, ["leg_machines", "cables_torso"], [
    { title: "Torso máquinas A", patterns: ["push_horizontal", "pull_horizontal", "push_vertical", "core"] },
    { title: "Pierna máquinas A", patterns: ["squat", "hinge", "lunge", "plantarflexion"] },
    { title: "Torso máquinas B", patterns: ["push_horizontal", "pull_vertical", "elbow_flexion", "elbow_extension"] },
    { title: "Pierna máquinas B", patterns: ["hinge", "squat", "lunge", "core"] }
  ]),
  gymTemplate("torso-legs-arms-4d-gym", "Torso, piernas y brazos · 4 días", "intermediate", ["muscle_gain"], 60, ["free_weights", "benches_supports", "cables_torso"], [
    { title: "Pecho y espalda", patterns: ["push_horizontal", "pull_horizontal", "core"] },
    { title: "Pierna completa", patterns: ["squat", "hinge", "lunge", "plantarflexion"] },
    { title: "Hombros y brazos", patterns: ["push_vertical", "elbow_flexion", "elbow_extension", "pull_horizontal"] },
    { title: "Pierna y espalda", patterns: ["hinge", "pull_vertical", "squat", "core"] }
  ]),
  gymTemplate("ppl-strength-5d-gym", "Empuje / tirón / pierna fuerza · 5 días", "advanced", ["strength"], 90, ["free_weights", "benches_supports", "cables_torso", "leg_machines"], [
    { title: "Empuje pesado", patterns: ["push_horizontal", "push_vertical", "elbow_extension"] },
    { title: "Tirón pesado", patterns: ["pull_horizontal", "pull_vertical", "elbow_flexion"] },
    { title: "Pierna pesada", patterns: ["squat", "hinge", "core"] },
    { title: "Empuje volumen", patterns: ["push_horizontal", "push_vertical", "elbow_extension", "core"] },
    { title: "Tirón y pierna", patterns: ["pull_horizontal", "lunge", "plantarflexion", "elbow_flexion"] }
  ]),
  gymTemplate("ppl-machines-5d-gym", "Empuje / tirón / pierna máquinas · 5 días", "intermediate", ["muscle_gain"], 60, ["cables_torso", "leg_machines"], [
    { title: "Empuje en máquinas", patterns: ["push_horizontal", "push_vertical", "elbow_extension"] },
    { title: "Tirón en poleas", patterns: ["pull_horizontal", "pull_vertical", "elbow_flexion"] },
    { title: "Pierna guiada", patterns: ["squat", "hinge", "plantarflexion"] },
    { title: "Hombro y core", patterns: ["push_vertical", "pull_horizontal", "core"] },
    { title: "Brazos y gemelo", patterns: ["elbow_flexion", "elbow_extension", "plantarflexion"] }
  ]),
  gymTemplate("powerbuilding-5d-gym", "Powerbuilding · 5 días", "advanced", ["strength", "muscle_gain"], 90, ["free_weights", "benches_supports", "cables_torso", "leg_machines"], [
    { title: "Sentadilla y cuádriceps", patterns: ["squat", "lunge", "plantarflexion"] },
    { title: "Press y pecho", patterns: ["push_horizontal", "push_vertical", "elbow_extension"] },
    { title: "Peso muerto y espalda", patterns: ["hinge", "pull_horizontal", "pull_vertical"] },
    { title: "Hombros y brazos", patterns: ["push_vertical", "elbow_flexion", "elbow_extension"] },
    { title: "Pierna posterior y core", patterns: ["hinge", "lunge", "core", "plantarflexion"] }
  ]),
  gymTemplate("glute-quad-5d-gym", "Glúteo y cuádriceps · 5 días", "advanced", ["muscle_gain"], 60, ["free_weights", "benches_supports", "leg_machines"], [
    { title: "Glúteo pesado", patterns: ["hinge", "lunge", "core"] },
    { title: "Cuádriceps", patterns: ["squat", "lunge", "plantarflexion"] },
    { title: "Torso mantenimiento", patterns: ["push_horizontal", "pull_horizontal", "push_vertical"] },
    { title: "Glúteo unilateral", patterns: ["hinge", "lunge", "core"] },
    { title: "Pierna completa", patterns: ["squat", "hinge", "plantarflexion"] }
  ]),
  gymTemplate("back-shoulders-5d-gym", "Espalda y hombros · 5 días", "advanced", ["muscle_gain", "strength"], 60, ["free_weights", "benches_supports", "cables_torso"], [
    { title: "Espalda horizontal", patterns: ["pull_horizontal", "hinge", "elbow_flexion"] },
    { title: "Hombro completo", patterns: ["push_vertical", "pull_horizontal", "core"] },
    { title: "Pecho y tríceps", patterns: ["push_horizontal", "push_vertical", "elbow_extension"] },
    { title: "Espalda vertical", patterns: ["pull_vertical", "pull_horizontal", "elbow_flexion"] },
    { title: "Pierna y core", patterns: ["squat", "lunge", "hinge", "core"] }
  ])
];
