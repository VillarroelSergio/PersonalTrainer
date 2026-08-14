"use client";

import { ScreenLayout } from "@/components/ScreenLayout";
import Image from "next/image";
import { ENVIRONMENT_OPTIONS, EQUIPMENT_IMAGE, EQUIPMENT_OPTIONS } from "../../presentation/constants";
import type { Environment, EquipmentCategory, EnvironmentKind } from "../../presentation/types";
import styles from "./EquipmentScreen.module.css";

type EquipmentScreenProps = {
  environments: Environment[];
  onToggleEquipment: (kind: EnvironmentKind, equipment: EquipmentCategory) => void;
};

export function EquipmentScreen({ environments, onToggleEquipment }: EquipmentScreenProps) {
  return (
    <ScreenLayout title="Selecciona tu equipamiento" hint="Las ilustraciones muestran cada categoría. Quita lo que no tengas.">
      <p className={styles.intro}>Esto solo nos ayuda a priorizar variantes compatibles para tu entrenamiento.</p>
      {environments.map((environment) => {
        const envLabel = ENVIRONMENT_OPTIONS.find((option) => option.value === environment.kind)?.label ?? environment.kind;
        return (
          <div key={environment.kind}>
            <p className={styles.environment}>{envLabel}</p>
            <div className={styles.grid} role="group" aria-label={`Equipamiento en ${envLabel}`}>
              {EQUIPMENT_OPTIONS.map((option) => {
                const selected = environment.equipment.includes(option.value);
                return (
                  <button key={option.value} type="button" className={`${styles.card}${selected ? ` ${styles.cardSelected}` : ""}`} aria-pressed={selected} onClick={() => onToggleEquipment(environment.kind, option.value)}>
                    <span className={styles.art} aria-hidden="true">
                      <Image src={EQUIPMENT_IMAGE[option.value]} alt="" width={74} height={64} />
                    </span>
                    <span className={styles.name}>{option.label}</span>
                    <span className={styles.check} aria-hidden="true">{selected ? "✓" : ""}</span>
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
