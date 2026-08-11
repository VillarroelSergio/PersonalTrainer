"use client";

import { ChipPicker } from "@/components/ChipPicker";
import { ScreenLayout } from "@/components/ScreenLayout";
import { ENVIRONMENT_OPTIONS, EQUIPMENT_OPTIONS } from "../../presentation/constants";
import type { Environment, EquipmentCategory, EnvironmentKind } from "../../presentation/types";

type EquipmentScreenProps = {
  environments: Environment[];
  onToggleEquipment: (kind: EnvironmentKind, equipment: EquipmentCategory) => void;
};

export function EquipmentScreen({ environments, onToggleEquipment }: EquipmentScreenProps) {
  return (
    <ScreenLayout title="Equipamiento" hint="Todo el material compatible con tu entorno está marcado. Quita lo que no tengas.">
      {environments.map((environment) => {
        const envLabel = ENVIRONMENT_OPTIONS.find((option) => option.value === environment.kind)?.label ?? environment.kind;
        return (
          <div key={environment.kind}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>{envLabel}</p>
            <ChipPicker
              ariaLabel={`Equipamiento en ${envLabel}`}
              options={EQUIPMENT_OPTIONS}
              selected={environment.equipment}
              onToggle={(equipment) => onToggleEquipment(environment.kind, equipment)}
            />
          </div>
        );
      })}
    </ScreenLayout>
  );
}
