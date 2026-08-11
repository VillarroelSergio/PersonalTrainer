import { z } from "zod";

/** Peso/medida opcionales. Nunca IMC, grasa corporal ni peso ideal: solo valor + unidad + fecha + zona opcional (para medida). */
export const bodyMetricInputSchema = z.object({
  kind: z.enum(["weight", "measurement"]),
  zone: z.string().min(1).max(60).nullable().optional(),
  value: z.number().positive(),
  unit: z.string().min(1).max(10),
  measuredAt: z.string().date()
});
export type BodyMetricInputContract = z.infer<typeof bodyMetricInputSchema>;
