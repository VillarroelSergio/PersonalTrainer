import { describe, expect, it } from "vitest";
import { createInitialFormState } from "@/features/onboarding/presentation/state";
import { formStepPatch } from "@/features/onboarding/presentation/data-source";

describe("onboarding step persistence", () => {
  it("persists only the current step, excluding incomplete future fields", () => {
    const form = {
      ...createInitialFormState(new Date("2026-08-14T00:00:00Z")),
      creationMode: "guided" as const
    };

    expect(formStepPatch(form, "mode")).toEqual({ creationMode: "guided" });
  });

  it("persists the complete birth date atomically", () => {
    const form = {
      ...createInitialFormState(new Date("2026-08-14T00:00:00Z")),
      birthDay: 5,
      birthMonth: 7,
      birthYear: 1994
    };

    expect(formStepPatch(form, "birth_date")).toEqual({ birthDay: 5, birthMonth: 7, birthYear: 1994 });
  });
});
