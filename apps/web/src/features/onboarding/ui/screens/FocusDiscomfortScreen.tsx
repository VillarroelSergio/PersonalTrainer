"use client";

import { ChipPicker } from "@/components/ChipPicker";
import { ScreenLayout } from "@/components/ScreenLayout";
import { DISCOMFORT_INTENSITY_OPTIONS, DISCOMFORT_KIND_OPTIONS, DISCOMFORT_SIDE_OPTIONS, DISCOMFORT_ZONE_OPTIONS, MUSCLE_FOCUS_OPTIONS } from "../../presentation/constants";
import type { CSSProperties } from "react";
import type { Discomfort, DiscomfortZone, MuscleFocus } from "../../presentation/types";
import styles from "./FocusDiscomfortScreen.module.css";

type FocusScreenProps = { optionalMuscleFocus: MuscleFocus[]; onToggleFocus: (focus: MuscleFocus) => void };

export function FocusScreen({ optionalMuscleFocus, onToggleFocus }: FocusScreenProps) {
  return <ScreenLayout title="¿En qué grupo muscular quieres centrarte?" hint="Tu programa será equilibrado, pero puedes destacar un grupo para prestarle más atención."><div className={styles.focusList} role="group" aria-label="Grupo muscular prioritario">{MUSCLE_FOCUS_OPTIONS.map((option, index) => { const selected = optionalMuscleFocus.includes(option.value); return <button key={option.value} type="button" className={`${styles.focusCard}${selected ? ` ${styles.focusCardSelected}` : ""}`} aria-pressed={selected} onClick={() => onToggleFocus(option.value)}><span className={styles.focusIcon} aria-hidden="true" style={{ "--focus-x": `${index * 25}%` } as CSSProperties} /><span>{option.label}</span><i aria-hidden="true" /></button>; })}</div></ScreenLayout>;
}

type DiscomfortScreenProps = { discomfort: Discomfort | null; onDiscomfortChange: (discomfort: Discomfort | null) => void };
const DEFAULT_INTENSITY: Discomfort["intensity"] = "mild";
const FEATURED_ZONES: Array<{ zone: DiscomfortZone; label: string; spriteX: string; spriteY: string; compactSprite?: boolean }> = [
  { zone: "back", label: "Espalda", spriteX: "0%", spriteY: "0%" },
  { zone: "knee", label: "Rodilla", spriteX: "33.33%", spriteY: "0%" },
  { zone: "hip", label: "Cadera", spriteX: "66.66%", spriteY: "0%" },
  { zone: "elbow", label: "Codo", spriteX: "100%", spriteY: "0%" },
  { zone: "shoulder", label: "Hombro", spriteX: "0%", spriteY: "100%" },
  { zone: "wrist", label: "Muñeca", spriteX: "33.33%", spriteY: "100%" },
  { zone: "neck", label: "Cuello", spriteX: "66.66%", spriteY: "100%" },
  { zone: "ankle", label: "Tobillo", spriteX: "100%", spriteY: "100%" }
];

export function DiscomfortScreen({ discomfort, onDiscomfortChange }: DiscomfortScreenProps) {
  function selectZone(zone: DiscomfortZone) {
    onDiscomfortChange(discomfort?.zone === zone ? null : { zone, intensity: DEFAULT_INTENSITY });
  }

  return (
    <ScreenLayout title="¿Tienes alguna molestia?" hint="Opcional. Marca una zona amplia para tenerla en cuenta al preparar el plan.">
      <div className={styles.zoneGrid} role="group" aria-label="Zonas amplias de molestia">
        {FEATURED_ZONES.map((item) => <button key={item.zone} type="button" className={`${styles.zoneCard}${discomfort?.zone === item.zone ? ` ${styles.zoneCardSelected}` : ""}`} aria-pressed={discomfort?.zone === item.zone} onClick={() => selectZone(item.zone)}><span className={styles.zoneArt} aria-hidden="true" style={{ "--sprite-x": item.spriteX, "--sprite-y": item.spriteY } as CSSProperties} /><span>{item.label}</span></button>)}
      </div>
      {discomfort && <div className={styles.detail}>
        <p className={styles.detailLabel}>Lado (opcional)</p><ChipPicker ariaLabel="Lado de la molestia" options={DISCOMFORT_SIDE_OPTIONS} selected={discomfort.side ? [discomfort.side] : []} onToggle={(side) => onDiscomfortChange({ ...discomfort, side })} />
        <p className={styles.detailLabel}>Intensidad</p><ChipPicker ariaLabel="Intensidad de la molestia" options={DISCOMFORT_INTENSITY_OPTIONS} selected={[discomfort.intensity]} onToggle={(intensity) => onDiscomfortChange({ ...discomfort, intensity })} />
        <p className={styles.detailLabel}>Tipo (opcional)</p><ChipPicker ariaLabel="Tipo de molestia" options={DISCOMFORT_KIND_OPTIONS} selected={discomfort.kind ? [discomfort.kind] : []} onToggle={(kind) => onDiscomfortChange({ ...discomfort, kind })} />
        <button type="button" className={styles.clear} onClick={() => onDiscomfortChange(null)}>Quitar molestia</button>
      </div>}
    </ScreenLayout>
  );
}
