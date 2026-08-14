"use client";

import { useState } from "react";
import { ScreenLayout } from "@/components/ScreenLayout";
import type { EquipmentCapability } from "@/features/catalog/domain/editorial-content";
import { capabilitiesForEnvironment } from "@/features/catalog/domain/inventory";
import { PLAN_TEMPLATES } from "@/features/planning/data/plan-templates";
import { templateCompatibility, templatePreviewExercises } from "@/features/planning/domain/plan-template";
import type { CreationMode, Environment } from "../../presentation/types";
import styles from "./TemplateCatalogScreen.module.css";

type Props = {
  creationMode: CreationMode | null;
  environment?: Environment;
  strengthDays: number;
  selectedTemplateId: string | null;
  onSelect: (templateId: string) => void;
};

const CAPABILITY_LABELS: Partial<Record<EquipmentCapability, string>> = {
  free_weights: "pesas y barras",
  benches_supports: "bancos y soportes",
  cables_torso: "poleas y torso",
  leg_machines: "máquinas de pierna",
  bodyweight_accessories: "accesorios y peso corporal",
  indoor_cardio: "cardio interior"
};

export function TemplateCatalogScreen({ creationMode, environment, strengthDays, selectedTemplateId, onSelect }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (creationMode === "guided") return null;

  const selectedEnvironmentKind = environment?.kind;
  const templates = PLAN_TEMPLATES.flatMap((template) => template.versions)
    .filter((version) => {
      const environmentMatches = selectedEnvironmentKind
        ? version.environmentKind === selectedEnvironmentKind
          || (selectedEnvironmentKind === "basic_gym" && version.environmentKind === "full_gym")
        : version.environmentKind === "full_gym";
      return environmentMatches && version.content.blockBlueprints.length === strengthDays;
    });
  const capabilities = environment ? capabilitiesForEnvironment(environment) : [];

  return (
    <ScreenLayout title="Elige una rutina" hint="Elige un punto de partida para tu gimnasio. Podrás editarlo antes de activarlo.">
      <div className={styles.list} role="radiogroup" aria-label="Rutinas de gimnasio">
        {templates.map((template) => {
          const compatibility = templateCompatibility(template, capabilities);
          const compatible = compatibility.status === "compatible";
          const selected = selectedTemplateId === template.templateId;
          const expanded = expandedId === template.templateId;
          const preview = environment ? templatePreviewExercises(template, environment) : [];
          return (
            <article key={template.templateId} className={`${styles.card}${selected ? ` ${styles.selected}` : ""}`}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!compatible}
                onClick={() => onSelect(template.templateId)}
                className={styles.selectButton}
                data-template-id={template.templateId}
              >
                <span className={styles.title}>{template.name}</span>
                <span className={styles.meta}>
                  {template.content.blockBlueprints.length} días · {template.catalog.durationMinutes} min · {template.catalog.level === "beginner" ? "Inicial" : template.catalog.level === "intermediate" ? "Intermedia" : "Avanzada"}
                </span>
                <span className={styles.state}>{selected ? "✓ Seleccionada" : compatible ? "Disponible" : "No compatible"}</span>
              </button>

              {!compatible && (
                <p className={styles.unavailable}>
                  Necesita {compatibility.missingCapabilities.map((capability) => CAPABILITY_LABELS[capability] ?? capability).join(", ")}.
                </p>
              )}

              <button
                type="button"
                className={styles.previewButton}
                aria-expanded={expanded}
                onClick={() => setExpandedId(expanded ? null : template.templateId)}
              >
                {expanded ? "Ocultar ejercicios" : "Ver ejercicios"}
              </button>

              {expanded && (
                <div className={styles.preview} aria-label={`Ejercicios de ${template.name}`}>
                  {preview.map((block) => (
                    <div key={block.title} className={styles.previewBlock}>
                      <strong>{block.title}</strong>
                      <ul>
                        {block.exercises.map((exercise) => <li key={exercise.id}>{exercise.variantName}</li>)}
                        {block.exercises.length === 0 && <li>No hay variantes compatibles con este equipamiento.</li>}
                      </ul>
                    </div>
                  ))}
                  {preview.length === 0 && <p className={styles.meta}>Selecciona un entorno para ver ejercicios compatibles.</p>}
                </div>
              )}
            </article>
          );
        })}
        {templates.length === 0 && (
          <p className={styles.empty}>
            Todavía no hay una rutina de catálogo para este entorno y número de días. Puedes volver atrás y elegir otro entorno, o usar la propuesta guiada.
          </p>
        )}
      </div>
    </ScreenLayout>
  );
}
