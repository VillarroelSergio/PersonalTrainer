import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import PlanSessionActions from "@/features/planning/ui/PlanSessionActions";
import { EXERCISE_CATALOG, MUSCLE_GROUPS, MUSCLE_GROUP_LABEL, MUSCLE_GROUP_IMAGE, findVariant } from "@/features/catalog/data/exercise-catalog";

const PUBLIC_DIR = join(__dirname, "..", "public");

describe("Plan navigation views", () => {
  it("renders Semana, Fases and Tus planes from a validated query value", () => {
    // /plan is a snapshot-driven client component now (Fase 5, Task 6): the "vista" query param is
    // read via useSearchParams() and validated in the pure computePlanView (plan-view.ts), not
    // parsed inline in the page itself — see offline-plan-view.test.ts for the validation coverage.
    const page = readFileSync(join(__dirname, "..", "app", "plan", "page.tsx"), "utf8");
    const view = readFileSync(join(__dirname, "..", "src", "features", "planning", "domain", "plan-view.ts"), "utf8");
    expect(page).toContain('vistaParam={searchParams.get("vista")}');
    expect(page).toContain('vista === "fases"');
    expect(page).toContain('vista === "planes"');
    expect(view).toContain('TABS.some((tab) => tab.key === vistaParam)');
    expect(view).not.toContain('const vista: TabKey = "semana"');
  });
});

describe("Workout preview", () => {
  it("uses a visual identifier in preview and active exercise cards", () => {
    const runner = readFileSync(join(__dirname, "..", "src", "features", "workouts", "ui", "WorkoutRunner.tsx"), "utf8");
    expect(runner).toContain('className="exrow__thumb"');
    expect(runner).toContain("exerciseMediaSrc(variant)");
    expect(runner).toContain("exerciseMediaAlt(variant)");
    expect(runner).toContain('className="opt__media"');
  });
});

describe("Exercise visuals across planning and history", () => {
  it("keeps the exercise name and image together in every exercise list surface", () => {
    const templateCatalog = readFileSync(join(__dirname, "..", "src", "features", "onboarding", "ui", "screens", "TemplateCatalogScreen.tsx"), "utf8");
    const proposal = readFileSync(join(__dirname, "..", "src", "features", "onboarding", "ui", "screens", "ProposalScreen.tsx"), "utf8");
    const history = readFileSync(join(__dirname, "..", "app", "historial", "[id]", "page.tsx"), "utf8");
    expect(templateCatalog).toContain("exerciseMediaSrc");
    expect(templateCatalog).toContain("exerciseMediaAlt");
    expect(proposal).toContain("exerciseMediaSrc");
    expect(proposal).toContain("exerciseMediaAlt");
    expect(proposal).toContain("proposalExercisePickerTitle");
    expect(proposal).toContain("pickerOption");
    expect(proposal).not.toContain("<select value={exercise.variantId}");
    expect(history).toContain("history-exercise__media");
  });
});

describe("Plan session editor", () => {
  it("exposes a visual editor for changing, removing and adding planned exercises", () => {
    const planPage = readFileSync(join(__dirname, "..", "app", "plan", "page.tsx"), "utf8");
    const editor = readFileSync(join(__dirname, "..", "src", "features", "planning", "ui", "PlanSessionEditor.tsx"), "utf8");
    expect(planPage).toContain("PlanSessionEditor");
    expect(editor).toContain("Editar sesión");
    expect(editor).toContain("Añadir ejercicio");
    expect(editor).toContain("Cambiar");
    expect(editor).toContain("Eliminar");
    expect(editor).toContain("session-content");
    expect(editor).toContain("exerciseMediaSrc");
  });
});

describe("Workout close flow", () => {
  it("uses a direct effort selector instead of a free-form numeric field", () => {
    const runner = readFileSync(join(__dirname, "..", "src", "features", "workouts", "ui", "WorkoutRunner.tsx"), "utf8");
    expect(runner).toContain('className="effort-picker"');
    expect(runner).not.toContain('id="global-effort" type="number"');
  });
});

describe("Profile edit layout", () => {
  it("allows every compact physical field to shrink inside a mobile row", () => {
    const css = readFileSync(join(__dirname, "..", "src", "styles", "app.css"), "utf8");
    expect(css).toContain(".reffields .field { flex: 1; min-width: 0;");
    expect(css).toContain(".reffields input { width: 100%; }");
  });
});

describe("Heyy-inspired onboarding shell", () => {
  it("uses the immersive dark shell, compact option rows and an electric primary CTA", () => {
    const css = readFileSync(join(__dirname, "..", "src", "components", "OnboardingShell.module.css"), "utf8");
    const choices = readFileSync(join(__dirname, "..", "src", "features", "onboarding", "ui", "screens", "BasicSelectionScreens.module.css"), "utf8");
    expect(css).toContain("--onboarding-action: #c94c12");
    expect(css).toContain("min-height: 100dvh");
    expect(choices).toContain(".modeOption");
    expect(choices).toContain(".modeOptionSelected");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("Onboarding visual assets", () => {
  it("ships and consumes original equipment and wellbeing illustrations", () => {
    const equipmentScreen = readFileSync(join(__dirname, "..", "src", "features", "onboarding", "ui", "screens", "EquipmentScreen.tsx"), "utf8");
    const equipmentConstants = readFileSync(join(__dirname, "..", "src", "features", "onboarding", "presentation", "constants.ts"), "utf8");
    const equipment = readFileSync(join(__dirname, "..", "src", "features", "onboarding", "ui", "screens", "EquipmentScreen.module.css"), "utf8");
    const discomfort = readFileSync(join(__dirname, "..", "src", "features", "onboarding", "ui", "screens", "FocusDiscomfortScreen.module.css"), "utf8");
    expect(existsSync(join(PUBLIC_DIR, "onboarding", "equipment-sprite-v1.png"))).toBe(true);
    expect(existsSync(join(PUBLIC_DIR, "onboarding", "wellbeing-zones-sprite-v1.png"))).toBe(true);
    expect(existsSync(join(PUBLIC_DIR, "onboarding", "focus-icons-sprite-v2.png"))).toBe(true);
    expect(existsSync(join(PUBLIC_DIR, "onboarding", "focus-body-icons-v3.png"))).toBe(true);
    expect(existsSync(join(PUBLIC_DIR, "onboarding", "discomfort-zones-sprite-v2.png"))).toBe(true);
    expect(equipmentScreen).toContain("EQUIPMENT_IMAGE");
    expect(equipmentConstants).toContain("racks_smith");
    expect(equipmentConstants).toContain("resistance_bands");
    expect(discomfort).toContain("/onboarding/discomfort-zones-sprite-v2.png");
  });
});

describe("Onboarding physical and focus visual regressions", () => {
  it("keeps wheel units outside the selected value and renders focus + all discomfort zones as illustrated cards", () => {
    const physical = readFileSync(join(__dirname, "..", "src", "features", "onboarding", "ui", "screens", "PhysicalScreens.tsx"), "utf8");
    const focus = readFileSync(join(__dirname, "..", "src", "features", "onboarding", "ui", "screens", "FocusDiscomfortScreen.tsx"), "utf8");
    const css = readFileSync(join(__dirname, "..", "src", "features", "onboarding", "ui", "screens", "FocusDiscomfortScreen.module.css"), "utf8");
    expect(physical).toContain('formatLabel={(v) => String(v)} ariaLabel="Altura en centímetros"');
    expect(focus).toContain('zone: "neck"');
    expect(focus).toContain('zone: "ankle"');
    expect(focus).toContain("focusIcon");
    expect(focus).toContain("¿En qué grupo muscular quieres centrarte?");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });
});

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

  it("uses the exercise-specific illustration when editorial media is available", () => {
    // squat-bodyweight has no exercise-specific illustration migrated from prototype/assets/ —
    // the UI uses the approved muscle-group illustration as its compact visual fallback.
    const variant = findVariant("squat-bodyweight");
    expect(variant?.mediaUrl).toBe("/library/exercises/sentadilla-peso-corporal-v1.webp");
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
