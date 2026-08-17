import styles from "./ProgressHeader.module.css";

type ProgressHeaderProps = {
  currentIndex: number;
  /** null mientras el total no se conoce: el modo guiado se salta el paso "Rutina", así
   * que antes de elegir modo no hay una cifra honesta que enseñar (decía "de 15" y pasaba
   * a "de 14" en cuanto elegías guiado). */
  totalSteps: number | null;
  stepLabel: string;
};

export function ProgressHeader({ currentIndex, totalSteps, stepLabel }: ProgressHeaderProps) {
  if (totalSteps === null) {
    return (
      <div className={styles.wrap}>
        <p className={styles.caption}>Paso {currentIndex + 1} · {stepLabel}</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.caption}>
        Paso {currentIndex + 1} de {totalSteps} · {stepLabel}
      </p>
      <ol className={styles.rail} aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, index) => (
          <li
            key={index}
            className={index === currentIndex ? `${styles.dot} ${styles.dotCurrent}` : index < currentIndex ? `${styles.dot} ${styles.dotDone}` : styles.dot}
            aria-current={index === currentIndex ? "step" : undefined}
          />
        ))}
      </ol>
    </div>
  );
}
