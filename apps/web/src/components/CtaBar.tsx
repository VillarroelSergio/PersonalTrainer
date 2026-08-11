import styles from "./CtaBar.module.css";

type CtaBarProps = {
  onBack?: () => void;
  onContinue: () => void;
  continueLabel: string;
  continueDisabled?: boolean;
};

export function CtaBar({ onBack, onContinue, continueLabel, continueDisabled }: CtaBarProps) {
  return (
    <div className={styles.bar}>
      {onBack && (
        <button type="button" className={styles.back} onClick={onBack}>
          Atrás
        </button>
      )}
      <button type="button" className={styles.continue} onClick={onContinue} disabled={continueDisabled}>
        {continueLabel}
      </button>
    </div>
  );
}
