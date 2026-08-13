import type { OnboardingDraft, PlanProposal } from "@/contracts/onboarding";
import { assignSessionExercises } from "./session-exercise-assignment";
import { FOUNDATION_BLOCKS } from "@/features/catalog/data/foundation-blocks";
import { isEquipmentRequirementSatisfied } from "@/features/catalog/domain/editorial-content";
import { capabilitiesForEnvironment, type EquipmentProfile } from "@/features/catalog/domain/inventory";

const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

function foundationBlocksForEnvironment(environment: EquipmentProfile) {
  const capabilities = capabilitiesForEnvironment(environment);
  return FOUNDATION_BLOCKS
    .filter((block) => isEquipmentRequirementSatisfied(block.requirements, capabilities))
    .map(({ requirements: _requirements, ...block }) => block);
}

export function buildPlanProposal(draft: OnboardingDraft): PlanProposal {
  const environment = draft.environments[0];
  const foundationBlocks = foundationBlocksForEnvironment(environment);
  const strengthSessions = draft.strengthAvailability.map((day, index) => {
    const title = ["Fuerza: empuje", "Fuerza: tracción", "Fuerza: piernas"][index % 3];
    return {
      day,
      kind: "strength" as const,
      title,
      estimatedMinutes: draft.sessionDurationMinutes,
      exercises: assignSessionExercises(title, environment, draft.primaryGoal),
      blocks: foundationBlocks
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
      ...(enduranceSessions.length ? [{ code: "ENDURANCE_SPACING", message: "La actividad exterior se separa de los días de fuerza cuando hay hueco disponible." }] : [])
    ],
    alternatives: [{ code: "EDIT_BEFORE_ACTIVATION", message: "Puedes mover, editar o eliminar cualquier sesión antes de activar el plan." }],
    week: { sessions: [...strengthSessions, ...enduranceSessions].sort((a, b) => weekdays.indexOf(a.day) - weekdays.indexOf(b.day)) }
  };
}

function availableDays(occupied: Set<string>, count: number) {
  return weekdays.filter((day) => !occupied.has(day)).slice(0, count);
}
