"use client";

import { ChipPicker } from "@/components/ChipPicker";
import { ScreenLayout } from "@/components/ScreenLayout";
import {
  DISCOMFORT_INTENSITY_OPTIONS,
  DISCOMFORT_KIND_OPTIONS,
  DISCOMFORT_SIDE_OPTIONS,
  DISCOMFORT_ZONE_OPTIONS,
  MUSCLE_FOCUS_OPTIONS
} from "../../presentation/constants";
import type { Discomfort, DiscomfortZone, MuscleFocus } from "../../presentation/types";
import styles from "./FocusDiscomfortScreen.module.css";

type FocusDiscomfortScreenProps = {
  optionalMuscleFocus: MuscleFocus[];
  onToggleFocus: (focus: MuscleFocus) => void;
  discomfort: Discomfort | null;
  onDiscomfortChange: (discomfort: Discomfort | null) => void;
};

const DEFAULT_INTENSITY: Discomfort["intensity"] = "mild";

export function FocusDiscomfortScreen({ optionalMuscleFocus, onToggleFocus, discomfort, onDiscomfortChange }: FocusDiscomfortScreenProps) {
  function selectZone(zone: DiscomfortZone) {
    if (discomfort?.zone === zone) {
      onDiscomfortChange(null);
      return;
    }
    onDiscomfortChange({ zone, intensity: DEFAULT_INTENSITY });
  }

  return (
    <ScreenLayout title="Foco y molestia" hint="Ambos son opcionales. Puedes seguir sin elegir nada.">
      <div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Foco muscular (hasta 3)</p>
        <ChipPicker ariaLabel="Foco muscular opcional" options={MUSCLE_FOCUS_OPTIONS} selected={optionalMuscleFocus} onToggle={onToggleFocus} />
      </div>

      <div>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Zona amplia de molestia (opcional, es contexto, no diagnóstico)</p>
        <div className={styles.zoneGrid} role="group" aria-label="Zonas amplias de molestia">
          {DISCOMFORT_ZONE_OPTIONS.map((zone) => (
            <button key={zone.value} type="button" className={`${styles.zoneCard}${discomfort?.zone === zone.value ? ` ${styles.zoneCardSelected}` : ""}`} aria-pressed={discomfort?.zone === zone.value} onClick={() => selectZone(zone.value)}>
              <span className={`${styles.zoneArt} ${styles[`zoneArt-${zone.value}`]}`} aria-hidden="true" />
              <span>{zone.label}</span>
            </button>
          ))}
        </div>

        {discomfort && (
          <div className={styles.detail}>
            <p className={styles.detailLabel}>Lado (opcional)</p>
            <ChipPicker
              ariaLabel="Lado de la molestia"
              options={DISCOMFORT_SIDE_OPTIONS}
              selected={discomfort.side ? [discomfort.side] : []}
              onToggle={(side) => onDiscomfortChange({ ...discomfort, side })}
            />
            <p className={styles.detailLabel}>Intensidad</p>
            <ChipPicker
              ariaLabel="Intensidad de la molestia"
              options={DISCOMFORT_INTENSITY_OPTIONS}
              selected={[discomfort.intensity]}
              onToggle={(intensity) => onDiscomfortChange({ ...discomfort, intensity })}
            />
            <p className={styles.detailLabel}>Tipo (opcional)</p>
            <ChipPicker
              ariaLabel="Tipo de molestia"
              options={DISCOMFORT_KIND_OPTIONS}
              selected={discomfort.kind ? [discomfort.kind] : []}
              onToggle={(kind) => onDiscomfortChange({ ...discomfort, kind })}
            />
            <button type="button" className={styles.clear} onClick={() => onDiscomfortChange(null)}>
              Quitar molestia
            </button>
          </div>
        )}
      </div>
    </ScreenLayout>
  );
}
