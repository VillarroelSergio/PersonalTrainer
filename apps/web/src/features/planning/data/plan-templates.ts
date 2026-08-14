import type { PlanTemplate } from "@/features/planning/domain/plan-template";
import { GYM_PLAN_TEMPLATES_V3 } from "@/features/planning/data/plan-templates-v3";

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
        catalog: { level: "beginner", goals: ["active_lifestyle", "muscle_gain"], durationMinutes: 40 },
        content: {
          essentialCapabilities: ["no_equipment"],
          blockBlueprints: [
            { title: "Sentadilla, pecho y espalda", patterns: ["squat", "push_horizontal", "pull_horizontal", "core"] },
            { title: "Bisagra, hombros y jalón", patterns: ["hinge", "push_vertical", "pull_horizontal", "core"] },
            { title: "Unilateral, empuje y core", patterns: ["lunge", "push_horizontal", "pull_vertical", "core"] }
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
        catalog: { level: "beginner", goals: ["strength", "muscle_gain"], durationMinutes: 60 },
        content: {
          essentialCapabilities: ["free_weights", "benches_supports"],
          blockBlueprints: [
            { title: "Sentadilla, pecho y espalda", patterns: ["squat", "push_horizontal", "pull_horizontal", "core"] },
            { title: "Bisagra, hombros y jalón", patterns: ["hinge", "push_vertical", "pull_vertical", "core"] },
            { title: "Unilateral, pecho y espalda", patterns: ["lunge", "push_horizontal", "pull_horizontal", "core"] }
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
        name: "Torso y pierna · gimnasio completo",
        environmentKind: "full_gym",
        editorialNote: EDITORIAL_NOTE,
        catalog: { level: "intermediate", goals: ["strength", "muscle_gain"], durationMinutes: 60 },
        content: {
          essentialCapabilities: ["free_weights", "benches_supports", "cables_torso"],
          blockBlueprints: [
            { title: "Torso: pecho, espalda y hombros", patterns: ["push_horizontal", "pull_horizontal", "push_vertical", "pull_vertical"] },
            { title: "Pierna: sentadilla y cadena posterior", patterns: ["squat", "hinge", "lunge", "core"] },
            { title: "Torso: espalda y brazos", patterns: ["push_horizontal", "pull_horizontal", "elbow_flexion", "elbow_extension"] },
            { title: "Pierna: unilateral y gemelos", patterns: ["hinge", "squat", "lunge", "plantarflexion"] }
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
        catalog: { level: "intermediate", goals: ["muscle_gain", "strength"], durationMinutes: 60 },
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
  },
  {
    templateId: "machines-cables-3d-gym",
    versions: [{
      templateId: "machines-cables-3d-gym", version: "1.0.0", catalogVersion: "catalog-v2",
      name: "Máquinas y poleas · 3 días", environmentKind: "full_gym", editorialNote: EDITORIAL_NOTE,
      catalog: { level: "beginner", goals: ["muscle_gain", "active_lifestyle"], durationMinutes: 60 },
      content: {
        essentialCapabilities: ["cables_torso", "leg_machines"],
        blockBlueprints: [
          { title: "Cuádriceps, pecho y espalda", patterns: ["squat", "push_horizontal", "pull_horizontal", "core"] },
          { title: "Cadena posterior y hombros", patterns: ["hinge", "push_vertical", "pull_vertical", "core"] },
          { title: "Pierna, espalda y tríceps", patterns: ["squat", "pull_horizontal", "elbow_extension", "plantarflexion"] }
        ]
      }
    }]
  },
  {
    templateId: "hypertrophy-upper-lower-4d-gym",
    versions: [{
      templateId: "hypertrophy-upper-lower-4d-gym", version: "1.0.0", catalogVersion: "catalog-v2",
      name: "Hipertrofia torso / pierna · 4 días", environmentKind: "full_gym", editorialNote: EDITORIAL_NOTE,
      catalog: { level: "intermediate", goals: ["muscle_gain"], durationMinutes: 60 },
      content: {
        essentialCapabilities: ["free_weights", "benches_supports", "cables_torso", "leg_machines"],
        blockBlueprints: [
          { title: "Torso A", patterns: ["push_horizontal", "pull_horizontal", "push_vertical", "elbow_flexion", "elbow_extension"] },
          { title: "Pierna A", patterns: ["squat", "hinge", "lunge", "plantarflexion"] },
          { title: "Torso B", patterns: ["pull_vertical", "push_horizontal", "pull_horizontal", "elbow_flexion", "elbow_extension"] },
          { title: "Pierna B", patterns: ["hinge", "squat", "lunge", "core"] }
        ]
      }
    }]
  },
  {
    templateId: "strength-accessories-5d-gym",
    versions: [{
      templateId: "strength-accessories-5d-gym", version: "1.0.0", catalogVersion: "catalog-v2",
      name: "Fuerza y accesorios · 5 días", environmentKind: "full_gym", editorialNote: EDITORIAL_NOTE,
      catalog: { level: "advanced", goals: ["strength"], durationMinutes: 90 },
      content: {
        essentialCapabilities: ["free_weights", "benches_supports", "cables_torso", "leg_machines"],
        blockBlueprints: [
          { title: "Pierna de fuerza", patterns: ["squat", "hinge", "core"] },
          { title: "Empuje de fuerza", patterns: ["push_horizontal", "push_vertical", "elbow_extension"] },
          { title: "Tracción de fuerza", patterns: ["pull_horizontal", "pull_vertical", "elbow_flexion"] },
          { title: "Pierna y gemelo", patterns: ["hinge", "lunge", "plantarflexion"] },
          { title: "Torso y brazos", patterns: ["push_horizontal", "pull_horizontal", "elbow_flexion", "elbow_extension"] }
        ]
      }
    }]
  },
  {
    templateId: "hypertrophy-split-5d-gym",
    versions: [{
      templateId: "hypertrophy-split-5d-gym", version: "1.0.0", catalogVersion: "catalog-v2",
      name: "Hipertrofia por grupos · 5 días", environmentKind: "full_gym", editorialNote: EDITORIAL_NOTE,
      catalog: { level: "advanced", goals: ["muscle_gain"], durationMinutes: 60 },
      content: {
        essentialCapabilities: ["free_weights", "benches_supports", "cables_torso", "leg_machines"],
        blockBlueprints: [
          { title: "Pecho y tríceps", patterns: ["push_horizontal", "push_vertical", "elbow_extension"] },
          { title: "Espalda y bíceps", patterns: ["pull_horizontal", "pull_vertical", "elbow_flexion"] },
          { title: "Cuádriceps y gemelo", patterns: ["squat", "lunge", "plantarflexion"] },
          { title: "Hombros y core", patterns: ["push_vertical", "pull_horizontal", "core"] },
          { title: "Isquios y glúteos", patterns: ["hinge", "lunge", "core"] }
        ]
      }
    }]
    },
  ...GYM_PLAN_TEMPLATES_V3
];
