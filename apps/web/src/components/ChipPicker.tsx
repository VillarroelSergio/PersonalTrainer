"use client";

import styles from "./ChipPicker.module.css";

type ChipOption<T> = { value: T; label: string };

type ChipPickerProps<T> = {
  ariaLabel: string;
  options: Array<ChipOption<T>>;
  selected: T[];
  onToggle: (value: T) => void;
  /** Índice 0 del array `selected` se marca como prioridad (texto visible, no solo color). */
  markFirstAsPriority?: boolean;
};

// Selector de chips accesible (multi o single-vía-un-solo-toggle externo):
// estado con texto y aria-pressed, nunca solo color. Puerto conceptual de
// prototype/js/views/access.js:464-498 (buildSinglePicker/buildMultiPicker).
export function ChipPicker<T extends string | number>({ ariaLabel, options, selected, onToggle, markFirstAsPriority }: ChipPickerProps<T>) {
  return (
    <div className={styles.grid} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        const isPriority = markFirstAsPriority && isSelected && selected[0] === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={isSelected ? `${styles.chip} ${styles.chipSelected}` : styles.chip}
            aria-pressed={isSelected}
            onClick={() => onToggle(option.value)}
          >
            <span>{option.label}</span>
            {isPriority && <span className={styles.priorityBadge}>Prioridad</span>}
          </button>
        );
      })}
    </div>
  );
}
