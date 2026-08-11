"use client";

import type { PlanProposal } from "@/contracts/onboarding";
import { WEEKDAY_OPTIONS } from "../../presentation/constants";
import styles from "./ProposalScreen.module.css";

type ProposalScreenProps = {
  proposal: PlanProposal;
  onActivate: () => void;
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
  return (
    <section className={styles.wrap}>
      <p className={styles.kicker}>Tu plan inicial</p>
      <h1 className={styles.title}>{proposal.initialBlock.name}</h1>
      <p className={styles.purpose}>
        {proposal.initialBlock.purpose} · {proposal.initialBlock.weeks} semanas
      </p>

      <ul className={styles.sessions}>
        {proposal.week.sessions.map((session, index) => (
          <li key={`${session.day}-${index}`} className={styles.session}>
            <span className={styles.sessionDay}>{weekdayLabel(session.day)}</span>
            <span className={styles.sessionTitle}>{session.title}</span>
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

      {proposal.alternatives.length > 0 && (
        <div className={styles.reasons}>
          <p className={styles.sectionLabel}>Alternativas</p>
          <ul>
            {proposal.alternatives.map((alt) => (
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
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onRestart} disabled={activating}>
            Editar respuestas
          </button>
          <button type="button" className={styles.primary} onClick={onActivate} disabled={activating} aria-busy={activating}>
            {activating ? "Activando…" : "Activar plan"}
          </button>
        </div>
      )}
    </section>
  );
}
