import { findVariant } from "@/features/catalog/data/exercise-catalog";
import { EXERCISE_CATALOG } from "@/features/catalog/data/exercise-catalog";
import { neighborWeekdays, WEEKDAYS, type Weekday } from "@/lib/weekdays";
import type { CheckinInput, ExternalActivityEvidence, Recommendation, RecommendationChange, RecommendationConfidence, RecommendationOp } from "@/contracts/training-engine";
import type { PlanProposal } from "@/contracts/onboarding";

export const RULE_VERSION = "training-engine-v1" as const;
const LONG_OR_INTENSE_ENDURANCE_MINUTES = 40;

type PlannedSession = PlanProposal["week"]["sessions"][number];

export type EvaluatedRecommendation = Omit<Recommendation, "recommendationId" | "decision">;

/**
 * Pure rule engine (docs/TRAINING-DECISION-ENGINE-DESIGN.md §6-10): turns a
 * declared check-in plus the active plan into explainable candidates. Never
 * mutates the plan; the caller decides whether/what to apply.
 */
export function evaluateCheckin(checkin: CheckinInput, today: Weekday, proposal: PlanProposal, externalEvidence: ExternalActivityEvidence | null = null): EvaluatedRecommendation {
  const sessions = proposal.week?.sessions ?? [];
  const sessionIndex = sessions.findIndex((session) => session.day === today);
  const session = sessionIndex >= 0 ? sessions[sessionIndex] : null;

  const missingData: string[] = [];
  if (checkin.energy == null) missingData.push("energy");
  if (checkin.motivation == null) missingData.push("motivation");
  if (checkin.timeAvailableMinutes == null) missingData.push("timeAvailableMinutes");
  if (externalEvidence && externalEvidence.durationS == null) missingData.push("externalActivityDuration");
  const declaredCount = (checkin.energy != null ? 1 : 0) + (checkin.motivation != null ? 1 : 0) + (checkin.timeAvailableMinutes != null ? 1 : 0) + (checkin.discomfort ? 1 : 0) + (externalEvidence ? 1 : 0);
  const confidence: RecommendationConfidence = declaredCount === 0 ? "none" : declaredCount === 1 ? "low" : declaredCount <= 3 ? "medium" : "high";

  const importantDiscomfort = checkin.discomfort?.intensity === "important";

  if (!session) {
    return {
      ruleVersion: RULE_VERSION,
      confidence,
      decisionRequired: false,
      reasonCodes: ["NO_SESSION_TODAY"],
      humanReason: "No hay ninguna sesión prevista hoy, así que no hay nada que adaptar.",
      changes: [keepPlannedChange()],
      alternatives: [],
      missingData,
      importantDiscomfort,
      sessionIndex: null,
      externalEvidence
    };
  }

  const changes: RecommendationChange[] = [];
  const reasonCodes: string[] = [];
  const reasonParts: string[] = [];

  if (session.kind === "strength" && checkin.timeAvailableMinutes != null && checkin.timeAvailableMinutes < session.estimatedMinutes && (session.exercises?.length ?? 0) > 1) {
    const exercises = session.exercises!;
    const lastPosition = exercises.length - 1;
    const dropped = findVariant(exercises[lastPosition].variantId);
    changes.push({
      code: "TIME_CONSTRAINT",
      kind: "reduce_time",
      description: `Se retira ${dropped?.exerciseName.toLowerCase() ?? "el último ejercicio"} para ajustarse a ${checkin.timeAvailableMinutes} min. Conservamos los patrones prioritarios; solo afecta a hoy.`,
      ops: [{ op: "remove_exercise", position: lastPosition }]
    });
    reasonCodes.push("TIME_CONSTRAINT");
    reasonParts.push(`${checkin.timeAvailableMinutes} min disponibles`);
  }

  if (session.kind === "strength" && checkin.equipmentUnavailable && (session.exercises?.length ?? 0) > 0) {
    const ops: RecommendationOp[] = [];
    for (let position = 0; position < session.exercises!.length; position += 1) {
      const current = findVariant(session.exercises![position].variantId);
      if (!current) continue;
      const alternative = EXERCISE_CATALOG.find(
        (candidate) => candidate.movementPattern === current.movementPattern && candidate.id !== current.id && candidate.loadType === "bodyweight"
      );
      if (alternative) ops.push({ op: "replace_variant", position, toVariantId: alternative.id });
    }
    if (ops.length > 0) {
      changes.push({
        code: "EQUIPMENT_UNAVAILABLE",
        kind: "equipment_substitution",
        description: "Cambia a variantes con peso corporal para mantener el mismo estímulo sin el equipo habitual. Puedes volver a cambiarlas cuando quieras.",
        ops
      });
      reasonCodes.push("EQUIPMENT_UNAVAILABLE");
      reasonParts.push("sin tu equipo habitual");
    }
  }

  const lowEnergy = checkin.energy === "low";
  const lowMotivation = checkin.motivation === "low";
  if (lowEnergy || lowMotivation) {
    changes.push({
      code: lowEnergy ? "LOW_ENERGY" : "LOW_MOTIVATION",
      kind: "recovery",
      description: "Cambia hoy a una versión de recuperación más suave. Vuelve a tu plan normal en la próxima sesión prevista.",
      ops: [{ op: "convert_recovery" }]
    });
    reasonCodes.push(lowEnergy ? "LOW_ENERGY" : "LOW_MOTIVATION");
    if (lowEnergy) reasonParts.push("energía baja");
    if (lowMotivation) reasonParts.push("motivación baja");
  }

  if (importantDiscomfort) {
    changes.push({
      code: "IMPORTANT_DISCOMFORT",
      kind: "recovery",
      description: "Detén o adapta la sesión de hoy. Esto no es un diagnóstico: si la molestia persiste o es intensa, consulta a un profesional de salud.",
      ops: [{ op: "convert_recovery" }]
    });
    reasonCodes.push("IMPORTANT_DISCOMFORT");
    reasonParts.push(`molestia importante${checkin.discomfort?.zone ? ` en ${checkin.discomfort.zone}` : ""}`);
  }

  if (session.kind === "strength" && isLegsHeavy(session)) {
    const proximateEndurance = neighborWeekdays(today)
      .map((day) => sessions.find((candidate) => candidate.day === day && candidate.kind === "endurance"))
      .find((candidate) => candidate && candidate.estimatedMinutes >= LONG_OR_INTENSE_ENDURANCE_MINUTES);
    if (proximateEndurance) {
      const targetDay = findFreeWeekday(sessions, today);
      changes.push({
        code: "LOWER_BODY_PROXIMITY",
        kind: targetDay ? "reschedule" : "keep_planned",
        description: targetDay
          ? `Tu sesión de piernas queda cerca de ${proximateEndurance.title.toLowerCase()}. Puedes moverla a ${targetDay}, sin cambiar el resto de la semana.`
          : `Tu sesión de piernas queda cerca de ${proximateEndurance.title.toLowerCase()}, pero no hay un día libre esta semana para moverla.`,
        ops: targetDay ? [{ op: "reschedule", targetDay }] : []
      });
      reasonCodes.push("LOWER_BODY_PROXIMITY");
      reasonParts.push("piernas exigentes cerca de resistencia intensa");
    }
  }

  // Bloqueante 2: a confirmed real activity (imported or manually logged), never a planned one,
  // is comparable evidence too — same legs/long-or-intense criteria as LOWER_BODY_PROXIMITY above,
  // but sourced from what actually happened rather than what the plan says. Never invents pace/HR/
  // power/load: only sport/duration/distance the activity itself carries are read (externalEvidence
  // comes pre-built by the repository from a real endurance_activity row).
  let externalEvidenceNote: string | null = null;
  if (externalEvidence) {
    const durationLabel = externalEvidence.durationS != null ? `${Math.round(externalEvidence.durationS / 60)} min` : "sin duración registrada";
    const sportLabel = SPORT_LABEL[externalEvidence.sport] ?? externalEvidence.sport;
    const whenLabel = externalEvidence.hoursAgo <= 30 ? "ayer" : "hace poco";

    const isRecentAndSubstantial = externalEvidence.durationS != null && externalEvidence.durationS / 60 >= LONG_OR_INTENSE_ENDURANCE_MINUTES;
    if (session.kind === "strength" && isLegsHeavy(session) && isRecentAndSubstantial) {
      const targetDay = findFreeWeekday(sessions, today);
      changes.push({
        code: "EXTERNAL_LEGS_PROXIMITY",
        kind: targetDay ? "reschedule" : "keep_planned",
        description: targetDay
          ? `Registraste ${sportLabel} de ${durationLabel} ${whenLabel}. Para no acumular sobre piernas, puedes moverla a ${targetDay}.`
          : `Registraste ${sportLabel} de ${durationLabel} ${whenLabel}. No hay un día libre esta semana para moverla; puedes mantenerla o hacerla más suave.`,
        ops: targetDay ? [{ op: "reschedule", targetDay }] : []
      });
      reasonCodes.push("EXTERNAL_LEGS_PROXIMITY");
      reasonParts.push(`${sportLabel} de ${durationLabel} ${whenLabel}, evitamos sumar más intensidad en piernas hoy`);
    } else {
      // Informational only: the evidence didn't trigger an alternative, but it's still surfaced
      // ("mantenemos piernas hoy") instead of silently ignored.
      externalEvidenceNote = `Registraste ${sportLabel} de ${durationLabel} ${whenLabel}; mantenemos la sesión de hoy tal como está.`;
    }
  }

  changes.push(keepPlannedChange());

  const alternatives = changes.filter((change) => change.code !== "KEEP_PLANNED").map((change) => change.description);
  const baseReason = reasonParts.length > 0 ? `Motivo: indicaste ${reasonParts.join(", ")}.` : "Sin señales declaradas hoy: puedes mantener la sesión tal como está.";
  const humanReason = externalEvidenceNote ? `${baseReason} ${externalEvidenceNote}` : baseReason;

  return {
    ruleVersion: RULE_VERSION,
    confidence,
    decisionRequired: changes.length > 1,
    reasonCodes,
    humanReason,
    changes,
    alternatives,
    missingData,
    importantDiscomfort,
    sessionIndex,
    externalEvidence
  };
}

const SPORT_LABEL: Record<string, string> = { running: "una carrera", cycling: "una salida en bici", walking: "una caminata", other: "una actividad" };

function keepPlannedChange(): RecommendationChange {
  return { code: "KEEP_PLANNED", kind: "keep_planned", description: "Mantener la sesión prevista sin cambios.", ops: [] };
}

function isLegsHeavy(session: PlannedSession): boolean {
  const exercises = session.exercises ?? [];
  if (exercises.length === 0) return false;
  return exercises.every((exercise) => {
    const variant = findVariant(exercise.variantId);
    return variant && (variant.movementPattern === "squat" || variant.movementPattern === "hinge" || variant.movementPattern === "lunge");
  });
}

/** First rest day within the week (no planned session), searching outward from `today`. */
function findFreeWeekday(sessions: PlannedSession[], today: Weekday): Weekday | null {
  const occupied = new Set(sessions.map((session) => session.day));
  const todayIndex = WEEKDAYS.indexOf(today);
  for (let offset = 1; offset <= 6; offset += 1) {
    const candidate = WEEKDAYS[(todayIndex + offset) % 7];
    if (!occupied.has(candidate)) return candidate;
  }
  return null;
}
