import type { OnboardingDraft } from "@/contracts/onboarding";
import { weekdaySchema } from "@/contracts/onboarding";
import type { PlanInstance, PlanTemplateVersion } from "@/features/planning/domain/plan-template";
import { EDITORIAL_VARIANTS } from "@/features/catalog/data/editorial-exercises";
import { isEquipmentRequirementSatisfied } from "@/features/catalog/domain/editorial-content";
import { capabilitiesForEnvironment } from "@/features/catalog/domain/inventory";
import { REP_RANGE_BY_GOAL } from "@/features/planning/domain/session-exercise-assignment";
import { blocksForSessionAddOns } from "@/features/catalog/data/session-blocks";

/**
 * Resuelve una plantilla contra el entorno/capacidades declarados en el
 * draft y devuelve una copia aislada (Task 4). El plan activo de una persona
 * nunca cambia por publicar contenido editorial nuevo, así que `content` se
 * construye entero aquí: nunca reasigna arrays/objetos de
 * `templateVersion.content.blockBlueprints`.
 */
export function personalizeTemplate(templateVersion: PlanTemplateVersion, draft: OnboardingDraft): PlanInstance {
  const environment = draft.environments[0];
  const capabilities = capabilitiesForEnvironment(environment);
  const [targetRepsMin, targetRepsMax] = REP_RANGE_BY_GOAL[draft.primaryGoal];
  const days = weekdaySchema.options.filter((day) => draft.strengthAvailability.includes(day));
  const blocks = blocksForSessionAddOns(draft.sessionAddOns, environment);

  const sessions = templateVersion.content.blockBlueprints.map((blueprint, index) => {
    const exercises = blueprint.patterns
      .map((pattern) => EDITORIAL_VARIANTS.find((variant) =>
        variant.active
        && variant.movementPattern === pattern
        && variant.environments.includes(environment.kind)
        && isEquipmentRequirementSatisfied(variant.requirements, capabilities)
      ))
      .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant))
      .map((variant) => ({ variantId: variant.id, targetSets: 3, targetRepsMin, targetRepsMax }));

    return {
      day: days[index % days.length] ?? weekdaySchema.options[0],
      kind: "strength" as const,
      title: blueprint.title,
      estimatedMinutes: draft.sessionDurationMinutes + blocks.reduce((total, block) => total + block.estimatedMinutes, 0),
      exercises,
      blocks
    };
  });

  return {
    id: draft.clientOperationId,
    ownerId: "pending-activation",
    source: "template",
    sourceTemplateId: templateVersion.templateId,
    sourceTemplateVersion: templateVersion.version,
    catalogVersion: templateVersion.catalogVersion,
    content: { sessions }
  };
}
