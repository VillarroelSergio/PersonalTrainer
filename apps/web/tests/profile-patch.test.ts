import { describe, expect, it } from "vitest";
import { profileFormDataToPatch } from "@/features/profile/domain/profile-patch";

describe("profileFormDataToPatch", () => {
  it("maps compact physical profile edits to the onboarding draft patch", () => {
    const form = new FormData();
    form.set("heightCm", "171");
    form.set("weightKg", "70.5");
    form.set("birthYear", "1996");
    form.set("birthMonth", "8");
    form.set("birthDay", "12");

    expect(profileFormDataToPatch(form)).toEqual({
      heightCm: 171,
      weightWholeKg: 70,
      weightDecimalKg: 5,
      birthYear: 1996,
      birthMonth: 8,
      birthDay: 12
    });
  });

  it("maps compact goals and equipment edits without accepting unknown fields", () => {
    const form = new FormData();
    form.append("goals", "muscle_gain");
    form.append("goals", "fat_loss");
    form.set("sessionDurationMinutes", "40");
    form.set("environmentKind", "full_gym");
    form.append("equipment", "free_weights");
    form.append("equipment", "cables_torso");

    expect(profileFormDataToPatch(form)).toEqual({
      goals: ["muscle_gain", "fat_loss"],
      sessionDurationMinutes: 40,
      environments: [{ kind: "full_gym", equipment: ["free_weights", "cables_torso"] }]
    });
  });
});
