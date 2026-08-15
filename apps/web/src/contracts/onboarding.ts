import { z } from "zod";
import type { TrainingBlock } from "@/features/catalog/domain/training-block";

export const goalSchema = z.enum(["muscle_gain", "strength", "fat_loss", "endurance", "active_lifestyle"]);
export const weekdaySchema = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
export const equipmentCategorySchema = z.enum([
  "free_weights",
  "benches_supports",
  "cables_torso",
  "leg_machines",
  "bodyweight_accessories",
  "indoor_cardio",
  "racks_smith",
  "pullup_dip_station",
  "resistance_bands"
]);
export const discomfortSchema = z.object({ zone: z.enum(["neck", "shoulder", "back", "elbow", "wrist", "hip", "knee", "ankle"]), side: z.enum(["left", "right", "center"]).optional(), intensity: z.enum(["mild", "moderate", "important"]), kind: z.enum(["pain", "stiffness", "fatigue"]).optional() });
export const sessionAddOnsSchema = z.object({
  warmup: z.boolean(),
  cooldown: z.boolean(),
  warmupRoutineId: z.string().min(1),
  cooldownRoutineId: z.string().min(1)
});

export const onboardingDraftSchema = z.object({
  clientOperationId: z.string().uuid(),
  baseVersion: z.number().int().nonnegative(),
  creationMode: z.enum(["guided", "self_directed"]),
  selectedTemplateId: z.string().min(1).optional(),
  goals: z.array(goalSchema).min(1).max(5),
  primaryGoal: goalSchema,
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  birthDate: z.string().date(),
  heightCm: z.number().int().min(100).max(250),
  weightKg: z.number().positive().max(400),
  strengthAvailability: z.array(weekdaySchema).min(1).max(7).refine((days) => new Set(days).size === days.length, "Each day can be selected only once."),
  enduranceActivities: z.array(z.object({ kind: z.enum(["running", "cycling", "walking"]), sessionsPerWeek: z.number().int().min(1).max(7) })).max(3),
  sessionDurationMinutes: z.union([z.literal(20), z.literal(40), z.literal(60), z.literal(90)]),
  environments: z.array(z.object({ kind: z.enum(["full_gym", "basic_gym", "home", "outdoors"]), equipment: z.array(equipmentCategorySchema) })).length(1),
  sessionAddOns: sessionAddOnsSchema.optional(),
  optionalMuscleFocus: z.array(z.enum(["upper_body", "lower_body", "push", "pull", "full_body"])).max(3).optional(),
  discomfort: discomfortSchema.optional()
}).superRefine((draft, context) => {
  if (!draft.goals.includes(draft.primaryGoal)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["primaryGoal"], message: "primaryGoal must be one of goals." });
});

export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type SessionAddOns = z.infer<typeof sessionAddOnsSchema>;

export type PlanProposal = {
  proposalId: string;
  ruleVersion: "plan-proposal-v1";
  /** 0-1, conservative estimate of how well-supported this proposal is by the declared data. */
  confidence?: number;
  /** Declared inputs the rule engine had to assume conservative defaults for. */
  missingData?: string[];
  reasons: Array<{ code: string; message: string }>;
  alternatives: Array<{ code: string; message: string }>;
  initialBlock: { name: string; purpose: string; weeks: number };
  week: {
    sessions: Array<{
      day: z.infer<typeof weekdaySchema>;
      kind: "strength" | "endurance";
      title: string;
      estimatedMinutes: number;
      /** Only present for kind "strength"; empty when no compatible variant exists for the declared equipment. */
      exercises?: Array<{ variantId: string; targetSets: number; targetRepsMin: number; targetRepsMax: number }>;
      /** Optional warmup/mobility/cooldown blocks; never a source of strength progression (see `contributesToStrengthProgression`). */
      blocks?: TrainingBlock[];
    }>;
  };
};

// Persistencia incremental del formulario de onboarding (paso a paso, antes
// del envío final). Todos los campos son opcionales: cada PUT solo manda el
// parche del paso actual y el backend hace merge sobre el borrador existente.
export const onboardingFormPatchSchema = z.object({
  creationMode: z.enum(["guided", "self_directed"]).nullable().optional(),
  goals: z.array(goalSchema).max(5).optional(),
  experience: z.enum(["beginner", "intermediate", "advanced"]).nullable().optional(),
  birthDay: z.number().int().min(1).max(31).optional(),
  birthMonth: z.number().int().min(1).max(12).optional(),
  birthYear: z.number().int().min(1900).max(2100).optional(),
  heightCm: z.number().int().min(100).max(250).optional(),
  weightWholeKg: z.number().int().min(0).max(400).optional(),
  weightDecimalKg: z.number().int().min(0).max(9).optional(),
  strengthAvailability: z.array(weekdaySchema).max(7).optional(),
  enduranceActivities: z.array(z.object({ kind: z.enum(["running", "cycling", "walking"]), sessionsPerWeek: z.number().int().min(1).max(7) })).max(3).optional(),
  sessionDurationMinutes: z.union([z.literal(20), z.literal(40), z.literal(60), z.literal(90)]).optional(),
  sessionAddOns: sessionAddOnsSchema.optional(),
  environments: z.array(z.object({ kind: z.enum(["full_gym", "basic_gym", "home", "outdoors"]), equipment: z.array(equipmentCategorySchema) })).length(1).optional(),
  selectedTemplateId: z.string().min(1).nullable().optional(),
  optionalMuscleFocus: z.array(z.enum(["upper_body", "lower_body", "push", "pull", "full_body"])).max(3).optional(),
  discomfort: discomfortSchema.nullable().optional()
});

export type OnboardingFormPatch = z.infer<typeof onboardingFormPatchSchema>;
