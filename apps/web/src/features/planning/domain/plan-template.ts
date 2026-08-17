import type { EnvironmentKind, MovementPattern } from "@/features/catalog/data/exercise-catalog";
import type { EquipmentCapability } from "@/features/catalog/domain/editorial-content";
import type { Goal, PlanProposal } from "@/contracts/onboarding";
import { EDITORIAL_VARIANTS } from "@/features/catalog/data/editorial-exercises";
import { isEquipmentRequirementSatisfied, type EditorialVariant } from "@/features/catalog/domain/editorial-content";
import { capabilitiesForEnvironment, type EquipmentProfile } from "@/features/catalog/domain/inventory";

/**
 * Describe qué patrones de movimiento quiere una sesión de la plantilla, sin
 * resolver todavía variantes concretas (Task 4). `title` es solo editorial.
 */
export type SessionBlockBlueprint = {
  title: string;
  patterns: MovementPattern[];
};

export type PlanTemplateContent = {
  /** Capacidades sin las cuales la plantilla no es utilizable en absoluto. */
  essentialCapabilities: EquipmentCapability[];
  blockBlueprints: SessionBlockBlueprint[];
};

export type PlanTemplateVersion = {
  templateId: string;
  version: string;
  catalogVersion: string;
  name: string;
  environmentKind: EnvironmentKind;
  /** Aviso editorial: punto de partida razonable, no prescripción validada profesionalmente. */
  editorialNote: string;
  /** Datos breves para elegir una plantilla en el catálogo, no reglas de progresión. */
  catalog: {
    level: "beginner" | "intermediate" | "advanced";
    goals: Goal[];
    durationMinutes: 20 | 40 | 60 | 90;
  };
  content: PlanTemplateContent;
};

export type PlanTemplate = {
  templateId: string;
  versions: PlanTemplateVersion[];
};

/**
 * Versiones de plantilla que caben en la disponibilidad declarada. Menos sesiones que días
 * encaja (sobran días de descanso; `personalizeTemplate` las reparte sobre los días
 * elegidos); más sesiones que días no, porque dos caerían el mismo día. "Gimnasio básico"
 * ve también las de gimnasio completo: la compatibilidad real la decide el equipamiento
 * declarado, vía `templateCompatibility`.
 */
export function templatesForSelection(templates: PlanTemplate[], environmentKind: EnvironmentKind | undefined, strengthDays: number): PlanTemplateVersion[] {
  const kind = environmentKind ?? "full_gym";
  return templates
    .flatMap((template) => template.versions)
    .filter((version) => (
      (version.environmentKind === kind || (kind === "basic_gym" && version.environmentKind === "full_gym"))
      && version.content.blockBlueprints.length <= strengthDays
    ));
}

/**
 * Copia ya resuelta y aislada de una plantilla (o de un plan guiado) para una
 * persona concreta. El plan activo de una persona nunca cambia por publicar
 * contenido editorial nuevo: `content` no comparte identidad de referencia
 * con `PlanTemplateVersion.content.blockBlueprints`.
 */
export type PlanInstance = {
  id: string;
  ownerId: string;
  source: "template" | "guided";
  sourceTemplateId?: string;
  sourceTemplateVersion?: string;
  catalogVersion?: string;
  content: PlanProposal["week"];
};

export type TemplateCompatibilityStatus = "compatible" | "not_currently_compatible";

export function templateCompatibility(
  templateVersion: PlanTemplateVersion,
  capabilities: readonly string[]
): { status: TemplateCompatibilityStatus; missingCapabilities: EquipmentCapability[] } {
  const available = new Set(capabilities);
  const missingCapabilities = templateVersion.content.essentialCapabilities.filter((capability) => !available.has(capability));
  return {
    status: missingCapabilities.length === 0 ? "compatible" : "not_currently_compatible",
    missingCapabilities
  };
}

export function templatePreviewExercises(
  templateVersion: PlanTemplateVersion,
  environment: EquipmentProfile
): Array<{ title: string; exercises: EditorialVariant[] }> {
  const capabilities = capabilitiesForEnvironment(environment);
  return templateVersion.content.blockBlueprints.map((blueprint) => ({
    title: blueprint.title,
    exercises: blueprint.patterns
      .map((pattern) => EDITORIAL_VARIANTS.find((variant) => (
        variant.active
        && variant.movementPattern === pattern
        && variant.environments.includes(environment.kind)
        && isEquipmentRequirementSatisfied(variant.requirements, capabilities)
      )))
      .filter((variant): variant is EditorialVariant => Boolean(variant))
  }));
}
