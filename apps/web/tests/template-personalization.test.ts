import { describe, expect, it } from "vitest";
import { onboardingDraftSchema } from "@/contracts/onboarding";
import { personalizeTemplate } from "@/features/planning/domain/template-personalization";
import { PLAN_TEMPLATES } from "@/features/planning/data/plan-templates";

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
  environments: [{ kind: "full_gym", equipment: ["free_weights", "cables_torso", "benches_supports"] }]
};

function templateVersion(templateId: string) {
  const template = PLAN_TEMPLATES.find((candidate) => candidate.templateId === templateId);
  if (!template) throw new Error(`template not found: ${templateId}`);
  return template.versions[0];
}

describe("personalizeTemplate", () => {
  it("creates an isolated personalized copy pinned to its template version", () => {
    const fullBodyGym = templateVersion("full-body-gym");
    const draft = onboardingDraftSchema.parse(validDraft);

    const copy = personalizeTemplate(fullBodyGym, draft);

    expect(copy.source).toBe("template");
    expect(copy.sourceTemplateId).toBe(fullBodyGym.templateId);
    expect(copy.sourceTemplateVersion).toBe(fullBodyGym.version);
    expect(copy.catalogVersion).toBe(fullBodyGym.catalogVersion);
    expect(copy.content).not.toBe(fullBodyGym.content.blockBlueprints);
    expect(copy.content.sessions.length).toBeGreaterThan(0);
  });

  it("does not mutate the template's blueprint when the copy is edited", () => {
    const fullBodyGym = templateVersion("full-body-gym");
    const draft = onboardingDraftSchema.parse(validDraft);
    const originalBlueprintCount = fullBodyGym.content.blockBlueprints.length;

    const copy = personalizeTemplate(fullBodyGym, draft);
    copy.content.sessions.push({ ...copy.content.sessions[0], day: "sunday" });

    expect(fullBodyGym.content.blockBlueprints.length).toBe(originalBlueprintCount);
  });
});
