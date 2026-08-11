"use client";

import { ChipPicker } from "@/components/ChipPicker";
import { ScreenLayout } from "@/components/ScreenLayout";
import { ENDURANCE_KIND_OPTIONS, WEEKDAY_OPTIONS } from "../../presentation/constants";
import type { EnduranceActivity, EnduranceKind, Weekday } from "../../presentation/types";

type ActivityScreenProps = {
  strengthAvailability: Weekday[];
  onToggleStrengthDay: (day: Weekday) => void;
  enduranceActivities: EnduranceActivity[];
  onUpsertEndurance: (activity: EnduranceActivity) => void;
  onRemoveEndurance: (kind: EnduranceKind) => void;
};

const SESSIONS_PER_WEEK = [1, 2, 3, 4, 5, 6, 7] as const;

export function ActivityScreen({
  strengthAvailability,
  onToggleStrengthDay,
  enduranceActivities,
  onUpsertEndurance,
  onRemoveEndurance
}: ActivityScreenProps) {
  return (
    <ScreenLayout title="Actividad y disponibilidad" hint="Elige los días concretos para fuerza y, si quieres, actividades exteriores.">
      <div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Días para fuerza</p>
        <ChipPicker
          ariaLabel="Días disponibles para fuerza"
          options={WEEKDAY_OPTIONS.map((day) => ({ value: day.value, label: day.short }))}
          selected={strengthAvailability}
          onToggle={onToggleStrengthDay}
        />
      </div>
      <div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Actividades exteriores (opcional)</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ENDURANCE_KIND_OPTIONS.map((option) => {
            const current = enduranceActivities.find((activity) => activity.kind === option.value);
            return (
              <div key={option.value} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  aria-pressed={Boolean(current)}
                  onClick={() => (current ? onRemoveEndurance(option.value) : onUpsertEndurance({ kind: option.value, sessionsPerWeek: 1 }))}
                  style={{
                    minHeight: 44,
                    padding: "0 14px",
                    borderRadius: "var(--r-md)",
                    border: `1px solid ${current ? "var(--accent)" : "var(--rule-soft)"}`,
                    background: current ? "var(--accent-wash)" : "var(--paper)",
                    color: "var(--ink)",
                    fontWeight: 600
                  }}
                >
                  {option.label}
                </button>
                {current && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)", fontSize: "0.9rem" }}>
                    Sesiones/semana
                    <select
                      value={current.sessionsPerWeek}
                      onChange={(event) => onUpsertEndurance({ kind: option.value, sessionsPerWeek: Number(event.target.value) as EnduranceActivity["sessionsPerWeek"] })}
                      style={{ minHeight: 44, borderRadius: "var(--r-sm)", border: "1px solid var(--rule-soft)", background: "var(--paper)", color: "var(--ink)" }}
                    >
                      {SESSIONS_PER_WEEK.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ScreenLayout>
  );
}
