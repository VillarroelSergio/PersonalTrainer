import { describe, expect, it } from "vitest";
import { isBodyMapVisible, resolveDiscomfortForSubmit } from "@/features/training-engine/domain/checkin-discomfort";
import type { Discomfort } from "@/features/onboarding/presentation/types";

const zoneDiscomfort: Discomfort = { zone: "shoulder", intensity: "mild" };

describe("isBodyMapVisible — the body map only reveals once a molestia level is declared", () => {
  it("is hidden for the initial 'none' level", () => {
    expect(isBodyMapVisible("none")).toBe(false);
  });

  it("is shown for mild, moderate, and important levels", () => {
    expect(isBodyMapVisible("mild")).toBe(true);
    expect(isBodyMapVisible("moderate")).toBe(true);
    expect(isBodyMapVisible("important")).toBe(true);
  });
});

describe("resolveDiscomfortForSubmit — a declared zone is discarded before submit once the level returns to 'none'", () => {
  it("strips a previously selected zone when the level is 'none'", () => {
    expect(resolveDiscomfortForSubmit("none", zoneDiscomfort)).toBeNull();
  });

  it("keeps the declared zone when a non-'none' level is active", () => {
    expect(resolveDiscomfortForSubmit("moderate", zoneDiscomfort)).toEqual(zoneDiscomfort);
  });

  it("stays null when no zone was ever selected, regardless of level", () => {
    expect(resolveDiscomfortForSubmit("mild", null)).toBeNull();
  });
});
