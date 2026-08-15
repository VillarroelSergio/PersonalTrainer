import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exercisesForMobilityRoutine, MOBILITY_EXERCISES, MOBILITY_ROUTINES } from "@/features/catalog/data/mobility-catalog";

describe("mobility and stretching editorial catalog", () => {
  it("publishes a complete set of exercises with a dose and image", () => {
    expect(MOBILITY_EXERCISES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(MOBILITY_EXERCISES.map((exercise) => exercise.id)).size).toBe(MOBILITY_EXERCISES.length);
    for (const exercise of MOBILITY_EXERCISES) {
      expect(exercise.defaultDose.length).toBeGreaterThan(0);
      expect(exercise.mediaUrl).toMatch(/^\/library\/exercises\/.+\.webp$/);
      expect(fs.existsSync(path.join(process.cwd(), "apps/web/public", exercise.mediaUrl.slice(1)))).toBe(true);
    }
  });

  it("offers six selectable routines whose exercise references resolve", () => {
    expect(MOBILITY_ROUTINES).toHaveLength(6);
    for (const routine of MOBILITY_ROUTINES) {
      expect(routine.durationMinutes).toBeGreaterThan(0);
      expect(exercisesForMobilityRoutine(routine)).toHaveLength(routine.exerciseIds.length);
    }
  });

  it("uses time for stretches and repetitions for dynamic mobility where appropriate", () => {
    expect(MOBILITY_EXERCISES.filter((exercise) => exercise.category === "stretch").every((exercise) => exercise.metric === "seconds")).toBe(true);
    expect(MOBILITY_EXERCISES.some((exercise) => exercise.category === "mobility" && exercise.metric === "reps")).toBe(true);
  });
});
