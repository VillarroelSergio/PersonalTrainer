"use client";

import { ScreenLayout } from "@/components/ScreenLayout";
import Image from "next/image";
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
            <div className="equipment-grid" role="group" aria-label={`Equipamiento en ${envLabel}`}>
              {EQUIPMENT_OPTIONS.map((option) => {
                const selected = environment.equipment.includes(option.value);
                return (
                  <button key={option.value} type="button" className={`equipment-card${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={() => onToggleEquipment(environment.kind, option.value)}>
                    <Image className="equipment-card__image" src={equipmentImage(option.value)} alt="" width={120} height={72} />
                    <span className="equipment-card__name">{option.label}</span>
                    <span className="equipment-card__check" aria-hidden="true">{selected ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </ScreenLayout>
  );
}

function equipmentImage(category: EquipmentCategory): string {
  const images: Record<EquipmentCategory, string> = {
    free_weights: "/library/exercises/press-banca-mancuernas-v3.webp",
    benches_supports: "/library/exercises/press-banca-barra-v2.webp",
    cables_torso: "/library/exercises/jalon-polea-agarre-ancho-v2.webp",
    leg_machines: "/library/exercises/elevacion-gemelo-maquina-v2.webp",
    bodyweight_accessories: "/library/exercises/plancha-v3.webp",
    indoor_cardio: "/library/exercises/sentadilla-goblet-v3.webp"
  };
  return images[category];
}
