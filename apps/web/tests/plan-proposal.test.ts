import { describe, expect, it } from "vitest";
import { buildPlanProposal } from "@/features/planning/domain/plan-proposal";
import { replaceProposalExerciseVariant } from "@/features/planning/domain/plan-proposal-editor";
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

  it("assigns only variants whose equipment category is declared in the selected environment", () => {
    const proposal = buildPlanProposal(onboardingDraftSchema.parse({
      ...validDraft,
      environments: [{ kind: "full_gym", equipment: ["free_weights"] }]
    }));
    const variantIds = proposal.week.sessions.flatMap((session) => session.exercises?.map((exercise) => exercise.variantId) ?? []);

    expect(variantIds).toContain("squat-barbell");
    expect(variantIds).not.toContain("pull-h-cable-row");
    expect(variantIds).not.toContain("pull-v-lat-pulldown");
  });

  it("omits a pattern when no active eligible variant can satisfy its requirements", () => {
    const proposal = buildPlanProposal(onboardingDraftSchema.parse({
      ...validDraft,
      environments: [{ kind: "full_gym", equipment: [] }]
    }));
    const exercises = proposal.week.sessions.flatMap((session) => session.exercises ?? []);

    expect(exercises).not.toContainEqual(expect.objectContaining({ variantId: "pull-h-cable-row" }));
  });

  it("includes only available foundation blocks in a strength session proposal", () => {
    const proposal = buildPlanProposal(onboardingDraftSchema.parse(validDraft));
    const strengthSession = proposal.week.sessions.find((session) => session.kind === "strength");

    expect(strengthSession?.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "warmup" })])
    );
  });

  it("keeps progression fields exclusive to exercises, never on non-strength blocks", () => {
    const proposal = buildPlanProposal(onboardingDraftSchema.parse(validDraft));
    const strengthSession = proposal.week.sessions.find((session) => session.kind === "strength");

    expect(strengthSession?.exercises?.length).toBeGreaterThan(0);
    for (const block of strengthSession?.blocks ?? []) {
      expect(block).not.toHaveProperty("targetSets");
      expect(block).not.toHaveProperty("targetRepsMin");
      expect(block).not.toHaveProperty("targetRepsMax");
    }
  });

  it("replaces only the selected exercise variant and preserves targets", () => {
    const proposal = buildPlanProposal(onboardingDraftSchema.parse(validDraft));
    const sessionIndex = proposal.week.sessions.findIndex((session) => session.kind === "strength");
    const original = proposal.week.sessions[sessionIndex]?.exercises?.[0];
    const updated = replaceProposalExerciseVariant(proposal, sessionIndex, 0, "push-h-dumbbell");

    expect(updated.week.sessions[sessionIndex]?.exercises?.[0]).toEqual({ ...original, variantId: "push-h-dumbbell" });
    expect(proposal.week.sessions[sessionIndex]?.exercises?.[0]).toEqual(original);
  });
});
