"use client";

import { ChipPicker } from "@/components/ChipPicker";
import { ScreenLayout } from "@/components/ScreenLayout";
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS } from "../../presentation/constants";
import type { CreationMode, Experience, Goal } from "../../presentation/types";
import styles from "./BasicSelectionScreens.module.css";

type ModeScreenProps = { value: CreationMode | null; onChange: (mode: CreationMode) => void };

export function ModeScreen({ value, onChange }: ModeScreenProps) {
  return (
    <ScreenLayout title="¿Cómo quieres crear tu plan?" hint="Elige el punto de partida. Todo se podrá ajustar después.">
      <div className={styles.choiceList} role="radiogroup" aria-label="Modo de creación del plan">
        <ModeOption
          icon="✦"
          label="Quiero que me guíen"
          description="Respondes unas preguntas y te proponemos un plan inicial."
          selected={value === "guided"}
          onSelect={() => onChange("guided")}
        />
        <ModeOption
          icon="⌁"
          label="Quiero crear mi plan"
          description="Empiezas desde una plantilla propia editable."
          selected={value === "self_directed"}
          onSelect={() => onChange("self_directed")}
        />
      </div>
    </ScreenLayout>
  );
}

function ModeOption({ icon, label, description, selected, onSelect }: { icon: string; label: string; description: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`${styles.modeOption}${selected ? ` ${styles.modeOptionSelected}` : ""}`}
    >
      <span className={styles.modeIcon} aria-hidden="true">{icon}</span>
      <span className={styles.modeCopy}><strong>{label}</strong><span>{description}</span></span>
      <span className={styles.radio} aria-hidden="true" />
    </button>
  );
}

type GoalsScreenProps = { goals: Goal[]; onToggle: (goal: Goal) => void };

export function GoalsScreen({ goals, onToggle }: GoalsScreenProps) {
  return (
    <ScreenLayout title="¿Cuál es tu objetivo principal?" hint="Puedes marcar más de uno; el primero guiará la propuesta.">
      <ChipPicker ariaLabel="Objetivos" options={GOAL_OPTIONS} selected={goals} onToggle={onToggle} markFirstAsPriority />
    </ScreenLayout>
  );
}

type ExperienceScreenProps = { value: Experience | null; onChange: (experience: Experience) => void };

export function ExperienceScreen({ value, onChange }: ExperienceScreenProps) {
  return (
    <ScreenLayout title="¿Cuánto tiempo llevas entrenando?" hint="Nos ayuda a ajustar el punto de partida.">
      <ChipPicker
        ariaLabel="Experiencia"
        options={EXPERIENCE_OPTIONS}
        selected={value ? [value] : []}
        onToggle={onChange}
      />
    </ScreenLayout>
  );
}
