"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./WheelPicker.module.css";

const ITEM_HEIGHT = 56;
const SCROLL_SETTLE_MS = 80;

type WheelPickerProps<T> = {
  label: string;
  values: readonly T[];
  value: T;
  formatLabel: (value: T) => string;
  ariaLabel: string;
  onChange: (value: T) => void;
};

// Rueda de selección accesible: arrastre/scroll con snap y alternativa
// completa de teclado (flechas), roving aria-activedescendant. Puerto de
// prototype/js/views/access.js:547-619 (patrón validado) a React tipado.
export function WheelPicker<T>({ label, values, value, formatLabel, ariaLabel, onChange }: WheelPickerProps<T>) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const instanceId = useMemo(() => `wheel-${Math.random().toString(36).slice(2)}`, []);
  const initialIndex = Math.max(0, values.indexOf(value));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    wheel.scrollTop = initialIndex * ITEM_HEIGHT;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function commit(index: number) {
    const clamped = Math.max(0, Math.min(values.length - 1, index));
    setActiveIndex(clamped);
    onChange(values[clamped]);
  }

  function handleScroll() {
    const wheel = wheelRef.current;
    if (!wheel) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      commit(Math.round(wheel.scrollTop / ITEM_HEIGHT));
    }, SCROLL_SETTLE_MS);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let nextIndex = activeIndex;
    if (event.key === "ArrowDown") nextIndex = Math.min(values.length - 1, activeIndex + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, activeIndex - 1);
    else return;
    event.preventDefault();
    if (wheelRef.current) wheelRef.current.scrollTop = nextIndex * ITEM_HEIGHT;
    commit(nextIndex);
  }

  return (
    <div className={styles.column}>
      <p className={styles.label}>{label}</p>
      <div className={styles.band} aria-hidden="true" />
      <div
        ref={wheelRef}
        className={styles.wheel}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        aria-activedescendant={`${instanceId}-opt${activeIndex}`}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.pad} />
        {values.map((item, index) => (
          <div
            key={String(item)}
            id={`${instanceId}-opt${index}`}
            role="option"
            aria-selected={index === activeIndex}
            className={index === activeIndex ? `${styles.item} ${styles.itemCenter}` : styles.item}
          >
            {formatLabel(item)}
          </div>
        ))}
        <div className={styles.pad} />
      </div>
    </div>
  );
}
