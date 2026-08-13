import { z } from "zod";

export const enduranceObjectiveSchema = z.enum(["base", "intervals", "sprints", "long_run", "recovery", "bike", "walk"]);
export type EnduranceObjective = z.infer<typeof enduranceObjectiveSchema>;

export const enduranceEnvironmentSchema = z.enum(["outdoors", "treadmill", "stationary_bike", "home"]);
export type EnduranceEnvironment = z.infer<typeof enduranceEnvironmentSchema>;

/** Free-text optional layers (distance, pace, RPE, incline, HR zone...). Never validated as numbers and never required — same rule as the prototype's OPTIONAL_FIELDS. */
export const enduranceDesignInputSchema = z.object({
  isoWeekStart: z.string().date(),
  sessionIndex: z.number().int().nonnegative(),
  objective: enduranceObjectiveSchema,
  environment: enduranceEnvironmentSchema.optional(),
  optionalLayers: z.record(z.string(), z.string()).optional()
});
export type EnduranceDesignInput = z.infer<typeof enduranceDesignInputSchema>;

export const enduranceSportSchema = z.enum(["running", "cycling", "walking", "other"]);
export type EnduranceSport = z.infer<typeof enduranceSportSchema>;

export const activityMetricTypeSchema = z.enum([
  "avg_pace_sec_per_km",
  "avg_heart_rate",
  "max_heart_rate",
  "elevation_gain_m",
  "avg_cadence",
  "avg_power",
  "estimated_load"
]);
export type ActivityMetricType = z.infer<typeof activityMetricTypeSchema>;

export type ParsedActivityMetric = { metricType: ActivityMetricType; value: number; unit: string };

/** What an isolated parser (FIT/TCX/GPX) is allowed to produce: only fields the file actually contains, never an invented value. */
export type ParsedActivity = {
  sport: EnduranceSport;
  startedAt: string;
  durationS: number | null;
  distanceM: number | null;
  metrics: ParsedActivityMetric[];
};

export const commitImportInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sport: enduranceSportSchema,
  isoWeekStart: z.string().date().nullable().optional(),
  sessionIndex: z.number().int().nonnegative().nullable().optional(),
  force: z.boolean().optional()
});
export type CommitImportInput = z.infer<typeof commitImportInputSchema>;
