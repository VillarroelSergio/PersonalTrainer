"use client";

import { ChipPicker } from "@/components/ChipPicker";
import { ScreenLayout } from "@/components/ScreenLayout";
import { ENDURANCE_KIND_OPTIONS, WEEKDAY_OPTIONS } from "../../presentation/constants";
import type { EnduranceActivity, EnduranceKind, Weekday } from "../../presentation/types";

type StrengthAvailabilityScreenProps = {
  strengthAvailability: Weekday[];
  onToggleStrengthDay: (day: Weekday) => void;
};

export function StrengthAvailabilityScreen({ strengthAvailability, onToggleStrengthDay }: StrengthAvailabilityScreenProps) {
  return (
    <ScreenLayout title="¿Qué días puedes entrenar?" hint="Marca los días que normalmente te encajan. Podrás cambiar la semana antes de activarla.">
      <ChipPicker
        ariaLabel="Días disponibles para fuerza"
        options={WEEKDAY_OPTIONS.map((day) => ({ value: day.value, label: day.label }))}
        selected={strengthAvailability}
        onToggle={onToggleStrengthDay}
      />
    </ScreenLayout>
  );
}

type EnduranceScreenProps = {
  enduranceActivities: EnduranceActivity[];
  onUpsertEndurance: (activity: EnduranceActivity) => void;
  onRemoveEndurance: (kind: EnduranceKind) => void;
};

const SESSIONS_PER_WEEK = [1, 2, 3, 4, 5, 6, 7] as const;

export function EnduranceScreen({ enduranceActivities, onUpsertEndurance, onRemoveEndurance }: EnduranceScreenProps) {
  return (
    <ScreenLayout title="¿Haces cardio o actividad exterior?" hint="Es opcional. La tendremos en cuenta al repartir tu semana.">
      <div style={{ display: "grid", gap: 10 }}>
        {ENDURANCE_KIND_OPTIONS.map((option) => {
          const current = enduranceActivities.find((activity) => activity.kind === option.value);
          return (
            <div key={option.value} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 12, border: "1px solid var(--rule-soft)", borderRadius: "var(--r-md)", background: current ? "var(--accent-wash)" : "var(--paper)" }}>
              <button type="button" aria-pressed={Boolean(current)} onClick={() => current ? onRemoveEndurance(option.value) : onUpsertEndurance({ kind: option.value, sessionsPerWeek: 1 })} style={{ minHeight: 40, padding: 0, border: 0, background: "transparent", color: "var(--ink)", fontWeight: 700 }}>
                {option.label}
              </button>
              {current && <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".86rem", color: "var(--ink-2)" }}>por semana<select aria-label={`${option.label}: sesiones por semana`} value={current.sessionsPerWeek} onChange={(event) => onUpsertEndurance({ kind: option.value, sessionsPerWeek: Number(event.target.value) as EnduranceActivity["sessionsPerWeek"] })}>{SESSIONS_PER_WEEK.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>}
            </div>
          );
        })}
      </div>
    </ScreenLayout>
  );
}
