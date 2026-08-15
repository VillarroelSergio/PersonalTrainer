import type { OnboardingDraft, PlanProposal } from "@/contracts/onboarding";
import { assignSessionExercises } from "./session-exercise-assignment";
import { FOUNDATION_BLOCKS } from "@/features/catalog/data/foundation-blocks";
import { isEquipmentRequirementSatisfied } from "@/features/catalog/domain/editorial-content";
import { capabilitiesForEnvironment, type EquipmentProfile } from "@/features/catalog/domain/inventory";
import { PLAN_TEMPLATES } from "@/features/planning/data/plan-templates";
import { personalizeTemplate } from "@/features/planning/domain/template-personalization";
import { templateCompatibility } from "@/features/planning/domain/plan-template";
import { DISCOMFORT_ZONE_OPTIONS } from "@/features/onboarding/presentation/constants";
import { blocksForSessionAddOns } from "@/features/catalog/data/session-blocks";

// La molestia es señal declarada, nunca un diagnóstico: no se usa para excluir
// ejercicios automáticamente, solo para que la propuesta la muestre y la
// persona decida. Antes se descartaba en silencio salvo en el cálculo de confidence.
function discomfortReason(draft: OnboardingDraft) {
  if (!draft.discomfort) return [];
  const zoneLabel = DISCOMFORT_ZONE_OPTIONS.find((option) => option.value === draft.discomfort!.zone)?.label ?? draft.discomfort.zone;
  return [{ code: "DECLARED_DISCOMFORT", message: `Declaraste molestia en ${zoneLabel.toLowerCase()}: revisa los ejercicios antes de empezar y ajusta o sustituye si notas carga en esa zona.` }];
}

const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

function foundationBlocksForEnvironment(environment: EquipmentProfile) {
  const capabilities = capabilitiesForEnvironment(environment);
  return FOUNDATION_BLOCKS
    .filter((block) => isEquipmentRequirementSatisfied(block.requirements, capabilities))
    .map(({ requirements: _requirements, ...block }) => block);
}

export function blocksForDraft(draft: OnboardingDraft): PlanProposal["week"]["sessions"][number]["blocks"] {
  return blocksForSessionAddOns(draft.sessionAddOns, draft.environments[0]);
}

function durationWithBlocks(baseMinutes: number, blocks: PlanProposal["week"]["sessions"][number]["blocks"]): number {
  return baseMinutes + (blocks ?? []).reduce((total, block) => total + block.estimatedMinutes, 0);
}

export function buildPlanProposal(draft: OnboardingDraft): PlanProposal {
  if (draft.selectedTemplateId) return buildSelectedTemplateProposal(draft);
  const environment = draft.environments[0];
  const addOnBlocks = blocksForDraft(draft);
  const foundationBlocks = foundationBlocksForEnvironment(environment);
  // Keep legacy foundation blocks available for old drafts, but new plans use
  // the explicit onboarding choice so the user controls every extra block.
  const sessionBlocks = draft.sessionAddOns ? addOnBlocks : foundationBlocks;
  const strengthSessions = draft.strengthAvailability.map((day, index) => {
    const title = ["Fuerza: empuje", "Fuerza: tracción", "Fuerza: piernas"][index % 3];
    return {
      day,
      kind: "strength" as const,
      title,
      estimatedMinutes: draft.sessionAddOns ? durationWithBlocks(draft.sessionDurationMinutes, sessionBlocks) : draft.sessionDurationMinutes,
      exercises: assignSessionExercises(title, environment, draft.primaryGoal),
      blocks: sessionBlocks
    };
  });
  const occupiedDays = new Set(draft.strengthAvailability);
  const enduranceSessions = draft.enduranceActivities.flatMap((activity) => availableDays(occupiedDays, activity.sessionsPerWeek).map((day) => ({
    day,
    kind: "endurance" as const,
    title: activity.kind === "running" ? "Carrera suave" : activity.kind === "cycling" ? "Bici suave" : "Caminar suave",
    estimatedMinutes: Math.min(draft.sessionDurationMinutes, 60)
  })));

  const missingData: string[] = [];
  if (!draft.discomfort) missingData.push("discomfort");
  if (!draft.optionalMuscleFocus || draft.optionalMuscleFocus.length === 0) missingData.push("optionalMuscleFocus");
  if (draft.enduranceActivities.length === 0) missingData.push("enduranceActivities");
  // Conservador: 0.6 base + 0.1 por cada dato opcional declarado (tope 1).
  const confidence = Math.min(1, 0.6 + 0.1 * (3 - missingData.length));

  return {
    proposalId: draft.clientOperationId,
    ruleVersion: "plan-proposal-v1",
    confidence,
    missingData,
    initialBlock: { name: "Adaptación inicial", purpose: "Establecer una semana sostenible y editable.", weeks: 2 },
    reasons: [
      { code: "GOAL_PRIORITY", message: `La fuerza se organiza con ${draft.primaryGoal === "strength" ? "prioridad de fuerza" : "tu objetivo principal"}.` },
      { code: "AVAILABILITY", message: "Las sesiones de fuerza se colocan solo en los días que has indicado." },
      ...(enduranceSessions.length ? [{ code: "ENDURANCE_SPACING", message: "La actividad exterior se separa de los días de fuerza cuando hay hueco disponible." }] : []),
      ...discomfortReason(draft)
    ],
    alternatives: [{ code: "EDIT_BEFORE_ACTIVATION", message: "Puedes mover, editar o eliminar cualquier sesión antes de activar el plan." }],
    week: { sessions: [...strengthSessions, ...enduranceSessions].sort((a, b) => weekdays.indexOf(a.day) - weekdays.indexOf(b.day)) }
  };
}

function buildSelectedTemplateProposal(draft: OnboardingDraft): PlanProposal {
  const template = PLAN_TEMPLATES.find((candidate) => candidate.templateId === draft.selectedTemplateId);
  const version = template?.versions.at(-1);
  if (!version) throw new Error("La rutina seleccionada ya no está disponible.");
  if (version.content.blockBlueprints.length !== draft.strengthAvailability.length) throw new Error("La rutina seleccionada no coincide con tus días de fuerza.");
  const compatibility = templateCompatibility(version, capabilitiesForEnvironment(draft.environments[0]));
  if (compatibility.status !== "compatible") throw new Error("La rutina seleccionada no es compatible con tu equipamiento actual.");
  const copy = personalizeTemplate(version, draft);
  return {
    proposalId: draft.clientOperationId,
    ruleVersion: "plan-proposal-v1",
    confidence: 1,
    missingData: [],
    initialBlock: { name: version.name, purpose: version.editorialNote, weeks: 4 },
    reasons: [{ code: "CATALOG_SELECTION", message: "Elegiste esta rutina del catálogo y podrás editarla antes de activarla." }, ...discomfortReason(draft)],
    alternatives: [{ code: "EDIT_BEFORE_ACTIVATION", message: "Puedes mover, editar o eliminar cualquier sesión antes de activar el plan." }],
    week: copy.content
  };
}

function availableDays(occupied: Set<string>, count: number) {
  return weekdays.filter((day) => !occupied.has(day)).slice(0, count);
}
