"use client";

import { useState } from "react";
import type { PlanProposal } from "@/contracts/onboarding";
import { WEEKDAY_OPTIONS } from "../../presentation/constants";
import styles from "./ProposalScreen.module.css";

type ProposalScreenProps = {
  proposal: PlanProposal;
  onActivate: (proposal: PlanProposal) => void;
  onRestart: () => void;
  activating: boolean;
  activationError: string | null;
  activated: boolean;
};

function weekdayLabel(day: string): string {
  return WEEKDAY_OPTIONS.find((option) => option.value === day)?.label ?? day;
}

// Propuesta editable tras la transición: no es un paso más del wizard (sin
// barra de progreso ni tarjetas de pasos), es la salida del flujo.
export function ProposalScreen({ proposal, onActivate, onRestart, activating, activationError, activated }: ProposalScreenProps) {
  const [draft, setDraft] = useState(proposal);
  const [editing, setEditing] = useState(false);
  const sessions = draft.week.sessions;
  function updateSession(index: number, patch: Partial<(typeof sessions)[number]>) {
    setDraft((current) => ({ ...current, week: { ...current.week, sessions: current.week.sessions.map((session, i) => i === index ? { ...session, ...patch } : session) } }));
  }
  function removeSession(index: number) {
    setDraft((current) => ({ ...current, week: { ...current.week, sessions: current.week.sessions.filter((_, i) => i !== index) } }));
  }
  return (
    <section className={styles.wrap}>
      <p className={styles.kicker}>Tu plan inicial</p>
      <h1 className={styles.title}>{proposal.initialBlock.name}</h1>
      <p className={styles.purpose}>
        {proposal.initialBlock.purpose} · {proposal.initialBlock.weeks} semanas
      </p>

      <ul className={styles.sessions}>
        {sessions.map((session, index) => (
          <li key={`${session.day}-${index}`} className={styles.session}>
            {editing ? (
              <div className={styles.editor}>
                <select value={session.day} aria-label={`Día de ${session.title}`} onChange={(event) => updateSession(index, { day: event.target.value as typeof session.day })}>
                  {WEEKDAY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <input value={session.title} aria-label={`Nombre de ${session.title}`} onChange={(event) => updateSession(index, { title: event.target.value })} />
                <label className={styles.minutes}><input type="number" min={10} max={180} step={5} value={session.estimatedMinutes} aria-label={`Duración de ${session.title}`} onChange={(event) => updateSession(index, { estimatedMinutes: Number(event.target.value) || 60 })} /> min</label>
                <button type="button" className={styles.remove} onClick={() => removeSession(index)}>Eliminar</button>
              </div>
            ) : (
              <><span className={styles.sessionDay}>{weekdayLabel(session.day)}</span><span className={styles.sessionTitle}>{session.title}</span></>
            )}
            <span className={styles.sessionMeta}>
              {session.kind === "strength" ? "Fuerza" : "Exterior"} · {session.estimatedMinutes} min
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.reasons}>
        <p className={styles.sectionLabel}>Por qué esta propuesta</p>
        <ul>
          {proposal.reasons.map((reason) => (
            <li key={reason.code}>{reason.message}</li>
          ))}
        </ul>
      </div>

      <div className={styles.reasons}>
        <p className={styles.sectionLabel}>Antes de activar</p>
        <ul><li>Revisa y ajusta los días, el nombre, la duración o elimina una sesión si no te encaja.</li></ul>
      </div>

      {draft.alternatives.length > 0 && (
        <div className={styles.reasons}>
          <p className={styles.sectionLabel}>Alternativas</p>
          <ul>
            {draft.alternatives.map((alt) => (
              <li key={alt.code}>{alt.message}</li>
            ))}
          </ul>
        </div>
      )}

      {activationError && (
        <p role="alert" className={styles.sectionLabel} style={{ color: "var(--warn)" }}>
          No pudimos activar tu plan: {activationError}. Puedes intentarlo de nuevo.
        </p>
      )}

      {activated ? (
        <p role="status" className={styles.sectionLabel}>
          Plan activado.
        </p>
      ) : (
        <>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setEditing((value) => !value)} disabled={activating}>
              {editing ? "Listo" : "Editar sesiones"}
            </button>
            <button type="button" className={styles.primary} onClick={() => onActivate(draft)} disabled={activating || draft.week.sessions.length === 0} aria-busy={activating}>
              {activating ? "Activando…" : "Activar plan"}
            </button>
          </div>
          <button type="button" className={styles.editAnswers} onClick={onRestart} disabled={activating}>Editar respuestas del cuestionario</button>
        </>
      )}
    </section>
  );
}
