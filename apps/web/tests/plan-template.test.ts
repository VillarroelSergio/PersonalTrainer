import { describe, expect, it } from "vitest";
import { templateCompatibility, templatePreviewExercises } from "@/features/planning/domain/plan-template";
import { PLAN_TEMPLATES } from "@/features/planning/data/plan-templates";

function templateVersion(templateId: string) {
  const template = PLAN_TEMPLATES.find((candidate) => candidate.templateId === templateId);
  if (!template) throw new Error(`template not found: ${templateId}`);
  return template.versions[0];
}

describe("templateCompatibility", () => {
  it("publishes twenty templates with a broad full-gym frequency distribution", () => {
    const gymTemplates = PLAN_TEMPLATES.flatMap((template) => template.versions)
      .filter((version) => version.environmentKind === "full_gym");

    expect(PLAN_TEMPLATES).toHaveLength(20);
    expect(gymTemplates).toHaveLength(19);
    expect(gymTemplates.filter((version) => version.content.blockBlueprints.length === 3)).toHaveLength(7);
    expect(gymTemplates.filter((version) => version.content.blockBlueprints.length === 4)).toHaveLength(5);
    expect(gymTemplates.filter((version) => version.content.blockBlueprints.length === 5)).toHaveLength(7);
    expect(gymTemplates.every((version) => version.catalog != null)).toBe(true);
    expect(PLAN_TEMPLATES.flatMap((template) => template.versions).reduce((total, version) => total + version.content.blockBlueprints.length, 0)).toBe(79);
  });

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

  it("previews the resolved exercise variants for each routine block", () => {
    const preview = templatePreviewExercises(templateVersion("upper-lower-gym"), {
      kind: "full_gym",
      equipment: ["free_weights", "benches_supports", "cables_torso", "leg_machines"]
    });

    expect(preview).toHaveLength(4);
    expect(preview[0]?.exercises.length).toBeGreaterThan(0);
    expect(preview[0]?.exercises[0]).toEqual(expect.objectContaining({ variantName: expect.any(String) }));
  });

  it("uses descriptive session names instead of anonymous A/B blocks", () => {
    const titles = templateVersion("upper-lower-gym").content.blockBlueprints.map((block) => block.title);
    expect(titles).toEqual([
      "Torso: pecho, espalda y hombros",
      "Pierna: sentadilla y cadena posterior",
      "Torso: espalda y brazos",
      "Pierna: unilateral y gemelos"
    ]);
    expect(titles.join(" ")).not.toMatch(/superior [AB]|inferior [AB]/i);
  });
});
