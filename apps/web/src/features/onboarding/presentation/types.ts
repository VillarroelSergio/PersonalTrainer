import type { OnboardingDraft, PlanProposal } from "@/contracts/onboarding";

// Derivados de OnboardingDraft en vez de redeclarados: si el contrato de Codex
// cambia una unión, este archivo no queda desincronizado en silencio.
export type Goal = OnboardingDraft["goals"][number];
export type Experience = OnboardingDraft["experience"];
export type Weekday = OnboardingDraft["strengthAvailability"][number];
export type EnvironmentKind = OnboardingDraft["environments"][number]["kind"];
export type EquipmentCategory = OnboardingDraft["environments"][number]["equipment"][number];
export type EnduranceKind = NonNullable<OnboardingDraft["enduranceActivities"]>[number]["kind"];
export type MuscleFocus = NonNullable<OnboardingDraft["optionalMuscleFocus"]>[number];
export type DiscomfortZone = NonNullable<OnboardingDraft["discomfort"]>["zone"];
export type DiscomfortSide = NonNullable<NonNullable<OnboardingDraft["discomfort"]>["side"]>;
export type DiscomfortIntensity = NonNullable<OnboardingDraft["discomfort"]>["intensity"];
export type DiscomfortKind = NonNullable<NonNullable<OnboardingDraft["discomfort"]>["kind"]>;
export type CreationMode = OnboardingDraft["creationMode"];
export type Environment = OnboardingDraft["environments"][number];
export type EnduranceActivity = NonNullable<OnboardingDraft["enduranceActivities"]>[number];
export type Discomfort = NonNullable<OnboardingDraft["discomfort"]>;

export type StepId =
  | "mode"
  | "goals"
  | "experience"
  | "birth_date"
  | "height"
  | "weight"
  | "strength_availability"
  | "endurance"
  | "duration"
  | "environment"
  | "equipment"
  | "template"
  | "focus"
  | "discomfort";

export const STEP_ORDER: StepId[] = [
  "mode",
  "goals",
  "experience",
  "birth_date",
  "height",
  "weight",
  "strength_availability",
  "endurance",
  "duration",
  "environment",
  "equipment",
  "template",
  "focus",
  "discomfort"
];

export function visibleStepOrder(mode: CreationMode | null): StepId[] {
  return mode === "guided" ? STEP_ORDER.filter((step) => step !== "template") : STEP_ORDER;
}

export const STEP_LABELS: Record<StepId, string> = {
  mode: "Modo",
  goals: "Objetivos",
  experience: "Experiencia",
  birth_date: "Fecha de nacimiento",
  height: "Altura",
  weight: "Peso",
  strength_availability: "Días de fuerza",
  endurance: "Actividad exterior",
  duration: "Duración",
  environment: "Entorno",
  equipment: "Equipamiento",
  template: "Rutina",
  focus: "Foco muscular",
  discomfort: "Molestias"
};

export type Phase = "form" | "transition" | "proposal";

export type OnboardingFormState = {
  clientOperationId: string;
  baseVersion: number;
  creationMode: CreationMode | null;
  goals: Goal[];
  experience: Experience | null;
  birthDay: number;
  birthMonth: number;
  birthYear: number;
  heightCm: number;
  weightWholeKg: number;
  weightDecimalKg: number;
  strengthAvailability: Weekday[];
  enduranceActivities: EnduranceActivity[];
  sessionDurationMinutes: OnboardingDraft["sessionDurationMinutes"];
  environments: Environment[];
  selectedTemplateId: string | null;
  optionalMuscleFocus: MuscleFocus[];
  discomfort: Discomfort | null;
};

export type OnboardingState = {
  phase: Phase;
  stepIndex: number;
  form: OnboardingFormState;
  proposal: PlanProposal | null;
  ringFinished: boolean;
  submitError: string | null;
  stepSaveError: string | null;
  activating: boolean;
  activationError: string | null;
  activated: boolean;
};
