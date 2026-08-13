import type { EnvironmentKind, MovementPattern } from "@/features/catalog/data/exercise-catalog";
import type { EquipmentCapability } from "@/features/catalog/domain/editorial-content";
import type { PlanProposal } from "@/contracts/onboarding";

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
  content: PlanTemplateContent;
};

export type PlanTemplate = {
  templateId: string;
  versions: PlanTemplateVersion[];
};

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
