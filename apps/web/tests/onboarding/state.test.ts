import { describe, expect, it } from "vitest";
import { onboardingDraftSchema } from "@/contracts/onboarding";
import { canAdvance, createInitialState, formToDraft, onboardingReducer } from "@/features/onboarding/presentation/state";
import { STEP_ORDER, visibleStepOrder } from "@/features/onboarding/presentation/types";
import { EQUIPMENT_IMAGE, EQUIPMENT_OPTIONS } from "@/features/onboarding/presentation/constants";
import { percentForElapsed, phaseForPercent, TRANSITION_DURATION_MS, TRANSITION_MAX_PERCENT } from "@/features/onboarding/presentation/transition";

describe("onboardingReducer", () => {
  it("omits routine selection from guided onboarding", () => {
    expect(visibleStepOrder("guided")).not.toContain("template");
    expect(visibleStepOrder("guided")).toHaveLength(13);
  });

  it("keeps routine selection for self-directed onboarding", () => {
    expect(visibleStepOrder("self_directed")).toContain("template");
    expect(visibleStepOrder("self_directed")).toHaveLength(14);
  });

  it("has an illustration for every selectable equipment category", () => {
    expect(EQUIPMENT_OPTIONS.map((option) => EQUIPMENT_IMAGE[option.value])).toEqual(expect.arrayContaining(EQUIPMENT_OPTIONS.map(() => expect.any(String))));
  });

  it("keeps one decision on each activity, context and optional wellbeing step", () => {
    expect(STEP_ORDER).toEqual([
      "mode",
      "goals",
      "experience",
      "birth_date",
      "height",
      "weight",
      "strength_availability",
      "endurance",
      "duration",
      "environment",
      "equipment",
      "template",
      "focus",
      "discomfort"
    ]);
  });

  it("blocks advancing on the goals step until at least one goal is chosen", () => {
    let state = createInitialState(new Date("2024-01-01"));
    state = onboardingReducer(state, { type: "GO_TO_STEP", stepIndex: 1 });
    expect(canAdvance(state)).toBe(false);
    state = onboardingReducer(state, { type: "TOGGLE_GOAL", goal: "fat_loss" });
    expect(canAdvance(state)).toBe(true);
  });

  it("requires a catalog choice on the template step for self-directed creation", () => {
    let state = createInitialState();
    state = onboardingReducer(state, { type: "SET_MODE", mode: "self_directed" });
    state = onboardingReducer(state, { type: "GO_TO_STEP", stepIndex: STEP_ORDER.indexOf("template") });
    expect(canAdvance(state)).toBe(false);
    state = onboardingReducer(state, { type: "SELECT_TEMPLATE", templateId: "upper-lower-gym" });
    expect(state.form.selectedTemplateId).toBe("upper-lower-gym");
    expect(canAdvance(state)).toBe(true);
  });

  it("keeps the first toggled goal as primaryGoal even after adding more", () => {
    let state = createInitialState();
    state = onboardingReducer(state, { type: "TOGGLE_GOAL", goal: "fat_loss" });
    state = onboardingReducer(state, { type: "TOGGLE_GOAL", goal: "strength" });
    expect(state.form.goals).toEqual(["fat_loss", "strength"]);
  });

  it("removing and re-adding a goal moves it to the end (new priority order)", () => {
    let state = createInitialState();
    state = onboardingReducer(state, { type: "TOGGLE_GOAL", goal: "fat_loss" });
    state = onboardingReducer(state, { type: "TOGGLE_GOAL", goal: "strength" });
    state = onboardingReducer(state, { type: "TOGGLE_GOAL", goal: "fat_loss" });
    expect(state.form.goals).toEqual(["strength"]);
  });

  it("GO_BACK preserves previously entered form data", () => {
    let state = createInitialState();
    state = onboardingReducer(state, { type: "SET_HEIGHT", heightCm: 182 });
    state = onboardingReducer(state, { type: "GO_NEXT" });
    state = onboardingReducer(state, { type: "GO_BACK" });
    expect(state.form.heightCm).toBe(182);
  });

  it("selecting an environment preselects all its compatible equipment", () => {
    let state = createInitialState();
    state = onboardingReducer(state, { type: "TOGGLE_ENVIRONMENT", kind: "home" });
    const home = state.form.environments.find((env) => env.kind === "home");
    expect(home?.equipment).toEqual(["free_weights", "benches_supports", "pullup_dip_station", "resistance_bands", "bodyweight_accessories"]);
  });

  it("replaces the previous environment and its equipment when a new environment is selected", () => {
    let state = createInitialState();
    state = onboardingReducer(state, { type: "TOGGLE_ENVIRONMENT", kind: "full_gym" });
    state = onboardingReducer(state, { type: "TOGGLE_EQUIPMENT", kind: "full_gym", equipment: "cables_torso" });
    state = onboardingReducer(state, { type: "TOGGLE_ENVIRONMENT", kind: "home" });

    expect(state.form.environments).toEqual([{ kind: "home", equipment: ["free_weights", "benches_supports", "pullup_dip_station", "resistance_bands", "bodyweight_accessories"] }]);
  });

  it("rejects a draft with more than one training environment", () => {
    const state = createInitialState(new Date("2024-06-15"));
    expect(() => onboardingDraftSchema.parse({
      ...formToDraft({
        ...state.form,
        creationMode: "guided",
        goals: ["strength"],
        experience: "intermediate",
        strengthAvailability: ["monday"],
        environments: [
          { kind: "full_gym", equipment: ["free_weights"] },
          { kind: "home", equipment: ["free_weights"] }
        ]
      })
    })).toThrow();
  });

  it("toggling equipment off removes just that category", () => {
    let state = createInitialState();
    state = onboardingReducer(state, { type: "TOGGLE_ENVIRONMENT", kind: "home" });
    state = onboardingReducer(state, { type: "TOGGLE_EQUIPMENT", kind: "home", equipment: "free_weights" });
    const home = state.form.environments.find((env) => env.kind === "home");
    expect(home?.equipment).toEqual(["benches_supports", "pullup_dip_station", "resistance_bands", "bodyweight_accessories"]);
  });

  it("caps optional muscle focus at three selections", () => {
    let state = createInitialState();
    for (const focus of ["upper_body", "lower_body", "push", "pull"] as const) {
      state = onboardingReducer(state, { type: "TOGGLE_MUSCLE_FOCUS", focus });
    }
    expect(state.form.optionalMuscleFocus).toEqual(["upper_body", "lower_body", "push"]);
  });

  it("only advances to the proposal phase once both the ring finished and the proposal arrived", () => {
    let state = createInitialState();
    state = onboardingReducer(state, { type: "START_TRANSITION" });
    state = onboardingReducer(state, { type: "RING_FINISHED" });
    expect(state.phase).toBe("transition");
    state = onboardingReducer(state, {
      type: "PROPOSAL_READY",
      proposal: {
        proposalId: "p1",
        ruleVersion: "plan-proposal-v1",
        reasons: [],
        alternatives: [],
        initialBlock: { name: "Bloque", purpose: "Adaptación", weeks: 4 },
        week: { sessions: [] }
      }
    });
    expect(state.phase).toBe("proposal");
  });

  it("formToDraft produces a draft that satisfies onboardingDraftSchema", () => {
    let state = createInitialState(new Date("2024-06-15"));
    state = onboardingReducer(state, { type: "SET_MODE", mode: "guided" });
    state = onboardingReducer(state, { type: "TOGGLE_GOAL", goal: "strength" });
    state = onboardingReducer(state, { type: "SET_EXPERIENCE", experience: "intermediate" });
    state = onboardingReducer(state, { type: "SET_BIRTH_YEAR", year: 1992 });
    state = onboardingReducer(state, { type: "SET_BIRTH_MONTH", month: 4 });
    state = onboardingReducer(state, { type: "SET_BIRTH_DAY", day: 12 });
    state = onboardingReducer(state, { type: "SET_HEIGHT", heightCm: 178 });
    state = onboardingReducer(state, { type: "SET_WEIGHT_WHOLE", whole: 76 });
    state = onboardingReducer(state, { type: "SET_WEIGHT_DECIMAL", decimal: 5 });
    state = onboardingReducer(state, { type: "TOGGLE_STRENGTH_DAY", day: "monday" });
    state = onboardingReducer(state, { type: "TOGGLE_ENVIRONMENT", kind: "full_gym" });

    const draft = formToDraft(state.form);
    expect(draft.birthDate).toBe("1992-04-12");
    expect(draft.weightKg).toBe(76.5);
    expect(draft.primaryGoal).toBe("strength");
    expect(() => onboardingDraftSchema.parse(draft)).not.toThrow();
  });
});

describe("transition timing", () => {
  it("reaches 0% at the start and never reports 100", () => {
    expect(percentForElapsed(0)).toBe(0);
    expect(percentForElapsed(TRANSITION_DURATION_MS)).toBe(TRANSITION_MAX_PERCENT);
    expect(percentForElapsed(TRANSITION_DURATION_MS * 10)).toBe(TRANSITION_MAX_PERCENT);
  });

  it("maps percent to the three documented phases in order", () => {
    expect(phaseForPercent(0).text).toBe("Ordenamos tu semana");
    expect(phaseForPercent(50).text).toBe("Equilibramos fuerza y actividad exterior");
    expect(phaseForPercent(99).text).toBe("Preparamos alternativas compatibles");
  });
});
