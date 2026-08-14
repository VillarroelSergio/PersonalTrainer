import { describe, expect, it } from "vitest";
import { showLoadInput } from "@/features/workouts/ui/WorkoutRunner";

describe("métricas del registro de sesión", () => {
  it("oculta la carga para variantes de solo repeticiones", () => {
    expect(showLoadInput("reps_only")).toBe(false);
  });

  it("mantiene la carga para variantes externas y desconocidas", () => {
    expect(showLoadInput("load_and_reps")).toBe(true);
    expect(showLoadInput(undefined)).toBe(true);
  });
});
