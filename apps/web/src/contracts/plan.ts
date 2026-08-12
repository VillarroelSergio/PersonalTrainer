import { z } from "zod";
import { weekdaySchema } from "./onboarding";

/** yyyy-mm-dd, must be a Monday — validated against isoWeekStart() server-side, not just shape here. */
const isoWeekStartSchema = z.string().date();

export const planEditInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("move"), isoWeekStart: isoWeekStartSchema, sessionIndex: z.number().int().nonnegative(), targetDay: weekdaySchema }),
  z.object({ kind: z.literal("skip"), isoWeekStart: isoWeekStartSchema, sessionIndex: z.number().int().nonnegative() }),
  z.object({ kind: z.literal("remove"), isoWeekStart: isoWeekStartSchema, sessionIndex: z.number().int().nonnegative() }),
  z.object({ kind: z.literal("restore"), isoWeekStart: isoWeekStartSchema, sessionIndex: z.number().int().nonnegative() })
]);
export type PlanEditInput = z.infer<typeof planEditInputSchema>;
