"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  DISCOMFORT_INTENSITY_OPTIONS,
  DISCOMFORT_KIND_OPTIONS,
  DISCOMFORT_SIDE_OPTIONS,
  DISCOMFORT_ZONE_OPTIONS
} from "@/features/onboarding/presentation/constants";
import type { Discomfort, DiscomfortZone } from "@/features/onboarding/presentation/types";
import bodyMapStyles from "@/features/onboarding/ui/screens/FocusDiscomfortScreen.module.css";
import { isBodyMapVisible, resolveDiscomfortForSubmit, MOLESTIA_OPTIONS, type MolestiaLevel } from "@/features/training-engine/domain/checkin-discomfort";
import { decideOffline, submitCheckinOffline } from "@/features/training-engine/domain/checkin-offline";
import { createClientId } from "@/lib/client-id";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { useOfflineSyncContext } from "@/lib/offline/OfflineSyncContext";
import { isoWeekStart } from "@/lib/weekdays";
import type { RecommendationOp } from "@/contracts/training-engine";
import type { PlanProposal } from "@/contracts/onboarding";

type Energy = "low" | "normal" | "high";
type TimeOption = 20 | 40 | 60 | 90;

type RecommendationChange = { code: string; kind: string; description: string; ops: RecommendationOp[] };
type Recommendation = {
  recommendationId: string;
  humanReason: string;
  changes: RecommendationChange[];
  alternatives: string[];
  importantDiscomfort: boolean;
  decisionRequired: boolean;
  sessionIndex: number | null;
};

const SAFETY_TEXT = "Esto no es un diagnóstico. Si la molestia persiste o es intensa, considera detener o adaptar la sesión y consultar a un profesional de salud.";

// Recurso aprobado (docs/PROTOTYPE-PARITY-MOBILE.md): mismo asset que prototype/assets/body-map/.
// La imagen combina vista frontal y trasera; .bodymap-crop recorta la mitad frontal (ver app.css).
const BODY_MAP_IMG = "/library/body-map/body-map-front-back-v1.webp";
const BODY_MAP_ALT = "Mapa corporal frontal con zonas amplias para registrar una molestia.";

export function CheckinRunner() {
  const router = useRouter();
  const [energy, setEnergy] = useState<Energy | null>(null);
  const [motivation, setMotivation] = useState<Energy | null>(null);
  const [timeAvailableMinutes, setTimeAvailableMinutes] = useState<TimeOption | null>(null);
  const [molestiaLevel, setMolestiaLevel] = useState<MolestiaLevel>("none");
  const [discomfort, setDiscomfort] = useState<Discomfort | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const offlineData = useOfflineData();
  const sync = useOfflineSyncContext();

  function selectZone(zone: DiscomfortZone) {
    if (discomfort?.zone === zone) { setDiscomfort(null); return; }
    setDiscomfort({ zone, intensity: molestiaLevel === "none" ? "mild" : molestiaLevel });
  }

  function changeMolestiaLevel(level: MolestiaLevel) {
    setMolestiaLevel(level);
    if (level === "none") setDiscomfort(null);
  }

  async function reviewProposal() {
    setSubmitting(true);
    setError(null);
    const submittedDiscomfort = resolveDiscomfortForSubmit(molestiaLevel, discomfort);
    const payload = { energy, motivation, timeAvailableMinutes, equipmentUnavailable: false, discomfort: submittedDiscomfort };
    try {
      const response = await fetch("/api/v1/checkins", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "No pudimos revisar tu check-in.");
      setRecommendation(body.data);
    } catch (cause) {
      // No coverage: offline there is no server-side plan/adaptation logic to compute a
      // recommendation from, so the check-in queues as-is and today's session stays as planned —
      // the person still trains, and the outbox reconciles the real recommendation once online.
      if (offlineData.snapshot) {
        const result = submitCheckinOffline(offlineData.snapshot, payload, createClientId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
        router.push("/hoy");
      } else {
        setError(cause instanceof Error ? cause.message : "No pudimos revisar tu check-in.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(decision: "apply" | "keep" | "reject", changeCode?: string) {
    if (!recommendation) return;
    setDeciding(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/recommendations/decision", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recommendationId: recommendation.recommendationId, decision, changeCode })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "No pudimos guardar tu decisión.");
      router.push("/hoy");
    } catch (cause) {
      if (offlineData.snapshot) {
        const activePlan = offlineData.snapshot.data.activePlan as { id: string; contentJson: string } | null;
        const sessionIndex = recommendation.sessionIndex;
        const originDay = activePlan != null && sessionIndex != null
          ? (JSON.parse(activePlan.contentJson) as PlanProposal).week?.sessions?.[sessionIndex]?.day ?? null
          : null;
        const result = decideOffline(
          offlineData.snapshot,
          {
            recommendationId: recommendation.recommendationId,
            decision,
            changeCode,
            changes: recommendation.changes,
            planId: activePlan?.id ?? null,
            isoWeekStart: isoWeekStart(),
            originDay,
            sessionIndex
          },
          createClientId
        );
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
        router.push("/hoy");
        return;
      }
      setError(cause instanceof Error ? cause.message : "No pudimos guardar tu decisión.");
      setDeciding(false);
    }
  }

  if (recommendation) {
    const proposedChanges = recommendation.changes.filter((change) => change.code !== "KEEP_PLANNED");
    return (
      <section className="view-checkin">
        <p className="kicker">Propuesta para hoy</p>
        <h1 className="view-title">Alternativas explicadas</h1>
        {error && <p className="notice notice--warn" role="alert">{error}</p>}

        <div className="proposal">
          <p className="proposal__reason">{recommendation.humanReason}</p>
          {proposedChanges.length > 0 ? (
            <ul className="changes">
              {proposedChanges.map((change) => (
                <li key={change.code}>
                  <p>{change.description}</p>
                  <button type="button" className="chip" disabled={deciding} onClick={() => decide("apply", change.code)}>Aplicar esta opción</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lede small">No se detectan ajustes necesarios: puedes mantener la sesión tal como está.</p>
          )}
        </div>

        {recommendation.importantDiscomfort && <p className="notice notice--warn">{SAFETY_TEXT}</p>}

        <button type="button" className="btn btn--ghost btn--block" disabled={deciding} onClick={() => decide("keep")}>Mantener sesión prevista</button>
        <button type="button" className="btn btn--quiet" disabled={deciding} onClick={() => setRecommendation(null)}>Editar check-in</button>
        <button type="button" className="btn btn--quiet" disabled={deciding} onClick={() => decide("reject")}>Descartar propuesta</button>
      </section>
    );
  }

  return (
    <section className="view-checkin">
      <h1 className="view-title">¿Cómo llegas hoy?</h1>
      <p className="lede small">Responde en segundos, es opcional.</p>
      {error && <p className="notice notice--warn" role="alert">{error}</p>}

      <PickerField label="Energía" options={["low", "normal", "high"] as Energy[]} labels={{ low: "Baja", normal: "Normal", high: "Alta" }} value={energy} onChange={setEnergy} />
      <PickerField label="Motivación" options={["low", "normal", "high"] as Energy[]} labels={{ low: "Baja", normal: "Normal", high: "Alta" }} value={motivation} onChange={setMotivation} />
      <PickerField
        label="Tiempo disponible"
        options={[20, 40, 60, 90] as TimeOption[]}
        labels={{ 20: "20 min", 40: "40 min", 60: "60 min", 90: "90 min" } as Record<TimeOption, string>}
        value={timeAvailableMinutes}
        onChange={setTimeAvailableMinutes}
      />

      <div className="field">
        <p className="field__label">Molestias (opcional)</p>
        <div className="picker picker--wide" role="group" aria-label="Molestias">
          {MOLESTIA_OPTIONS.map((option) => (
            <button key={option.value} type="button" className="picker__btn" aria-pressed={molestiaLevel === option.value} onClick={() => changeMolestiaLevel(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isBodyMapVisible(molestiaLevel) && (
        <div className="field">
          <p className="lede small">
            Información orientativa de bienestar, no un diagnóstico: no identifica lesiones ni garantiza la recuperación. Sirve para explicar el ajuste de la sesión de hoy.
          </p>
          <p className="field__label">¿En qué zona amplia lo notas?</p>
          <div className="bodymap-crop" role="group" aria-label="Mapa corporal de zonas amplias">
            <Image className="bodymap-img" src={BODY_MAP_IMG} alt={BODY_MAP_ALT} width={640} height={800} priority={false} />
            {DISCOMFORT_ZONE_OPTIONS.map((zone) => (
              <button
                key={zone.value}
                type="button"
                className="zone"
                style={{ top: `${zone.top}%`, left: `${zone.left}%` }}
                aria-pressed={discomfort?.zone === zone.value}
                onClick={() => selectZone(zone.value)}
              >
                {zone.label}
              </button>
            ))}
          </div>

          {discomfort && (
            <div className={bodyMapStyles.detail}>
              <ChipRow label="Lado" options={DISCOMFORT_SIDE_OPTIONS} selected={discomfort.side} onSelect={(side) => setDiscomfort({ ...discomfort, side })} />
              <ChipRow label="Intensidad" options={DISCOMFORT_INTENSITY_OPTIONS} selected={discomfort.intensity} onSelect={(intensity) => setDiscomfort({ ...discomfort, intensity })} />
              <ChipRow label="Tipo" options={DISCOMFORT_KIND_OPTIONS} selected={discomfort.kind} onSelect={(kind) => setDiscomfort({ ...discomfort, kind })} />
              {discomfort.intensity === "important" && <p className="notice notice--warn">{SAFETY_TEXT}</p>}
            </div>
          )}
        </div>
      )}

      <div className="checkin-cta">
        <button type="button" className="btn btn--primary btn--block" disabled={submitting} onClick={reviewProposal}>
          {submitting ? "Revisando…" : "Revisar propuesta"}
        </button>
      </div>
    </section>
  );
}

function PickerField<T extends string | number>({ label, options, labels, value, onChange }: { label: string; options: T[]; labels: Record<string, string>; value: T | null; onChange: (value: T | null) => void }) {
  return (
    <div className="field">
      <p className="field__label">{label} (opcional)</p>
      <div className="picker picker--wide picker--compact" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option} type="button" className="picker__btn" aria-pressed={value === option} onClick={() => onChange(value === option ? null : option)}>
            {labels[String(option)]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipRow<T extends string>({ label, options, selected, onSelect }: { label: string; options: Array<{ value: T; label: string }>; selected: T | undefined; onSelect: (value: T) => void }) {
  return (
    <>
      <p className={bodyMapStyles.detailLabel}>{label} (opcional)</p>
      <div className="picker" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option.value} type="button" className="picker__btn" aria-pressed={selected === option.value} onClick={() => onSelect(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </>
  );
}
