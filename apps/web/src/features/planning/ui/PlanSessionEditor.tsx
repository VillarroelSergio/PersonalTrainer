"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { PlanProposal } from "@/contracts/onboarding";
import { EQUIPMENT_CAPABILITIES } from "@/features/catalog/data/equipment-capabilities";
import { EXERCISE_CATALOG, exerciseMediaAlt, exerciseMediaSrc, findVariant, type ExerciseVariant } from "@/features/catalog/data/exercise-catalog";
import styles from "./PlanSessionEditor.module.css";

type PlannedSession = PlanProposal["week"]["sessions"][number];
type ExerciseDraft = NonNullable<PlannedSession["exercises"]>[number];
type PickerMode = { kind: "replace"; exerciseIndex: number } | { kind: "add" };

type PlanSessionEditorProps = {
  planId: string;
  weekStart: string;
  sessionIndex: number;
  session: PlannedSession;
};

function equipmentLabel(variant: ExerciseVariant): string {
  const capability = variant.equipment === "bodyweight" ? "no_equipment" : variant.equipment;
  return EQUIPMENT_CAPABILITIES.find((item) => item.id === capability)?.label ?? "Equipamiento compatible";
}

function trackingLabel(variant: ExerciseVariant): string {
  return variant.trackingMode === "reps_only" ? "Solo repeticiones" : "Carga y repeticiones";
}

function exerciseLabel(variantId: string): string {
  const variant = findVariant(variantId);
  return variant ? `${variant.exerciseName} · ${variant.variantName}` : variantId;
}

export default function PlanSessionEditor({ planId, weekStart, sessionIndex, session }: PlanSessionEditorProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [draft, setDraft] = useState<ExerciseDraft[]>(session.exercises ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!sheetOpen) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (pickerMode) {
        setPickerMode(null);
        setPickerQuery("");
      } else {
        setSheetOpen(false);
        setError(null);
        trigger?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [pickerMode, sheetOpen, trigger]);

  function openEditor(event: MouseEvent<HTMLButtonElement>) {
    setDraft(session.exercises ?? []);
    setError(null);
    setPickerMode(null);
    setPickerQuery("");
    setTrigger(event.currentTarget);
    setSheetOpen(true);
  }

  function closeEditor() {
    setSheetOpen(false);
    setPickerMode(null);
    setPickerQuery("");
    setError(null);
    trigger?.focus();
  }

  function openPicker(mode: PickerMode, event: MouseEvent<HTMLButtonElement>) {
    setTrigger(event.currentTarget);
    setPickerQuery("");
    setPickerMode(mode);
  }

  function closePicker() {
    setPickerMode(null);
    setPickerQuery("");
  }

  function replaceExercise(exerciseIndex: number, variantId: string) {
    setDraft((current) => current.map((exercise, index) => index === exerciseIndex ? { ...exercise, variantId } : exercise));
    closePicker();
  }

  function addExercise(variantId: string) {
    setDraft((current) => current.some((exercise) => exercise.variantId === variantId) ? current : [
      ...current,
      { variantId, targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }
    ]);
    closePicker();
  }

  function removeExercise(exerciseIndex: number) {
    setDraft((current) => current.length <= 1 ? current : current.filter((_, index) => index !== exerciseIndex));
  }

  function updateMetric(exerciseIndex: number, key: "targetSets" | "targetRepsMin" | "targetRepsMax", value: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setDraft((current) => current.map((exercise, index) => {
      if (index !== exerciseIndex) return exercise;
      const bounded = Math.max(1, Math.min(key === "targetSets" ? 12 : 100, Math.round(parsed)));
      const next = { ...exercise, [key]: bounded };
      if (key === "targetRepsMin" && next.targetRepsMax < bounded) next.targetRepsMax = bounded;
      if (key === "targetRepsMax" && next.targetRepsMin > bounded) next.targetRepsMin = bounded;
      return next;
    }));
  }

  async function save() {
    if (draft.length === 0) {
      setError("La sesión debe conservar al menos un ejercicio.");
      return;
    }
    setPending(true);
    setError(null);
    const response = await fetch(`/api/v1/plans/${planId}/session-content`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isoWeekStart: weekStart, sessionIndex, exercises: draft })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error?.message ?? "No pudimos guardar los ejercicios.");
      setPending(false);
      return;
    }
    setPending(false);
    closeEditor();
    router.refresh();
  }

  const selectedIds = new Set(draft.map((exercise) => exercise.variantId));
  const replacementSource = pickerMode?.kind === "replace" ? findVariant(draft[pickerMode.exerciseIndex]?.variantId) : undefined;
  const pickerOptions = pickerMode
    ? EXERCISE_CATALOG.filter((variant) => (
      (pickerMode.kind === "add" || !replacementSource || variant.movementPattern === replacementSource.movementPattern)
      && (!selectedIds.has(variant.id) || (pickerMode.kind === "replace" && variant.id === draft[pickerMode.exerciseIndex]?.variantId))
    ))
    : [];
  const normalizedQuery = pickerQuery.trim().toLocaleLowerCase("es");
  const visiblePickerOptions = pickerOptions.filter((variant) => (
    !normalizedQuery
    || `${variant.exerciseName} ${variant.variantName} ${equipmentLabel(variant)}`.toLocaleLowerCase("es").includes(normalizedQuery)
  ));

  if (session.kind !== "strength") return null;

  return (
    <>
      <button type="button" className="btn btn--ghost btn--sm" onClick={openEditor} aria-label={`Editar ejercicios de ${session.title}`}>
        Editar ejercicios
      </button>

      {sheetOpen ? (
        <div className="sheet-overlay" role="presentation" onClick={closeEditor}>
          <section className={`sheet ${styles.editorSheet}`} role="dialog" aria-modal="true" aria-labelledby={`planSessionEditorTitle-${sessionIndex}`} onClick={(event) => event.stopPropagation()}>
            <div className="sheet__header">
              <div>
                <h2 id={`planSessionEditorTitle-${sessionIndex}`}>Editar sesión</h2>
                <p className={styles.sheetSubtitle}>{session.title} · {draft.length} ejercicios</p>
              </div>
              <button type="button" className="icon-btn" aria-label="Cerrar editor de sesión" onClick={closeEditor}>×</button>
            </div>
            <div className="sheet__body">
              {error ? <p className="notice notice--warn" role="alert">{error}</p> : null}
              <p className={styles.helper}>Cambia la variante, ajusta sus objetivos o elimina ejercicios que no quieras hacer.</p>
              <ol className={styles.exerciseList} aria-label={`Ejercicios editables de ${session.title}`}>
                {draft.map((exercise, exerciseIndex) => {
                  const variant = findVariant(exercise.variantId);
                  return (
                    <li key={`${exercise.variantId}-${exerciseIndex}`} className={styles.exerciseCard}>
                      <Image className={styles.exerciseImage} src={variant ? exerciseMediaSrc(variant) : "/library/groups/core-card-v1.webp"} alt={variant ? exerciseMediaAlt(variant) : exerciseLabel(exercise.variantId)} width={68} height={68} />
                      <div className={styles.exerciseInfo}>
                        <strong>{variant?.exerciseName ?? exercise.variantId}</strong>
                        <span>{variant?.variantName ?? "Variante no catalogada"}</span>
                        <small>{variant ? `${equipmentLabel(variant)} · ${trackingLabel(variant)}` : "Revisa esta variante"}</small>
                      </div>
                      <div className={styles.exerciseActions}>
                        <button type="button" className={styles.changeButton} onClick={(event) => openPicker({ kind: "replace", exerciseIndex }, event)}>Cambiar</button>
                        <button type="button" className={styles.removeButton} disabled={draft.length <= 1} onClick={() => removeExercise(exerciseIndex)} aria-label={`Eliminar ${exerciseLabel(exercise.variantId)}`}>Eliminar</button>
                      </div>
                      <div className={styles.metricGrid} aria-label={`Objetivo de ${exerciseLabel(exercise.variantId)}`}>
                        <label>Series<input type="number" min={1} max={12} value={exercise.targetSets} onChange={(event) => updateMetric(exerciseIndex, "targetSets", event.target.value)} /></label>
                        <label>Reps mín.<input type="number" min={1} max={100} value={exercise.targetRepsMin} onChange={(event) => updateMetric(exerciseIndex, "targetRepsMin", event.target.value)} /></label>
                        <label>Reps máx.<input type="number" min={1} max={100} value={exercise.targetRepsMax} onChange={(event) => updateMetric(exerciseIndex, "targetRepsMax", event.target.value)} /></label>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <button type="button" className={styles.addButton} onClick={(event) => openPicker({ kind: "add" }, event)}>
                <span aria-hidden="true">＋</span>
                <span><strong>Añadir ejercicio</strong><small>Busca en todo el catálogo</small></span>
              </button>
            </div>
            <div className={styles.footer}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={closeEditor} disabled={pending}>Cancelar</button>
              <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={pending} aria-busy={pending}>{pending ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </section>

          {pickerMode ? (
            <div className={`sheet-overlay ${styles.pickerOverlay}`} role="presentation" onClick={(event) => { event.stopPropagation(); closePicker(); }}>
              <section className={`sheet ${styles.pickerSheet}`} role="dialog" aria-modal="true" aria-labelledby={`planExercisePickerTitle-${sessionIndex}`} onClick={(event) => event.stopPropagation()}>
                <div className="sheet__header">
                  <div>
                    <h2 id={`planExercisePickerTitle-${sessionIndex}`}>{pickerMode.kind === "add" ? "Añadir ejercicio" : "Cambiar ejercicio"}</h2>
                    <p className={styles.sheetSubtitle}>{pickerMode.kind === "add" ? "Elige una variante del catálogo" : "Se mantiene el mismo patrón de movimiento"}</p>
                  </div>
                  <button type="button" className="icon-btn" aria-label="Cerrar selector" onClick={closePicker}>×</button>
                </div>
                <div className="sheet__body">
                  <label className={styles.searchLabel} htmlFor={`planExerciseSearch-${sessionIndex}`}>Buscar por nombre o equipamiento</label>
                  <input id={`planExerciseSearch-${sessionIndex}`} className={styles.searchInput} type="search" value={pickerQuery} onChange={(event) => setPickerQuery(event.target.value)} placeholder="Ej.: mancuernas, polea, máquina…" autoFocus />
                  <div className={styles.pickerList} aria-label="Ejercicios disponibles">
                    {visiblePickerOptions.map((variant) => (
                      <button key={variant.id} type="button" className={styles.pickerOption} onClick={() => pickerMode.kind === "add" ? addExercise(variant.id) : replaceExercise(pickerMode.exerciseIndex, variant.id)}>
                        <Image className={styles.pickerImage} src={exerciseMediaSrc(variant)} alt={exerciseMediaAlt(variant)} width={70} height={70} />
                        <span className={styles.pickerCopy}>
                          <strong>{variant.exerciseName}</strong>
                          <span>{variant.variantName}</span>
                          <small>{equipmentLabel(variant)} · {trackingLabel(variant)}</small>
                        </span>
                        <span className={styles.pickerArrow} aria-hidden="true">›</span>
                      </button>
                    ))}
                    {visiblePickerOptions.length === 0 ? <p className={styles.emptyPicker}>No hay ejercicios que coincidan con la búsqueda.</p> : null}
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
