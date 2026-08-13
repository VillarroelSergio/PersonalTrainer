"use client";

import { useEffect, useRef, useState } from "react";
import { TRANSITION_DURATION_MS, TRANSITION_MAX_PERCENT, percentForElapsed, phaseForPercent } from "@/features/onboarding/presentation/transition";
import styles from "./RingTransition.module.css";

const RADIUS = 98;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type RingTransitionProps = {
  onFinished: () => void;
};

// Transición inmersiva 0→99% en exactamente cinco segundos, sin tarjetas de
// pasos ni CTA. Puerto de prototype/js/views/access.js:906-998 (patrón
// validado, incluida la rama prefers-reduced-motion) a React.
export function RingTransition({ onFinished }: RingTransitionProps) {
  const [percent, setPercent] = useState(0);
  const [phraseText, setPhraseText] = useState(phaseForPercent(0).text);
  const [announcement, setAnnouncement] = useState(phaseForPercent(0).text);
  const finishedRef = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setPercent(TRANSITION_MAX_PERCENT);
      const finalPhase = phaseForPercent(TRANSITION_MAX_PERCENT).text;
      setPhraseText(finalPhase);
      setAnnouncement(finalPhase);
      const timer = setTimeout(() => {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinished();
        }
      }, TRANSITION_DURATION_MS);
      return () => clearTimeout(timer);
    }

    let start: number | null = null;
    let frame = 0;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    function step(now: number) {
      if (start === null) start = now;
      const elapsed = now - start;
      const pct = percentForElapsed(elapsed);
      setPercent(pct);
      const phase = phaseForPercent(pct);
      setPhraseText((prev) => {
        if (prev !== phase.text) setAnnouncement(phase.text);
        return phase.text;
      });
      if (elapsed < TRANSITION_DURATION_MS) {
        frame = requestAnimationFrame(step);
      } else {
        settleTimer = setTimeout(() => {
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinished();
          }
        }, 250);
      }
    }
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      if (settleTimer) clearTimeout(settleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dashOffset = CIRCUMFERENCE * (1 - percent / (TRANSITION_MAX_PERCENT + 1));

  return (
    <section className={styles.wrap}>
      <p className={styles.kicker}>Estamos preparando tu plan</p>
      <h1 className={styles.title}>Tu plan personalizado</h1>
      <div
        className={styles.circle}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={TRANSITION_MAX_PERCENT}
        aria-valuenow={percent}
        aria-label="Generando tu plan"
      >
        <svg viewBox="0 0 220 220" className={styles.ring} aria-hidden="true">
          <circle className={styles.ringTrack} cx="110" cy="110" r={RADIUS} />
          <circle
            className={styles.ringFill}
            cx="110"
            cy="110"
            r={RADIUS}
            style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: dashOffset }}
          />
        </svg>
        <p className={styles.percent}>{percent}%</p>
      </div>
      <p className={styles.phrase}>{phraseText}</p>
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
