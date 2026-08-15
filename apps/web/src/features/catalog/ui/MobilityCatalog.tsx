"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { exercisesForMobilityRoutine, MOBILITY_EXERCISES, MOBILITY_ROUTINES, type MobilityExercise, type MobilityRoutine } from "@/features/catalog/data/mobility-catalog";
import styles from "./MobilityCatalog.module.css";

function metricLabel(exercise: MobilityExercise): string {
  return exercise.metric === "seconds" ? "Tiempo" : "Repeticiones";
}

function routineExerciseIds(routine: MobilityRoutine): Set<string> {
  return new Set(routine.exerciseIds);
}

export function MobilityCatalog({ planId }: { planId?: string }) {
  const [selectedRoutineId, setSelectedRoutineId] = useState(MOBILITY_ROUTINES[0]?.id ?? "");
  const selectedRoutine = MOBILITY_ROUTINES.find((routine) => routine.id === selectedRoutineId) ?? MOBILITY_ROUTINES[0];
  const routineExercises = useMemo(() => selectedRoutine ? exercisesForMobilityRoutine(selectedRoutine) : [], [selectedRoutine]);
  const selectedExerciseIds = selectedRoutine ? routineExerciseIds(selectedRoutine) : new Set<string>();
  const [applying, setApplying] = useState<"warmup" | "cooldown" | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function applyToPlan(kind: "warmup" | "cooldown") {
    if (!selectedRoutine || applying) return;
    if (!planId) {
      setApplyError("Activa un plan para poder añadir esta rutina a tus sesiones.");
      return;
    }
    setApplying(kind);
    setApplyError(null);
    const response = await fetch(`/api/v1/plans/${planId}/session-add-ons`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ routineId: selectedRoutine.id, kind })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) setApplyError(body?.error?.message ?? "No pudimos añadir la rutina al plan.");
    else setApplied(kind);
    setApplying(null);
  }

  return (
    <div className={styles.wrap}>
      <section aria-labelledby="mobilityRoutinesTitle">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Rutinas cortas</p>
            <h2 id="mobilityRoutinesTitle">Elige una secuencia</h2>
          </div>
          <span className={styles.count}>{MOBILITY_ROUTINES.length} disponibles</span>
        </div>
        <div className={styles.routineGrid} role="list" aria-label="Rutinas de movilidad y estiramientos">
          {MOBILITY_ROUTINES.map((routine) => {
            const selected = routine.id === selectedRoutine?.id;
            return (
                <button key={routine.id} type="button" className={`${styles.routineCard}${selected ? ` ${styles.routineCardSelected}` : ""}`} aria-pressed={selected} onClick={() => { setSelectedRoutineId(routine.id); setApplied(null); setApplyError(null); }}>
                <span className={styles.routineTopline}><span>{routine.durationMinutes} min</span><span>{routine.level === "beginner" ? "Base" : "Intermedia"}</span></span>
                <strong>{routine.name}</strong>
                <span>{routine.purpose}</span>
                <span className={styles.routineFooter}>{selected ? "Seleccionada" : "Ver ejercicios"} <span aria-hidden="true">›</span></span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedRoutine ? (
        <section className={styles.selectedRoutine} aria-labelledby="selectedRoutineTitle">
          <div className={styles.selectedHeading}>
            <div>
              <p className={styles.eyebrow}>Rutina seleccionada</p>
              <h2 id="selectedRoutineTitle">{selectedRoutine.name}</h2>
              <p>{selectedRoutine.purpose}. Ajusta el ritmo y detente si aparece dolor.</p>
            </div>
            <span className={styles.durationBadge}>{selectedRoutine.durationMinutes} min</span>
          </div>
          <div className={styles.selectionNotice}>
            <div><strong>{applied ? "Añadida al plan" : "¿Dónde se aplica?"}</strong><span>{applied ? `Se mostrará como opción ${applied === "warmup" ? "antes" : "después"} de tus sesiones.` : "Elige cómo quieres usar esta rutina. Luego aparecerá debajo de cada sesión como opcional."}</span></div>
            {applied ? <Link href="/hoy" className={styles.planLink}>Ver Hoy <span aria-hidden="true">→</span></Link> : null}
          </div>
          {!applied ? <div className={styles.applyActions}>
            <button type="button" className={styles.applyButton} onClick={() => applyToPlan("warmup")} disabled={Boolean(applying)}>{applying === "warmup" ? "Añadiendo…" : "Usar antes"}</button>
            <button type="button" className={styles.applyButton} onClick={() => applyToPlan("cooldown")} disabled={Boolean(applying)}>{applying === "cooldown" ? "Añadiendo…" : "Usar después"}</button>
          </div> : null}
          {applyError ? <p className={styles.applyError} role="alert">{applyError}</p> : null}
          <ol className={styles.exerciseList} aria-label={`Ejercicios de ${selectedRoutine.name}`}>
            {routineExercises.map((exercise, index) => (
              <li key={exercise.id} className={styles.exerciseCard}>
                <span className={styles.index}>{index + 1}</span>
                <Image src={exercise.mediaUrl} alt={`${exercise.exerciseName} — ${exercise.variantName}`} width={88} height={110} className={styles.exerciseImage} />
                <span className={styles.exerciseBody}>
                  <strong>{exercise.exerciseName}</strong>
                  <span>{exercise.variantName}</span>
                  <small>{metricLabel(exercise)} · {exercise.defaultDose}</small>
                  <small className={styles.targets}>Foco: {exercise.primaryMuscleGroup.replace("_", " ")}{exercise.secondaryMuscleGroups?.length ? ` · ${exercise.secondaryMuscleGroups.join(" · ").replaceAll("_", " ")}` : ""}</small>
                </span>
                <span className={styles.check} aria-label={selectedExerciseIds.has(exercise.id) ? "Incluido en la rutina" : undefined}>✓</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className={styles.library} aria-labelledby="mobilityLibraryTitle">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>Biblioteca</p><h2 id="mobilityLibraryTitle">Todos los ejercicios</h2></div>
          <span className={styles.count}>{MOBILITY_EXERCISES.length} ejercicios</span>
        </div>
        <div className={styles.libraryGrid}>
          {MOBILITY_EXERCISES.map((exercise) => (
            <article key={exercise.id} className={styles.libraryCard}>
              <Image src={exercise.mediaUrl} alt={`${exercise.exerciseName} — ${exercise.variantName}`} width={120} height={150} className={styles.libraryImage} />
              <div><strong>{exercise.variantName}</strong><span>{exercise.exerciseName}</span><small>{metricLabel(exercise)} · {exercise.defaultDose}</small></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
