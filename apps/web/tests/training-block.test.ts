import { describe, expect, it } from "vitest";
import { contributesToStrengthProgression } from "@/features/catalog/domain/training-block";

describe("contributesToStrengthProgression", () => {
  it("classifies strength blocks as strength exposure", () => {
    expect(contributesToStrengthProgression({ id: "x", kind: "strength", estimatedMinutes: 45, instructions: "" })).toBe(true);
  });

  it("does not classify mobility blocks as strength exposure", () => {
    expect(contributesToStrengthProgression({ id: "x", kind: "mobility", estimatedMinutes: 6, instructions: "" })).toBe(false);
  });

  it("does not classify warmup blocks as strength exposure", () => {
    expect(contributesToStrengthProgression({ id: "x", kind: "warmup", estimatedMinutes: 5, instructions: "" })).toBe(false);
  });

  it("does not classify cooldown blocks as strength exposure", () => {
    expect(contributesToStrengthProgression({ id: "x", kind: "cooldown", estimatedMinutes: 5, instructions: "" })).toBe(false);
  });
});
