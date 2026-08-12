import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import PlanSessionActions from "@/features/planning/ui/PlanSessionActions";
import { EXERCISE_CATALOG, MUSCLE_GROUPS, MUSCLE_GROUP_LABEL, MUSCLE_GROUP_IMAGE, findVariant } from "@/features/catalog/data/exercise-catalog";

const PUBLIC_DIR = join(__dirname, "..", "public");

describe("PlanSessionActions — regression for the /plan RSC crash", () => {
  it("exports one stable default client boundary for both plan actions", () => {
    // The original bug ("Element type is invalid…") came from exporting `{ RowActions, AddForm }`
    // as a plain object and accessing it via `PlanSessionActions.RowActions` from a Server Component —
    // Next.js can't resolve a client reference through an arbitrary property access. Named exports
    // are the stable boundary; this guards against reintroducing the object-wrapper pattern.
    // A default client boundary gives the Server Component one stable reference.
    expect(typeof PlanSessionActions).toBe("function");
  });
});

describe("Exercise catalog — nine approved muscle groups", () => {
  it("exposes exactly the nine groups approved for the library (VISUAL-PARITY-CONTRACT.md)", () => {
    expect(MUSCLE_GROUPS).toEqual([
      "pecho", "espalda", "hombros", "biceps", "triceps", "cuadriceps", "isquios_gluteos", "gemelos", "core"
    ]);
    for (const group of MUSCLE_GROUPS) {
      expect(MUSCLE_GROUP_LABEL[group]).toBeTruthy();
      expect(MUSCLE_GROUP_IMAGE[group]).toMatch(/\.webp$/);
    }
  });

  it("every catalog variant belongs to one of the nine approved groups", () => {
    for (const variant of EXERCISE_CATALOG) {
      expect(MUSCLE_GROUPS).toContain(variant.primaryMuscleGroup);
    }
  });

  it("catalog variants can expose secondary muscles without repeating the primary muscle", () => {
    const bench = findVariant("push-h-bench");
    expect(bench?.secondaryMuscleGroups).toEqual(["hombros", "triceps"]);

    for (const variant of EXERCISE_CATALOG) {
      for (const group of variant.secondaryMuscleGroups ?? []) {
        expect(MUSCLE_GROUPS).toContain(group);
        expect(group).not.toBe(variant.primaryMuscleGroup);
      }
    }
  });
});

describe("Exercise catalog — media correspondence", () => {
  it("a variant with mediaUrl points at its own exercise-specific illustration, never a group illustration", () => {
    const squat = findVariant("squat-barbell");
    expect(squat?.mediaUrl).toBe("/library/exercises/sentadilla-barra-v2.webp");
    expect(squat?.mediaUrl).not.toMatch(/\/library\/groups\//);
  });

  it("a variant without a real illustration leaves mediaUrl unset instead of borrowing one", () => {
    // squat-bodyweight has no exercise-specific illustration migrated from prototype/assets/ —
    // the UI must show an explicit "coming soon" state, never fall back to the group photo.
    const variant = findVariant("squat-bodyweight");
    expect(variant?.mediaUrl).toBeUndefined();
  });

  it("every mediaUrl in the catalog resolves to a file actually present under public/", () => {
    // Guards against declaring a mediaUrl for a file that was never copied into public/ —
    // that would 404 in the browser instead of showing the honest "coming soon" fallback.
    const missing = EXERCISE_CATALOG
      .filter((variant) => variant.mediaUrl)
      .filter((variant) => !existsSync(join(PUBLIC_DIR, variant.mediaUrl!)))
      .map((variant) => variant.id);
    expect(missing).toEqual([]);
  });
});
