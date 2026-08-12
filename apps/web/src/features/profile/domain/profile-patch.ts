import { onboardingFormPatchSchema, type OnboardingFormPatch } from "@/contracts/onboarding";

const GOALS = ["muscle_gain", "strength", "fat_loss", "endurance", "active_lifestyle"] as const;
const EQUIPMENT = ["free_weights", "benches_supports", "cables_torso", "leg_machines", "bodyweight_accessories", "indoor_cardio"] as const;
const ENVIRONMENTS = ["full_gym", "basic_gym", "home", "outdoors"] as const;

function numberField(form: FormData, name: string): number | undefined {
  const raw = form.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function selectedValues<T extends readonly string[]>(form: FormData, name: string, allowed: T): T[number][] {
  const allowedSet = new Set<string>(allowed);
  return form.getAll(name).filter((value): value is T[number] => typeof value === "string" && allowedSet.has(value));
}

export function profileFormDataToPatch(form: FormData): OnboardingFormPatch {
  const patch: OnboardingFormPatch = {};
  const goals = selectedValues(form, "goals", GOALS);
  const equipment = selectedValues(form, "equipment", EQUIPMENT);
  const environmentKind = form.get("environmentKind");

  if (goals.length > 0) patch.goals = goals;

  const duration = numberField(form, "sessionDurationMinutes");
  if (duration === 20 || duration === 40 || duration === 60 || duration === 90) patch.sessionDurationMinutes = duration;

  const heightCm = numberField(form, "heightCm");
  if (heightCm !== undefined) patch.heightCm = Math.round(heightCm);

  const weightKg = numberField(form, "weightKg");
  if (weightKg !== undefined) {
    const fixed = Math.round(weightKg * 10);
    patch.weightWholeKg = Math.floor(fixed / 10);
    patch.weightDecimalKg = fixed % 10;
  }

  const birthYear = numberField(form, "birthYear");
  const birthMonth = numberField(form, "birthMonth");
  const birthDay = numberField(form, "birthDay");
  if (birthYear !== undefined) patch.birthYear = Math.round(birthYear);
  if (birthMonth !== undefined) patch.birthMonth = Math.round(birthMonth);
  if (birthDay !== undefined) patch.birthDay = Math.round(birthDay);

  if (typeof environmentKind === "string" && (ENVIRONMENTS as readonly string[]).includes(environmentKind)) {
    patch.environments = [{ kind: environmentKind as (typeof ENVIRONMENTS)[number], equipment }];
  }

  return onboardingFormPatchSchema.parse(patch);
}
