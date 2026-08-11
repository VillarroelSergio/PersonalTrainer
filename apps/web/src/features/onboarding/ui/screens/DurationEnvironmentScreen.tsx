"use client";

import { ChipPicker } from "@/components/ChipPicker";
import { ScreenLayout } from "@/components/ScreenLayout";
import { DURATION_OPTIONS, ENVIRONMENT_OPTIONS } from "../../presentation/constants";
import type { EnvironmentKind } from "../../presentation/types";

type DurationEnvironmentScreenProps = {
  sessionDurationMinutes: 20 | 40 | 60 | 90;
  onDurationChange: (minutes: 20 | 40 | 60 | 90) => void;
  selectedEnvironments: EnvironmentKind[];
  onToggleEnvironment: (kind: EnvironmentKind) => void;
};

export function DurationEnvironmentScreen({
  sessionDurationMinutes,
  onDurationChange,
  selectedEnvironments,
  onToggleEnvironment
}: DurationEnvironmentScreenProps) {
  return (
    <ScreenLayout title="Duración y entorno" hint="Elige tu duración habitual y dónde entrenas normalmente.">
      <div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Duración habitual</p>
        <ChipPicker
          ariaLabel="Duración habitual de la sesión"
          options={DURATION_OPTIONS}
          selected={[sessionDurationMinutes]}
          onToggle={onDurationChange}
        />
      </div>
      <div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Entornos habituales</p>
        <ChipPicker
          ariaLabel="Entornos habituales de entrenamiento"
          options={ENVIRONMENT_OPTIONS}
          selected={selectedEnvironments}
          onToggle={onToggleEnvironment}
        />
      </div>
    </ScreenLayout>
  );
}
