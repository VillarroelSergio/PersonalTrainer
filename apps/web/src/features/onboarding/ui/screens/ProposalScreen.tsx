"use client";

import { useState } from "react";
import type { PlanProposal } from "@/contracts/onboarding";
import type { EditorialVariant } from "@/features/catalog/domain/editorial-content";
import type { EquipmentProfile } from "@/features/catalog/domain/inventory";
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

export function ProposalScreen({ proposal, environment, onActivate, onRestart, activating, activationError, activated }: ProposalScreenProps) {
  const [draft, setDraft] = useState(proposal);
  const [editing, setEditing] = useState(false);
  const sessions = draft.week.sessions;

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
                <ExerciseList session={session} sessionIndex={index} editing environment={environment} onReplace={replaceExercise} />
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
    </section>
  );
}

function ExerciseList({ session, sessionIndex, editing = false, environment, onReplace }: {
  session: PlanProposal["week"]["sessions"][number];
  sessionIndex: number;
  editing?: boolean;
  environment?: EquipmentProfile;
  onReplace?: (sessionIndex: number, exerciseIndex: number, variantId: string) => void;
}) {
  if (session.kind !== "strength") return <p className={styles.exerciseEmpty}>Actividad exterior · se detalla fuera de la rutina de fuerza.</p>;
  if (!session.exercises?.length) return <p className={styles.exerciseEmpty}>No hay ejercicios compatibles para este equipamiento.</p>;

  return (
    <ul className={styles.exerciseList} aria-label={`Ejercicios de ${session.title}`}>
      {session.exercises.map((exercise, exerciseIndex) => {
        const options = exerciseOptions(exercise.variantId, environment);
        return (
          <li key={`${exercise.variantId}-${exerciseIndex}`} className={styles.exercise}>
            <div>
              <strong>{variantLabel(exercise.variantId)}</strong>
              <span>{exercise.targetSets} series · {exercise.targetRepsMin}–{exercise.targetRepsMax} repeticiones</span>
            </div>
            {editing && options.length > 1 ? (
              <select value={exercise.variantId} aria-label={`Cambiar ${variantLabel(exercise.variantId)}`} onChange={(event) => onReplace?.(sessionIndex, exerciseIndex, event.target.value)}>
                {options.map((option) => <option key={option.id} value={option.id}>{option.variantName}</option>)}
              </select>
            ) : editing ? <small className={styles.noAlternative}>No hay otra variante compatible.</small> : null}
          </li>
        );
      })}
    </ul>
  );
}
