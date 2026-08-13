"use client";

import { ChipPicker } from "@/components/ChipPicker";
import { ScreenLayout } from "@/components/ScreenLayout";
import { DURATION_OPTIONS, ENVIRONMENT_OPTIONS } from "../../presentation/constants";
import type { EnvironmentKind } from "../../presentation/types";

type DurationScreenProps = { sessionDurationMinutes: 20 | 40 | 60 | 90; onDurationChange: (minutes: 20 | 40 | 60 | 90) => void };

export function DurationScreen({ sessionDurationMinutes, onDurationChange }: DurationScreenProps) {
  return <ScreenLayout title="¿Cuánto tiempo quieres entrenar?" hint="Elige una duración habitual. Podrás ajustarla antes de entrenar."><ChipPicker ariaLabel="Duración habitual de la sesión" options={DURATION_OPTIONS} selected={[sessionDurationMinutes]} onToggle={onDurationChange} /></ScreenLayout>;
}

type EnvironmentScreenProps = { selectedEnvironments: EnvironmentKind[]; onToggleEnvironment: (kind: EnvironmentKind) => void };

export function EnvironmentScreen({ selectedEnvironments, onToggleEnvironment }: EnvironmentScreenProps) {
  return <ScreenLayout title="¿Dónde entrenas?" hint="Elige tu entorno habitual. Podrás cambiarlo más adelante."><ChipPicker ariaLabel="Entorno habitual de entrenamiento" options={ENVIRONMENT_OPTIONS} selected={selectedEnvironments} onToggle={onToggleEnvironment} /></ScreenLayout>;
}
