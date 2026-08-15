import { z } from "zod";
import { weekdaySchema } from "./onboarding";

/** yyyy-mm-dd, must be a Monday — validated against isoWeekStart() server-side, not just shape here. */
const isoWeekStartSchema = z.string().date();

const plannedExerciseEditSchema = z.object({
  variantId: z.string().trim().min(1).max(120),
  targetSets: z.number().int().min(1).max(12),
  targetRepsMin: z.number().int().min(1).max(100),
  targetRepsMax: z.number().int().min(1).max(100)
}).refine((exercise) => exercise.targetRepsMax >= exercise.targetRepsMin, {
  message: "El máximo de repeticiones debe ser igual o mayor que el mínimo.",
  path: ["targetRepsMax"]
});

const plannedSessionBlockSchema = z.object({
  id: z.string().trim().min(1).max(120),
  kind: z.enum(["warmup", "mobility", "cooldown"]),
  estimatedMinutes: z.number().int().min(1).max(60),
  instructions: z.string().trim().min(1).max(500),
  variantIds: z.array(z.string().trim().min(1).max(120)).max(20).optional()
});

export const planEditInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move"), isoWeekStart: isoWeekStartSchema, sessionIndex: z.number().int().nonnegative(), targetDay: weekdaySchema }),
  z.object({ kind: z.literal("skip"), isoWeekStart: isoWeekStartSchema, sessionIndex: z.number().int().nonnegative() }),
  z.object({ kind: z.literal("remove"), isoWeekStart: isoWeekStartSchema, sessionIndex: z.number().int().nonnegative() }),
  z.object({ kind: z.literal("restore"), isoWeekStart: isoWeekStartSchema, sessionIndex: z.number().int().nonnegative() })
]);
export type PlanEditInput = z.infer<typeof planEditInputSchema>;

/** Edita el contenido de una sesión de fuerza del plan recurrente. */
export const planSessionContentInputSchema = z.object({
  isoWeekStart: isoWeekStartSchema,
  sessionIndex: z.number().int().nonnegative(),
  exercises: z.array(plannedExerciseEditSchema).min(1).max(20),
  blocks: z.array(plannedSessionBlockSchema).max(4).optional()
});
export type PlanSessionContentInput = z.infer<typeof planSessionContentInputSchema>;

export const planSessionAddOnInputSchema = z.object({
  routineId: z.string().trim().min(1).max(120),
  kind: z.enum(["warmup", "cooldown"])
});
export type PlanSessionAddOnInput = z.infer<typeof planSessionAddOnInputSchema>;
