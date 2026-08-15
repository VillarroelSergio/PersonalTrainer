"use client";

import Image from "next/image";
import { ScreenLayout } from "@/components/ScreenLayout";
import { availableMobilityRoutines } from "@/features/catalog/data/session-blocks";
import { exercisesForMobilityRoutine, type MobilityExercise, type MobilityRoutine } from "@/features/catalog/data/mobility-catalog";
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
  { id: "warmup", label: "Preparar la sesión", description: "Elige una rutina corta antes de entrenar.", warmup: true, cooldown: false },
  { id: "cooldown", label: "Cerrar la sesión", description: "Elige movilidad o estiramientos para después.", warmup: false, cooldown: true },
  { id: "both", label: "Preparar y cerrar", description: "Una rutina antes y otra después, siempre opcionales.", warmup: true, cooldown: true }
] as const;

function firstExercise(routine: MobilityRoutine): MobilityExercise | undefined {
  return exercisesForMobilityRoutine(routine)[0];
}

function doseLabel(exercise: MobilityExercise): string {
  return exercise.metric === "seconds" ? `Tiempo · ${exercise.defaultDose}` : `Repeticiones · ${exercise.defaultDose}`;
}

function RoutinePicker({ title, hint, routines, selectedId, onSelect }: { title: string; hint: string; routines: MobilityRoutine[]; selectedId: string; onSelect: (id: string) => void }) {
  const selected = routines.find((routine) => routine.id === selectedId) ?? routines[0];
  const selectedExercises = selected ? exercisesForMobilityRoutine(selected) : [];
  const titleId = title.toLowerCase().replace(/\s+/g, "-");

  return (
    <section className={styles.routineSection} aria-labelledby={`${titleId}-title`}>
      <div className={styles.sectionHeading}>
        <div><h2 id={`${titleId}-title`}>{title}</h2><p>{hint}</p></div>
        <span className={styles.optionalBadge}>Opcional</span>
      </div>
      <div className={styles.routineGrid} role="group" aria-label={title}>
        {routines.map((routine) => {
          const preview = firstExercise(routine);
          const isSelected = routine.id === selected?.id;
          return (
            <button key={routine.id} type="button" className={isSelected ? `${styles.routineCard} ${styles.routineSelected}` : styles.routineCard} aria-pressed={isSelected} onClick={() => onSelect(routine.id)}>
              {preview ? <Image src={preview.mediaUrl} alt="" width={58} height={58} className={styles.routineImage} /> : <span className={styles.routineImagePlaceholder} aria-hidden="true" />}
              <span className={styles.routineCopy}><strong>{routine.name}</strong><span>{routine.durationMinutes} min · {routine.exerciseIds.length} ejercicios</span><small>{routine.purpose}</small></span>
              <span className={styles.routineMark} aria-hidden="true">{isSelected ? "✓" : "＋"}</span>
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className={styles.preview} aria-label={`Ejercicios de ${selected.name}`}>
          <div className={styles.previewHeading}><strong>{selected.name}</strong><span>Se aplicará solo si la activas al empezar</span></div>
          <ol className={styles.previewList}>
            {selectedExercises.map((exercise, index) => (
              <li key={exercise.id} className={styles.previewItem}>
                <span className={styles.previewIndex}>{index + 1}</span>
                <Image src={exercise.mediaUrl} alt="" width={38} height={38} className={styles.previewImage} />
                <span><strong>{exercise.variantName}</strong><small>{doseLabel(exercise)}</small></span>
              </li>
            ))}
          </ol>
          <p className={styles.customizeHint}>Podrás cambiar ejercicios desde Plan.</p>
        </div>
      ) : null}
    </section>
  );
}

export function SessionAddOnsScreen({ value, environment = "full_gym", onChange }: Props) {
  const selectedId = value.warmup && value.cooldown ? "both" : value.warmup ? "warmup" : value.cooldown ? "cooldown" : "none";
  const routines = availableMobilityRoutines(environment, "warmup");
  const warmupRoutineId = routines.some((routine) => routine.id === value.warmupRoutineId) ? value.warmupRoutineId : routines[0]?.id ?? value.warmupRoutineId;
  const cooldownRoutineId = routines.some((routine) => routine.id === value.cooldownRoutineId) ? value.cooldownRoutineId : routines[0]?.id ?? value.cooldownRoutineId;

  function selectOption(option: typeof OPTIONS[number]) {
    onChange({ ...value, warmup: option.warmup, cooldown: option.cooldown, warmupRoutineId, cooldownRoutineId });
  }

  return (
    <ScreenLayout title="¿Quieres preparar o cerrar tus sesiones?" hint="Elige una rutina completa. Aparecerá debajo de tu sesión como opción y podrás activarla o personalizarla.">
      <div className={styles.options} role="group" aria-label="Bloques adicionales de la sesión">
        {OPTIONS.map((option) => (
          <button key={option.id} type="button" className={selectedId === option.id ? `${styles.option} ${styles.optionSelected}` : styles.option} aria-pressed={selectedId === option.id} onClick={() => selectOption(option)}>
            <span className={styles.optionRadio} aria-hidden="true">{selectedId === option.id ? "✓" : ""}</span>
            <span><strong>{option.label}</strong><small>{option.description}</small></span>
          </button>
        ))}
      </div>

      {value.warmup ? <RoutinePicker title="Rutina antes de entrenar" hint="Movilidad dinámica para entrar en calor." routines={routines} selectedId={warmupRoutineId} onSelect={(id) => onChange({ ...value, warmupRoutineId: id })} /> : null}
      {value.cooldown ? <RoutinePicker title="Rutina después de entrenar" hint="Movilidad y estiramientos para cerrar la sesión." routines={routines} selectedId={cooldownRoutineId} onSelect={(id) => onChange({ ...value, cooldownRoutineId: id })} /> : null}
    </ScreenLayout>
  );
}
