import type { PlanTemplate } from "@/features/planning/domain/plan-template";

/**
 * Biblioteca inicial de plantillas (Task 4). Son un punto de partida
 * razonable para empezar a entrenar, no prescripciones validadas
 * profesionalmente ni promesas de resultado.
 */
const EDITORIAL_NOTE = "Punto de partida razonable para empezar; no es una prescripción validada profesionalmente ni garantiza resultados. Puedes editar cualquier sesión antes de activarla.";

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    templateId: "full-body-home",
    versions: [
      {
        templateId: "full-body-home",
        version: "1.0.0",
        catalogVersion: "catalog-v1",
        name: "Cuerpo completo en casa",
        environmentKind: "home",
        editorialNote: EDITORIAL_NOTE,
        content: {
          essentialCapabilities: ["no_equipment"],
          blockBlueprints: [
            { title: "Cuerpo completo A", patterns: ["squat", "push_horizontal", "pull_horizontal", "core"] },
            { title: "Cuerpo completo B", patterns: ["hinge", "push_vertical", "pull_horizontal", "core"] },
            { title: "Cuerpo completo C", patterns: ["lunge", "push_horizontal", "pull_vertical", "core"] }
          ]
        }
      }
    ]
  },
  {
    templateId: "full-body-gym",
    versions: [
      {
        templateId: "full-body-gym",
        version: "1.0.0",
        catalogVersion: "catalog-v1",
        name: "Cuerpo completo en gimnasio",
        environmentKind: "full_gym",
        editorialNote: EDITORIAL_NOTE,
        content: {
          essentialCapabilities: ["free_weights", "benches_supports"],
          blockBlueprints: [
            { title: "Cuerpo completo A", patterns: ["squat", "push_horizontal", "pull_horizontal", "core"] },
            { title: "Cuerpo completo B", patterns: ["hinge", "push_vertical", "pull_vertical", "core"] },
            { title: "Cuerpo completo C", patterns: ["lunge", "push_horizontal", "pull_horizontal", "core"] }
          ]
        }
      }
    ]
  },
  {
    templateId: "upper-lower-gym",
    versions: [
      {
        templateId: "upper-lower-gym",
        version: "1.0.0",
        catalogVersion: "catalog-v1",
        name: "Tren superior / tren inferior en gimnasio",
        environmentKind: "full_gym",
        editorialNote: EDITORIAL_NOTE,
        content: {
          essentialCapabilities: ["free_weights", "benches_supports", "cables_torso"],
          blockBlueprints: [
            { title: "Tren superior A", patterns: ["push_horizontal", "pull_horizontal", "push_vertical", "pull_vertical"] },
            { title: "Tren inferior A", patterns: ["squat", "hinge", "lunge", "core"] },
            { title: "Tren superior B", patterns: ["push_horizontal", "pull_horizontal", "elbow_flexion", "elbow_extension"] },
            { title: "Tren inferior B", patterns: ["hinge", "squat", "lunge", "plantarflexion"] }
          ]
        }
      }
    ]
  },
  {
    templateId: "ppl-gym",
    versions: [
      {
        templateId: "ppl-gym",
        version: "1.0.0",
        catalogVersion: "catalog-v1",
        name: "Empuje / tirón / pierna en gimnasio",
        environmentKind: "full_gym",
        editorialNote: EDITORIAL_NOTE,
        content: {
          essentialCapabilities: ["free_weights", "benches_supports", "cables_torso", "leg_machines"],
          blockBlueprints: [
            { title: "Empuje", patterns: ["push_horizontal", "push_vertical", "elbow_extension", "core"] },
            { title: "Tirón", patterns: ["pull_horizontal", "pull_vertical", "elbow_flexion", "core"] },
            { title: "Pierna", patterns: ["squat", "hinge", "lunge", "plantarflexion"] }
          ]
        }
      }
    ]
  }
];
