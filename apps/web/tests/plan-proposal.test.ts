import { describe, expect, it } from "vitest";
import { buildPlanProposal } from "@/features/planning/domain/plan-proposal";
import { onboardingDraftSchema } from "@/contracts/onboarding";

const validDraft = {
  clientOperationId: "2a7bf47a-3e92-4d3c-88a2-d0f9b93b0f40",
  baseVersion: 0,
  creationMode: "guided",
  goals: ["strength", "endurance"],
  primaryGoal: "strength",
  experience: "intermediate",
  birthDate: "1992-04-12",
  heightCm: 178,
  weightKg: 76.5,
  strengthAvailability: ["monday", "wednesday", "friday"],
  enduranceActivities: [{ kind: "running", sessionsPerWeek: 2 }],
  sessionDurationMinutes: 60,
  environments: [{ kind: "full_gym", equipment: ["free_weights", "cables_torso"] }]
};

describe("onboarding proposal", () => {
  it("rejects an unsupported primary goal and imperial values", () => {
    expect(() => onboardingDraftSchema.parse({ ...validDraft, primaryGoal: "fat_loss", heightCm: 0 })).toThrow();
  });

  it("returns an explainable deterministic proposal", () => {
    const proposal = buildPlanProposal(onboardingDraftSchema.parse(validDraft));
    expect(proposal.ruleVersion).toBe("plan-proposal-v1");
    expect(proposal.reasons.length).toBeGreaterThan(0);
    expect(proposal.week.sessions).toHaveLength(5);
    expect(proposal.week.sessions.filter((session) => session.kind === "strength")).toHaveLength(3);
  });
});
