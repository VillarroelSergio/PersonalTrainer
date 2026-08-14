import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel Speed Insights", () => {
  it("mounts the official Next.js component in the root layout", () => {
    const layout = readFileSync(join(__dirname, "..", "app", "layout.tsx"), "utf8");

    expect(layout).toContain('import { SpeedInsights } from "@vercel/speed-insights/next"');
    expect(layout).toContain("<SpeedInsights />");
  });
});
