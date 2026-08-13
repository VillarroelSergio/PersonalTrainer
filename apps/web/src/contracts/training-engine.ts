import { z } from "zod";
import { discomfortSchema, weekdaySchema } from "./onboarding";

export const checkinInputSchema = z.object({
  energy: z.enum(["low", "normal", "high"]).nullable().optional(),
  motivation: z.enum(["low", "normal", "high"]).nullable().optional(),
  timeAvailableMinutes: z.union([z.literal(20), z.literal(40), z.literal(60), z.literal(90)]).nullable().optional(),
  /** Not a specific missing item, only "I don't have my usual equipment today" for the planned session. */
  equipmentUnavailable: z.boolean().optional(),
  discomfort: discomfortSchema.nullable().optional()
});
export type CheckinInput = z.infer<typeof checkinInputSchema>;
export type Checkin = CheckinInput & { ownerId: string; checkinDate: string };

export const recommendationConfidenceSchema = z.enum(["none", "low", "medium", "high"]);
export type RecommendationConfidence = z.infer<typeof recommendationConfidenceSchema>;

export type RecommendationOp =
  | { op: "remove_exercise"; position: number }
  | { op: "reduce_sets"; position: number; by: number }
  | { op: "replace_variant"; position: number; toVariantId: string }
  | { op: "add_rest_seconds"; seconds: number }
  | { op: "convert_recovery" }
  | { op: "reschedule"; targetDay: z.infer<typeof weekdaySchema> };

export type RecommendationChange = {
  code: string;
  kind: "reduce_time" | "equipment_substitution" | "recovery" | "reschedule" | "keep_planned";
  description: string;
  ops: RecommendationOp[];
};

/** Real, confirmed endurance activity (imported or manually logged) used as evidence for a recommendation. Only fields the source activity actually has — never a fabricated pace/HR/power/load. */
export type ExternalActivityEvidence = {
  sport: string;
  startedAt: string;
  hoursAgo: number;
  durationS: number | null;
  distanceM: number | null;
};

export type RecommendationDecisionStatus = "pending" | "applied" | "kept" | "rejected";

export type Recommendation = {
  recommendationId: string;
  ruleVersion: "training-engine-v1";
  confidence: RecommendationConfidence;
  decisionRequired: boolean;
  reasonCodes: string[];
  humanReason: string;
  /** Candidates only — none of these are applied until the person decides. */
  changes: RecommendationChange[];
  alternatives: string[];
  missingData: string[];
  importantDiscomfort: boolean;
  sessionIndex: number | null;
  /** Real recent endurance activity this recommendation actually factored in, or null when none was available/comparable (Bloqueante 2). */
  externalEvidence: ExternalActivityEvidence | null;
  decision: { status: RecommendationDecisionStatus; decidedChangeCode: string | null; decidedAt: string | null };
};

export const decideRecommendationSchema = z.object({
  recommendationId: z.string().min(1),
  decision: z.enum(["apply", "keep", "reject"]),
  /** Required when decision is "apply": which candidate in `changes[].code` to apply. */
  changeCode: z.string().optional()
});
export type DecideRecommendationInput = z.infer<typeof decideRecommendationSchema>;
