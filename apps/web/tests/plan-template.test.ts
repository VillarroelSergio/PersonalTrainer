import { describe, expect, it } from "vitest";
import { templateCompatibility } from "@/features/planning/domain/plan-template";
import { PLAN_TEMPLATES } from "@/features/planning/data/plan-templates";

function templateVersion(templateId: string) {
  const template = PLAN_TEMPLATES.find((candidate) => candidate.templateId === templateId);
  if (!template) throw new Error(`template not found: ${templateId}`);
  return template.versions[0];
}

describe("templateCompatibility", () => {
  it("marks a gym template incompatible when essential capabilities are missing", () => {
    const pplGym = templateVersion("ppl-gym");
    const result = templateCompatibility(pplGym, ["free_weights"]);

    expect(result.status).toBe("not_currently_compatible");
    expect(result.missingCapabilities.length).toBeGreaterThan(0);
    expect(result.missingCapabilities).not.toContain("free_weights");
  });

  it("marks a template compatible when every essential capability is available", () => {
    const pplGym = templateVersion("ppl-gym");
    const result = templateCompatibility(pplGym, [
      "free_weights",
      "benches_supports",
      "cables_torso",
      "leg_machines",
      "no_equipment"
    ]);

    expect(result.status).toBe("compatible");
    expect(result.missingCapabilities).toEqual([]);
  });
});
