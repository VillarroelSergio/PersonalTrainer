import { describe, expect, it } from "vitest";
import { adjustRestSeconds, isRestComplete, remainingRestSeconds } from "@/features/workouts/domain/rest-timer";

describe("remainingRestSeconds", () => {
  it("derives the remaining rest from its end timestamp instead of interval ticks", () => {
    expect(remainingRestSeconds(190_000, 130_001)).toBe(60);
  });

  it("never returns a negative rest duration", () => {
    expect(remainingRestSeconds(190_000, 190_001)).toBe(0);
  });

  it("marks a rest complete at its deadline so the persistent footer can disappear", () => {
    expect(isRestComplete(190_000, 190_000)).toBe(true);
    expect(isRestComplete(190_000, 189_999)).toBe(false);
  });

  it("adjusts rest in quick bounded steps without exposing a numeric input", () => {
    expect(adjustRestSeconds(90, -15)).toBe(75);
    expect(adjustRestSeconds(15, -15)).toBe(15);
    expect(adjustRestSeconds(300, 15)).toBe(300);
  });
});
