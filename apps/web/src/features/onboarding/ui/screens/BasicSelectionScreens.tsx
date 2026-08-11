"use client";

import { ChipPicker } from "@/components/ChipPicker";
import { ScreenLayout } from "@/components/ScreenLayout";
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS } from "../../presentation/constants";
import type { CreationMode, Experience, Goal } from "../../presentation/types";

type ModeScreenProps = { value: CreationMode | null; onChange: (mode: CreationMode) => void };

export function ModeScreen({ value, onChange }: ModeScreenProps) {
  return (
    <ScreenLayout title="¿Cómo quieres empezar?" hint="Puedes cambiar de opinión más adelante desde Perfil.">
      <div role="radiogroup" aria-label="Modo de creación del plan" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ModeOption
          label="Quiero que me guíen"
          description="Respondes unas preguntas y te proponemos un plan inicial."
          selected={value === "guided"}
          onSelect={() => onChange("guided")}
        />
        <ModeOption
          label="Quiero crear mi plan"
          description="Empiezas desde una plantilla propia editable."
          selected={value === "self_directed"}
          onSelect={() => onChange("self_directed")}
        />
      </div>
    </ScreenLayout>
  );
}

function ModeOption({ label, description, selected, onSelect }: { label: string; description: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        textAlign: "left",
        padding: "16px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--rule-soft)"}`,
        background: selected ? "var(--accent-wash)" : "var(--paper)",
        color: "var(--ink)",
        minHeight: 64
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>{label}</strong>
      <span style={{ color: "var(--ink-2)", fontSize: "0.9rem" }}>{description}</span>
    </button>
  );
}

type GoalsScreenProps = { goals: Goal[]; onToggle: (goal: Goal) => void };

export function GoalsScreen({ goals, onToggle }: GoalsScreenProps) {
  return (
    <ScreenLayout title="¿Qué objetivos tienes?" hint="Elige uno o varios. El primero que marques queda como prioridad.">
      <ChipPicker ariaLabel="Objetivos" options={GOAL_OPTIONS} selected={goals} onToggle={onToggle} markFirstAsPriority />
    </ScreenLayout>
  );
}

type ExperienceScreenProps = { value: Experience | null; onChange: (experience: Experience) => void };

export function ExperienceScreen({ value, onChange }: ExperienceScreenProps) {
  return (
    <ScreenLayout title="¿Cuál es tu experiencia?" hint="Nos ayuda a calibrar el punto de partida.">
      <ChipPicker
        ariaLabel="Experiencia"
        options={EXPERIENCE_OPTIONS}
        selected={value ? [value] : []}
        onToggle={onChange}
      />
    </ScreenLayout>
  );
}
