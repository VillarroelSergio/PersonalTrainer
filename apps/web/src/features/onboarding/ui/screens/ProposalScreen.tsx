"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Image from "next/image";
import type { PlanProposal } from "@/contracts/onboarding";
import type { EditorialVariant } from "@/features/catalog/domain/editorial-content";
import type { EquipmentProfile } from "@/features/catalog/domain/inventory";
import { EQUIPMENT_CAPABILITIES } from "@/features/catalog/data/equipment-capabilities";
import { exerciseMediaAlt, exerciseMediaSrc } from "@/features/catalog/data/exercise-catalog";
import { compatibleExerciseAlternatives, exerciseById } from "@/features/planning/domain/exercise-alternatives";
import { replaceProposalExerciseVariant } from "@/features/planning/domain/plan-proposal-editor";
import { WEEKDAY_OPTIONS } from "../../presentation/constants";
import styles from "./ProposalScreen.module.css";

type ProposalScreenProps = {
  proposal: PlanProposal;
  environment?: EquipmentProfile;
  onActivate: (proposal: PlanProposal) => void;
  onRestart: () => void;
  activating: boolean;
  activationError: string | null;
  activated: boolean;
};

type PickerTarget = { sessionIndex: number; exerciseIndex: number };

function weekdayLabel(day: string): string {
  return WEEKDAY_OPTIONS.find((option) => option.value === day)?.label ?? day;
}

function variantLabel(variantId: string): string {
  const variant = exerciseById(variantId);
  return variant ? `${variant.exerciseName} · ${variant.variantName}` : variantId;
}

function exerciseOptions(variantId: string, environment?: EquipmentProfile): EditorialVariant[] {
  const current = exerciseById(variantId);
  if (!current) return [];
  return [current, ...(environment ? compatibleExerciseAlternatives(variantId, environment) : [])];
}

function equipmentLabel(variant: EditorialVariant): string {
  const capability = variant.requirements.allOf?.[0] ?? variant.requirements.anyOf?.[0] ?? "no_equipment";
  return EQUIPMENT_CAPABILITIES.find((item) => item.id === capability)?.label ?? "Equipamiento compatible";
}

function trackingLabel(variant: EditorialVariant): string {
  return variant.trackingMode === "reps_only" ? "Solo repeticiones" : "Carga y repeticiones";
}

export function ProposalScreen({ proposal, environment, onActivate, onRestart, activating, activationError, activated }: ProposalScreenProps) {
  const [draft, setDraft] = useState(proposal);
  const [editing, setEditing] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerTrigger, setPickerTrigger] = useState<HTMLButtonElement | null>(null);
  const sessions = draft.week.sessions;

  useEffect(() => {
    if (!pickerTarget) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerTarget(null);
        setPickerQuery("");
        pickerTrigger?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [pickerTarget, pickerTrigger]);

  function updateSession(index: number, patch: Partial<(typeof sessions)[number]>) {
    setDraft((current) => ({
      ...current,
      week: {
        ...current.week,
        sessions: current.week.sessions.map((session, sessionIndex) => sessionIndex === index ? { ...session, ...patch } : session)
      }
    }));
  }

  function removeSession(index: number) {
    setDraft((current) => ({ ...current, week: { ...current.week, sessions: current.week.sessions.filter((_, sessionIndex) => sessionIndex !== index) } }));
  }

  function replaceExercise(sessionIndex: number, exerciseIndex: number, variantId: string) {
    setDraft((current) => replaceProposalExerciseVariant(current, sessionIndex, exerciseIndex, variantId));
  }

  function openPicker(sessionIndex: number, exerciseIndex: number, event: MouseEvent<HTMLButtonElement>) {
    setPickerTrigger(event.currentTarget);
    setPickerQuery("");
    setPickerTarget({ sessionIndex, exerciseIndex });
  }

  function closePicker() {
    setPickerTarget(null);
    setPickerQuery("");
    pickerTrigger?.focus();
  }

  const pickerSession = pickerTarget ? draft.week.sessions[pickerTarget.sessionIndex] : undefined;
  const pickerExercise = pickerTarget ? pickerSession?.exercises?.[pickerTarget.exerciseIndex] : undefined;
  const pickerOptions = pickerExercise ? exerciseOptions(pickerExercise.variantId, environment) : [];
  const normalizedQuery = pickerQuery.trim().toLocaleLowerCase("es");
  const visiblePickerOptions = pickerOptions.filter((option) => (
    !normalizedQuery
    || `${option.exerciseName} ${option.variantName} ${equipmentLabel(option)}`.toLocaleLowerCase("es").includes(normalizedQuery)
  ));

  return (
    <section className={styles.wrap}>
      <p className={styles.kicker}>Tu plan inicial</p>
      <h1 className={styles.title}>{draft.initialBlock.name}</h1>
      <p className={styles.purpose}>{draft.initialBlock.purpose} · {draft.initialBlock.weeks} semanas</p>

      <ul className={styles.sessions}>
        {sessions.map((session, index) => (
          <li key={`${session.day}-${index}`} className={styles.session}>
            {editing ? (
              <div className={styles.editor}>
                <div className={styles.sessionControls}>
                  <select value={session.day} aria-label={`Día de ${session.title}`} onChange={(event) => updateSession(index, { day: event.target.value as typeof session.day })}>
                    {WEEKDAY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <label className={styles.minutes}>
                    <input type="number" min={10} max={180} step={5} value={session.estimatedMinutes} aria-label={`Duración de ${session.title}`} onChange={(event) => updateSession(index, { estimatedMinutes: Number(event.target.value) || 60 })} /> min
                  </label>
                  <button type="button" className={styles.remove} onClick={() => removeSession(index)}>Eliminar</button>
                </div>
                <strong className={styles.sessionTitle}>{session.title}</strong>
                <ExerciseList session={session} sessionIndex={index} editing environment={environment} onOpenPicker={openPicker} />
              </div>
            ) : (
              <>
                <div className={styles.sessionHeading}>
                  <span className={styles.sessionDay}>{weekdayLabel(session.day)}</span>
                  <span className={styles.sessionTitle}>{session.title}</span>
                  <span className={styles.sessionMeta}>{session.kind === "strength" ? "Fuerza" : "Exterior"} · {session.estimatedMinutes} min</span>
                </div>
                <ExerciseList session={session} sessionIndex={index} environment={environment} />
              </>
            )}
          </li>
        ))}
      </ul>

      <div className={styles.reasons}>
        <p className={styles.sectionLabel}>Por qué esta propuesta</p>
        <ul>{draft.reasons.map((reason) => <li key={reason.code}>{reason.message}</li>)}</ul>
      </div>

      <div className={styles.reasons}>
        <p className={styles.sectionLabel}>Antes de activar</p>
        <ul><li>Revisa los días, la duración y las variantes compatibles. El nombre de cada sesión describe su objetivo y no se edita.</li></ul>
      </div>

      {draft.alternatives.length > 0 && (
        <div className={styles.reasons}>
          <p className={styles.sectionLabel}>Alternativas</p>
          <ul>{draft.alternatives.map((alt) => <li key={alt.code}>{alt.message}</li>)}</ul>
        </div>
      )}

      {activationError && <p role="alert" className={styles.sectionLabel} style={{ color: "var(--warn)" }}>No pudimos activar tu plan: {activationError}. Puedes intentarlo de nuevo.</p>}

      {activated ? <p role="status" className={styles.sectionLabel}>Plan activado.</p> : (
        <>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setEditing((value) => !value)} disabled={activating}>{editing ? "Listo" : "Editar sesiones"}</button>
            <button type="button" className={styles.primary} onClick={() => onActivate(draft)} disabled={activating || draft.week.sessions.length === 0} aria-busy={activating}>{activating ? "Activando…" : "Activar plan"}</button>
          </div>
          <button type="button" className={styles.editAnswers} onClick={onRestart} disabled={activating}>Editar respuestas del cuestionario</button>
        </>
      )}

      {pickerTarget && pickerExercise ? (
        <div className="sheet-overlay" role="presentation" onClick={closePicker}>
          <section className={`sheet ${styles.pickerSheet}`} role="dialog" aria-modal="true" aria-labelledby="proposalExercisePickerTitle" onClick={(event) => event.stopPropagation()}>
            <div className="sheet__header">
              <div>
                <h2 id="proposalExercisePickerTitle">Elige una variante</h2>
                <p className={styles.pickerSubtitle}>Mismo patrón de movimiento · compatible con tu equipamiento</p>
              </div>
              <button type="button" className="icon-btn" aria-label="Cerrar selector de ejercicios" onClick={closePicker}>×</button>
            </div>
            <div className="sheet__body">
              <label className={styles.pickerSearchLabel} htmlFor="proposalExerciseSearch">Buscar ejercicio o equipamiento</label>
              <input
                id="proposalExerciseSearch"
                className={styles.pickerSearch}
                type="search"
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder="Ej.: mancuernas, polea, máquina…"
                autoFocus
              />
              <p className={styles.pickerCurrent}>Ahora: <strong>{variantLabel(pickerExercise.variantId)}</strong></p>
              <div className={styles.pickerList} aria-label="Variantes compatibles">
                {visiblePickerOptions.map((option) => {
                  const isCurrent = option.id === pickerExercise.variantId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`${styles.pickerOption}${isCurrent ? ` ${styles.pickerOptionCurrent}` : ""}`}
                      aria-current={isCurrent ? "true" : undefined}
                      onClick={() => {
                        if (!isCurrent && pickerTarget) replaceExercise(pickerTarget.sessionIndex, pickerTarget.exerciseIndex, option.id);
                        closePicker();
                      }}
                    >
                      <Image className={styles.pickerImage} src={exerciseMediaSrc(option)} alt={exerciseMediaAlt(option)} width={72} height={72} />
                      <span className={styles.pickerCopy}>
                        <strong>{option.exerciseName}</strong>
                        <span>{option.variantName}</span>
                        <small>{equipmentLabel(option)} · {trackingLabel(option)}</small>
                      </span>
                      <span className={styles.pickerState}>{isCurrent ? "Actual" : "Elegir"}</span>
                    </button>
                  );
                })}
                {visiblePickerOptions.length === 0 ? <p className={styles.pickerEmpty}>No encontramos una variante con ese texto.</p> : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ExerciseList({ session, sessionIndex, editing = false, environment, onOpenPicker }: {
  session: PlanProposal["week"]["sessions"][number];
  sessionIndex: number;
  editing?: boolean;
  environment?: EquipmentProfile;
  onOpenPicker?: (sessionIndex: number, exerciseIndex: number, event: MouseEvent<HTMLButtonElement>) => void;
}) {
  if (session.kind !== "strength") return <p className={styles.exerciseEmpty}>Actividad exterior · se detalla fuera de la rutina de fuerza.</p>;
  if (!session.exercises?.length) return <p className={styles.exerciseEmpty}>No hay ejercicios compatibles para este equipamiento.</p>;

  return (
    <ul className={styles.exerciseList} aria-label={`Ejercicios de ${session.title}`}>
      {session.exercises.map((exercise, exerciseIndex) => {
        const options = exerciseOptions(exercise.variantId, environment);
        return (
          <li key={`${exercise.variantId}-${exerciseIndex}`} className={styles.exercise}>
            <Image className={styles.exerciseImage} src={exerciseMediaSrc(options[0] ?? { primaryMuscleGroup: "core", mediaUrl: undefined })} alt={options[0] ? exerciseMediaAlt(options[0]) : variantLabel(exercise.variantId)} width={56} height={56} />
            <div className={styles.exerciseBody}>
              <strong>{variantLabel(exercise.variantId)}</strong>
              <span>{exercise.targetSets} series · {exercise.targetRepsMin}–{exercise.targetRepsMax} repeticiones</span>
            </div>
            {editing && options.length > 1 ? (
              <button type="button" className={styles.changeButton} aria-label={`Elegir otra variante para ${variantLabel(exercise.variantId)}`} onClick={(event) => onOpenPicker?.(sessionIndex, exerciseIndex, event)}>
                <span className={styles.changeButtonCopy}>
                  <strong>Cambiar ejercicio</strong>
                  <span>{options.length - 1} alternativas compatibles</span>
                </span>
                <span className={styles.changeButtonArrow} aria-hidden="true">›</span>
              </button>
            ) : editing ? <small className={styles.noAlternative}>No hay otra variante compatible.</small> : null}
          </li>
        );
      })}
    </ul>
  );
}
