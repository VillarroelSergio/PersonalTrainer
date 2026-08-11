import type { OnboardingDraft } from "@/contracts/onboarding";
import { ENVIRONMENT_COMPATIBLE_EQUIPMENT } from "./constants";
import {
  STEP_ORDER,
  type Discomfort,
  type EnduranceActivity,
  type Environment,
  type EnvironmentKind,
  type EquipmentCategory,
  type Goal,
  type MuscleFocus,
  type OnboardingFormState,
  type OnboardingState,
  type Weekday
} from "./types";

const DEFAULT_BIRTH_YEAR_OFFSET = 30;
const MIN_AGE_YEARS = 12;
const MAX_AGE_YEARS = 100;

export function birthYearBounds(now: Date = new Date()): { min: number; max: number } {
  return { min: now.getFullYear() - MAX_AGE_YEARS, max: now.getFullYear() - MIN_AGE_YEARS };
}

function createClientOperationId(): string {
  return crypto.randomUUID();
}

export function createInitialFormState(now: Date = new Date()): OnboardingFormState {
  return {
    clientOperationId: createClientOperationId(),
    baseVersion: 0,
    creationMode: null,
    goals: [],
    experience: null,
    birthDay: 1,
    birthMonth: 1,
    birthYear: now.getFullYear() - DEFAULT_BIRTH_YEAR_OFFSET,
    heightCm: 170,
    weightWholeKg: 70,
    weightDecimalKg: 0,
    strengthAvailability: [],
    enduranceActivities: [],
    sessionDurationMinutes: 60,
    environments: [],
    optionalMuscleFocus: [],
    discomfort: null
  };
}

export function createInitialState(now: Date = new Date()): OnboardingState {
  return {
    phase: "form",
    stepIndex: 0,
    form: createInitialFormState(now),
    proposal: null,
    ringFinished: false,
    submitError: null,
    stepSaveError: null,
    activating: false,
    activationError: null,
    activated: false
  };
}

export type Action =
  | { type: "SET_MODE"; mode: OnboardingFormState["creationMode"] }
  | { type: "TOGGLE_GOAL"; goal: Goal }
  | { type: "SET_EXPERIENCE"; experience: NonNullable<OnboardingFormState["experience"]> }
  | { type: "SET_BIRTH_DAY"; day: number }
  | { type: "SET_BIRTH_MONTH"; month: number }
  | { type: "SET_BIRTH_YEAR"; year: number }
  | { type: "SET_HEIGHT"; heightCm: number }
  | { type: "SET_WEIGHT_WHOLE"; whole: number }
  | { type: "SET_WEIGHT_DECIMAL"; decimal: number }
  | { type: "TOGGLE_STRENGTH_DAY"; day: Weekday }
  | { type: "UPSERT_ENDURANCE_ACTIVITY"; activity: EnduranceActivity }
  | { type: "REMOVE_ENDURANCE_ACTIVITY"; kind: EnduranceActivity["kind"] }
  | { type: "SET_DURATION"; minutes: OnboardingFormState["sessionDurationMinutes"] }
  | { type: "TOGGLE_ENVIRONMENT"; kind: EnvironmentKind }
  | { type: "TOGGLE_EQUIPMENT"; kind: EnvironmentKind; equipment: EquipmentCategory }
  | { type: "TOGGLE_MUSCLE_FOCUS"; focus: MuscleFocus }
  | { type: "SET_DISCOMFORT"; discomfort: Discomfort | null }
  | { type: "GO_NEXT" }
  | { type: "GO_BACK" }
  | { type: "GO_TO_STEP"; stepIndex: number }
  | { type: "START_TRANSITION" }
  | { type: "PROPOSAL_READY"; proposal: NonNullable<OnboardingState["proposal"]> }
  | { type: "RING_FINISHED" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "RESTART_FROM_FORM" }
  | { type: "HYDRATE"; form: Partial<OnboardingFormState> }
  | { type: "STEP_SAVE_ERROR"; message: string | null }
  | { type: "ACTIVATE_START" }
  | { type: "ACTIVATE_SUCCESS" }
  | { type: "ACTIVATE_ERROR"; message: string };

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function withEnvironmentDefaults(environments: Environment[], kind: EnvironmentKind): Environment[] {
  if (environments.some((env) => env.kind === kind)) return environments.filter((env) => env.kind !== kind);
  return [...environments, { kind, equipment: [...ENVIRONMENT_COMPATIBLE_EQUIPMENT[kind]] }];
}

function toggleEquipment(environments: Environment[], kind: EnvironmentKind, equipment: EquipmentCategory): Environment[] {
  return environments.map((env) => (env.kind === kind ? { ...env, equipment: toggleInArray(env.equipment, equipment) } : env));
}

export function onboardingReducer(state: OnboardingState, action: Action): OnboardingState {
  switch (action.type) {
    case "SET_MODE":
      return { ...state, form: { ...state.form, creationMode: action.mode } };
    case "TOGGLE_GOAL":
      return { ...state, form: { ...state.form, goals: toggleInArray(state.form.goals, action.goal) } };
    case "SET_EXPERIENCE":
      return { ...state, form: { ...state.form, experience: action.experience } };
    case "SET_BIRTH_DAY":
      return { ...state, form: { ...state.form, birthDay: action.day } };
    case "SET_BIRTH_MONTH":
      return { ...state, form: { ...state.form, birthMonth: action.month } };
    case "SET_BIRTH_YEAR":
      return { ...state, form: { ...state.form, birthYear: action.year } };
    case "SET_HEIGHT":
      return { ...state, form: { ...state.form, heightCm: action.heightCm } };
    case "SET_WEIGHT_WHOLE":
      return { ...state, form: { ...state.form, weightWholeKg: action.whole } };
    case "SET_WEIGHT_DECIMAL":
      return { ...state, form: { ...state.form, weightDecimalKg: action.decimal } };
    case "TOGGLE_STRENGTH_DAY":
      return { ...state, form: { ...state.form, strengthAvailability: toggleInArray(state.form.strengthAvailability, action.day) } };
    case "UPSERT_ENDURANCE_ACTIVITY": {
      const withoutKind = state.form.enduranceActivities.filter((activity) => activity.kind !== action.activity.kind);
      return { ...state, form: { ...state.form, enduranceActivities: [...withoutKind, action.activity].slice(0, 3) } };
    }
    case "REMOVE_ENDURANCE_ACTIVITY":
      return { ...state, form: { ...state.form, enduranceActivities: state.form.enduranceActivities.filter((activity) => activity.kind !== action.kind) } };
    case "SET_DURATION":
      return { ...state, form: { ...state.form, sessionDurationMinutes: action.minutes } };
    case "TOGGLE_ENVIRONMENT":
      return { ...state, form: { ...state.form, environments: withEnvironmentDefaults(state.form.environments, action.kind) } };
    case "TOGGLE_EQUIPMENT":
      return { ...state, form: { ...state.form, environments: toggleEquipment(state.form.environments, action.kind, action.equipment) } };
    case "TOGGLE_MUSCLE_FOCUS": {
      const focus = state.form.optionalMuscleFocus;
      if (focus.includes(action.focus)) return { ...state, form: { ...state.form, optionalMuscleFocus: focus.filter((item) => item !== action.focus) } };
      if (focus.length >= 3) return state;
      return { ...state, form: { ...state.form, optionalMuscleFocus: [...focus, action.focus] } };
    }
    case "SET_DISCOMFORT":
      return { ...state, form: { ...state.form, discomfort: action.discomfort } };
    case "GO_NEXT":
      return { ...state, stepIndex: Math.min(STEP_ORDER.length - 1, state.stepIndex + 1) };
    case "GO_BACK":
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1) };
    case "GO_TO_STEP":
      return { ...state, stepIndex: Math.max(0, Math.min(STEP_ORDER.length - 1, action.stepIndex)) };
    case "START_TRANSITION":
      return { ...state, phase: "transition", submitError: null, proposal: null, ringFinished: false };
    case "PROPOSAL_READY": {
      const next = { ...state, proposal: action.proposal };
      return next.ringFinished ? { ...next, phase: "proposal" as const } : next;
    }
    case "RING_FINISHED": {
      // El anillo dura exactamente 5s (RingTransition). Solo pasa a la
      // propuesta cuando ambas condiciones se cumplen: el anillo terminó y
      // la propuesta ya llegó (si llega después, PROPOSAL_READY completa el
      // avance). La fixture resuelve casi al instante, así que en la
      // práctica la propuesta siempre está lista antes que el anillo.
      const next = { ...state, ringFinished: true };
      return next.proposal ? { ...next, phase: "proposal" as const } : next;
    }
    case "SUBMIT_ERROR":
      return { ...state, phase: "form", submitError: action.message };
    case "RESTART_FROM_FORM":
      return { ...state, phase: "form" };
    case "HYDRATE":
      return { ...state, form: { ...state.form, ...action.form } };
    case "STEP_SAVE_ERROR":
      return { ...state, stepSaveError: action.message };
    case "ACTIVATE_START":
      return { ...state, activating: true, activationError: null };
    case "ACTIVATE_SUCCESS":
      return { ...state, activating: false, activated: true };
    case "ACTIVATE_ERROR":
      return { ...state, activating: false, activationError: action.message };
    default:
      return state;
  }
}

export function canAdvance(state: OnboardingState): boolean {
  const { form } = state;
  const step = STEP_ORDER[state.stepIndex];
  switch (step) {
    case "mode":
      return form.creationMode !== null;
    case "goals":
      return form.goals.length > 0;
    case "experience":
      return form.experience !== null;
    case "birth_date":
    case "height":
    case "weight":
      return true;
    case "activity":
      return form.strengthAvailability.length > 0;
    case "duration_environment":
      return form.environments.length > 0;
    case "equipment":
    case "focus_discomfort":
      return true;
    default:
      return false;
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formToDraft(form: OnboardingFormState): OnboardingDraft {
  if (form.creationMode === null || form.experience === null) {
    throw new Error("El formulario no está completo: falta modo o experiencia.");
  }
  return {
    clientOperationId: form.clientOperationId,
    baseVersion: form.baseVersion,
    creationMode: form.creationMode,
    goals: form.goals,
    primaryGoal: form.goals[0],
    experience: form.experience,
    birthDate: `${form.birthYear}-${pad2(form.birthMonth)}-${pad2(form.birthDay)}`,
    heightCm: form.heightCm,
    weightKg: Math.round((form.weightWholeKg + form.weightDecimalKg / 10) * 10) / 10,
    strengthAvailability: form.strengthAvailability,
    enduranceActivities: form.enduranceActivities,
    sessionDurationMinutes: form.sessionDurationMinutes,
    environments: form.environments,
    optionalMuscleFocus: form.optionalMuscleFocus.length > 0 ? form.optionalMuscleFocus : undefined,
    discomfort: form.discomfort ?? undefined
  };
}
