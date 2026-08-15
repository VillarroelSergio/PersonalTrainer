"use client";

import { ScreenLayout } from "@/components/ScreenLayout";
import { availableMobilityRoutines } from "@/features/catalog/data/session-blocks";
import type { SessionAddOns } from "@/contracts/onboarding";
import type { EnvironmentKind } from "../../presentation/types";
import styles from "./SessionAddOnsScreen.module.css";

type Props = {
  value: SessionAddOns;
  environment?: EnvironmentKind;
  onChange: (value: SessionAddOns) => void;
};

const OPTIONS = [
  { id: "none", label: "Solo entrenamiento", description: "Empieza directamente con los ejercicios principales.", warmup: false, cooldown: false },
  { id: "warmup", label: "Añadir calentamiento", description: "Movilidad dinámica para preparar la sesión.", warmup: true, cooldown: false },
  { id: "cooldown", label: "Añadir movilidad y estiramientos", description: "Cierra con una secuencia suave y guiada.", warmup: false, cooldown: true },
  { id: "both", label: "Añadir ambos", description: "Prepara el cuerpo y termina con una vuelta a la calma.", warmup: true, cooldown: true }
] as const;

export function SessionAddOnsScreen({ value, environment = "full_gym", onChange }: Props) {
  const selectedId = value.warmup && value.cooldown ? "both" : value.warmup ? "warmup" : value.cooldown ? "cooldown" : "none";
  const warmupRoutines = availableMobilityRoutines(environment, "warmup");
  const cooldownRoutines = availableMobilityRoutines(environment, "cooldown");
  const warmupValue = warmupRoutines.some((routine) => routine.id === value.warmupRoutineId) ? value.warmupRoutineId : warmupRoutines[0]?.id ?? value.warmupRoutineId;
  const cooldownValue = cooldownRoutines.some((routine) => routine.id === value.cooldownRoutineId) ? value.cooldownRoutineId : cooldownRoutines[0]?.id ?? value.cooldownRoutineId;

  function selectOption(option: typeof OPTIONS[number]) {
    onChange({ ...value, warmup: option.warmup, cooldown: option.cooldown });
  }

  return (
    <ScreenLayout title="¿Quieres preparar o cerrar tus sesiones?" hint="Es opcional. Estos bloques se muestran aparte y no cuentan como series ni carga de fuerza.">
      <div className={styles.options} role="group" aria-label="Bloques adicionales de la sesión">
        {OPTIONS.map((option) => (
          <button key={option.id} type="button" className={selectedId === option.id ? `${styles.option} ${styles.selected}` : styles.option} aria-pressed={selectedId === option.id} onClick={() => selectOption(option)}>
            <span className={styles.optionTitle}>{option.label}</span>
            <span className={styles.optionDescription}>{option.description}</span>
          </button>
        ))}
      </div>

      {value.warmup && (
        <label className={styles.selectGroup}>
          <span>Rutina de calentamiento</span>
          <select value={warmupValue} onChange={(event) => onChange({ ...value, warmupRoutineId: event.target.value })}>
            {warmupRoutines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name} · {routine.durationMinutes} min</option>)}
          </select>
        </label>
      )}
      {value.cooldown && (
        <label className={styles.selectGroup}>
          <span>Rutina de movilidad y estiramientos</span>
          <select value={cooldownValue} onChange={(event) => onChange({ ...value, cooldownRoutineId: event.target.value })}>
            {cooldownRoutines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name} · {routine.durationMinutes} min</option>)}
          </select>
        </label>
      )}
    </ScreenLayout>
  );
}
