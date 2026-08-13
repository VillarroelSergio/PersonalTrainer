"use client";

import { ScreenLayout } from "@/components/ScreenLayout";
import { WheelPicker } from "@/components/WheelPicker";
import { MONTH_LABELS, range } from "../../presentation/constants";
import { birthYearBounds } from "../../presentation/state";
import styles from "./PhysicalScreens.module.css";

const PRIVACY_NOTE = "Solo se usan para ajustar tu punto de partida.";
const DAYS = range(1, 31);
const MONTHS = range(1, 12);

type BirthDateScreenProps = {
  day: number;
  month: number;
  year: number;
  onDayChange: (day: number) => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
};

export function BirthDateScreen({ day, month, year, onDayChange, onMonthChange, onYearChange }: BirthDateScreenProps) {
  const { min, max } = birthYearBounds();
  const years = range(min, max);
  return (
    <ScreenLayout title="¿Cuál es tu fecha de nacimiento?" hint="Desliza cada rueda para elegirla.">
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 14 }}>
        <WheelPicker label="Día" values={DAYS} value={day} formatLabel={(v) => String(v)} ariaLabel="Día de nacimiento" onChange={onDayChange} />
        <WheelPicker label="Mes" values={MONTHS} value={month} formatLabel={(v) => MONTH_LABELS[v - 1]} ariaLabel="Mes de nacimiento" onChange={onMonthChange} />
        <WheelPicker label="Año" values={years} value={year} formatLabel={(v) => String(v)} ariaLabel="Año de nacimiento" onChange={onYearChange} />
      </div>
      <p style={{ textAlign: "center", color: "var(--ink-3)" }}>{PRIVACY_NOTE}</p>
    </ScreenLayout>
  );
}

const HEIGHTS_CM = range(100, 250);

type HeightScreenProps = { heightCm: number; onChange: (heightCm: number) => void };

export function HeightScreen({ heightCm, onChange }: HeightScreenProps) {
  return (
    <ScreenLayout title="¿Cuánto mides?" hint="Selecciona tu altura en centímetros.">
      <div className={styles.singleWheel}>
        <WheelPicker label="cm" values={HEIGHTS_CM} value={heightCm} formatLabel={(v) => String(v)} ariaLabel="Altura en centímetros" onChange={onChange} />
      </div>
      <p style={{ textAlign: "center", color: "var(--ink-3)" }}>{PRIVACY_NOTE}</p>
    </ScreenLayout>
  );
}

const KG_WHOLE = range(30, 300);
const KG_DECIMAL = range(0, 9);

type WeightScreenProps = { whole: number; decimal: number; onWholeChange: (whole: number) => void; onDecimalChange: (decimal: number) => void };

export function WeightScreen({ whole, decimal, onWholeChange, onDecimalChange }: WeightScreenProps) {
  return (
    <ScreenLayout title="¿Cuánto pesas?" hint="Selecciona un valor aproximado en kilogramos.">
      <div className={styles.weightWheels}>
        <WheelPicker label="kg" values={KG_WHOLE} value={whole} formatLabel={(v) => String(v)} ariaLabel="Peso, kilogramos enteros" onChange={onWholeChange} />
        <span className={styles.decimalMark}>,</span>
        <WheelPicker label="décimas" values={KG_DECIMAL} value={decimal} formatLabel={(v) => String(v)} ariaLabel="Peso, décimas de kilogramo" onChange={onDecimalChange} />
        <span className={styles.weightUnit}>kg</span>
      </div>
      <p style={{ textAlign: "center", color: "var(--ink-3)" }}>{PRIVACY_NOTE}</p>
    </ScreenLayout>
  );
}
