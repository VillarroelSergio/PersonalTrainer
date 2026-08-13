import styles from "./ProgressHeader.module.css";

type ProgressHeaderProps = {
  currentIndex: number;
  totalSteps: number;
  stepLabel: string;
};

export function ProgressHeader({ currentIndex, totalSteps, stepLabel }: ProgressHeaderProps) {
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
