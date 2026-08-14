import type { OnboardingDraft, PlanProposal } from "@/contracts/onboarding";
import type { OnboardingFormState, StepId } from "./types";

// Puerto que Codex sustituye por persistencia/API real (ver
// docs/CLAUDE-ONBOARDING-ALIGNMENT-NOTES.md). Los métodos opcionales quedan
// sin implementar en la fixture: sin ellos, OnboardingFlow simplemente no
// hidrata, no guarda paso a paso ni activa nada (todo local, como antes).
export interface OnboardingDataSource {
  submit(draft: OnboardingDraft): Promise<PlanProposal>;
  loadInitialDraft?(): Promise<Partial<OnboardingFormState> | null>;
  saveStep?(form: OnboardingFormState, step: StepId): Promise<void>;
  activate?(proposal: PlanProposal): Promise<void>;
}

const WEEKDAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

// Fuente real usada en producción: llama a los endpoints /api/v1/onboarding/draft
// y /api/v1/plan-proposals con la sesión de cookies del navegador.
export class RealOnboardingDataSource implements OnboardingDataSource {
  async submit(draft: OnboardingDraft): Promise<PlanProposal> {
    const response = await fetch("/api/v1/plan-proposals", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", "idempotency-key": draft.clientOperationId },
      body: JSON.stringify(draft)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message ?? "No pudimos preparar tu plan.");
    return body.data as PlanProposal;
  }

  async loadInitialDraft(): Promise<Partial<OnboardingFormState> | null> {
    const response = await fetch("/api/v1/onboarding/draft", { credentials: "same-origin" });
    if (!response.ok) return null;
    const body = await response.json();
    return (body.data as Partial<OnboardingFormState> | null) ?? null;
  }

  async saveStep(form: OnboardingFormState, step: StepId): Promise<void> {
    const response = await fetch("/api/v1/onboarding/draft", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(formStepPatch(form, step))
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message ?? "No pudimos guardar este paso.");
    }
  }

  async activate(proposal: PlanProposal): Promise<void> {
    const response = await fetch("/api/v1/plans/activate", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proposalId: proposal.proposalId })
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message ?? "No pudimos activar tu plan.");
    }
  }
}

/**
 * Only persist the fields completed on the current screen. Sending the entire
 * form would include future empty arrays (for example `environments: []`),
 * which correctly fail the patch contract and turn every early step into 400.
 */
export function formStepPatch(form: OnboardingFormState, step: StepId) {
  switch (step) {
    case "mode": return { creationMode: form.creationMode };
    case "goals": return { goals: form.goals };
    case "experience": return { experience: form.experience };
    case "birth_date": return { birthDay: form.birthDay, birthMonth: form.birthMonth, birthYear: form.birthYear };
    case "height": return { heightCm: form.heightCm };
    case "weight": return { weightWholeKg: form.weightWholeKg, weightDecimalKg: form.weightDecimalKg };
    case "strength_availability": return { strengthAvailability: form.strengthAvailability };
    case "endurance": return { enduranceActivities: form.enduranceActivities };
    case "duration": return { sessionDurationMinutes: form.sessionDurationMinutes };
    case "environment":
    case "equipment": return { environments: form.environments };
    case "focus": return { optionalMuscleFocus: form.optionalMuscleFocus };
    case "discomfort": return { discomfort: form.discomfort };
  }
}

// Fixture local para pruebas y para el flujo aislado del prototipo; ya no se
// usa como valor por defecto en producción (ver RealOnboardingDataSource).
export class FixtureOnboardingDataSource implements OnboardingDataSource {
  async submit(draft: OnboardingDraft): Promise<PlanProposal> {
    const strengthDays = [...draft.strengthAvailability].sort(
      (a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b)
    );
    const strengthSessions = strengthDays.map((day) => ({
      day,
      kind: "strength" as const,
      title: draft.primaryGoal === "strength" ? "Fuerza de base" : "Fuerza general",
      estimatedMinutes: draft.sessionDurationMinutes
    }));
    const enduranceSessions = draft.enduranceActivities.flatMap((activity) =>
      Array.from({ length: activity.sessionsPerWeek }, (_, index) => ({
        day: strengthDays[(strengthDays.length + index) % 7] ?? WEEKDAY_ORDER[index % 7],
        kind: "endurance" as const,
        title: activity.kind === "running" ? "Carrera suave" : activity.kind === "cycling" ? "Ciclismo suave" : "Caminata",
        estimatedMinutes: Math.min(draft.sessionDurationMinutes, 40)
      }))
    );

    return {
      proposalId: crypto.randomUUID(),
      ruleVersion: "plan-proposal-v1",
      reasons: [
        { code: "primary_goal", message: `Prioriza ${draft.primaryGoal} porque fue tu primer objetivo elegido.` },
        { code: "availability", message: `Distribuye fuerza en ${strengthDays.length} día(s) según tu disponibilidad.` }
      ],
      alternatives: [{ code: "shorter_sessions", message: "Puedes acortar cada sesión si el tiempo disponible cambia." }],
      initialBlock: { name: "Bloque inicial", purpose: "Adaptación y técnica", weeks: 4 },
      week: { sessions: [...strengthSessions, ...enduranceSessions] }
    };
  }
}
