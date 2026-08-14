import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = (...parts: string[]) => join(__dirname, "..", "app", ...parts);
const src = (...parts: string[]) => join(__dirname, "..", "src", ...parts);

describe("mobile performance regressions", () => {
  it("puts a bounded timeout in front of navigation network-first", () => {
    const serviceWorker = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8");

    expect(serviceWorker).toContain("NAVIGATION_TIMEOUT_MS");
    expect(serviceWorker).toContain("Promise.race");
    expect(serviceWorker).toContain("return fetch(request);");
  });

  it("does not route an authenticated login through the root database redirect", () => {
    const login = readFileSync(app("login", "page.tsx"), "utf8");

    expect(login).toContain('const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/hoy";');
    expect(login).toContain("router.push(destination)");
    expect(login).not.toContain('router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/")');
  });

  it("keeps independent server reads parallel on the critical pages", () => {
    const plan = readFileSync(app("plan", "page.tsx"), "utf8");
    const history = readFileSync(app("historial", "page.tsx"), "utf8");
    const exercises = readFileSync(app("ejercicios", "page.tsx"), "utf8");

    expect(plan).toContain("const [adjustments, fullHistory, plans] = await Promise.all([");
    expect(history).toContain("const [allSessions, enduranceActivities, progress] = await Promise.all([");
    expect(history).toContain("const [adherence, weekStats] = await Promise.all([");
    expect(exercises).toContain("const [favoriteVariantIds, recentVariantIds] = await Promise.all([");
  });

  it("batches history child records instead of issuing one query per row", () => {
    const historyRepository = readFileSync(src("features", "history", "domain", "history-repository.ts"), "utf8");
    const workoutRepository = readFileSync(src("features", "workouts", "domain", "workout-session-repository.ts"), "utf8");

    expect(historyRepository).toContain("inArray(activityMetric.activityId, rows.map((row) => row.id))");
    expect(historyRepository).toContain("inArray(setPerformance.sessionExerciseId, exerciseRows.map((row) => row.id))");
    expect(workoutRepository).toContain("inArray(setPerformance.sessionExerciseId, rows.map((row) => row.sessionExerciseId))");
  });
});

describe("mobile accessibility regressions", () => {
  it("does not expose duplicate empty links for exercise thumbnails", () => {
    const exercises = readFileSync(app("ejercicios", "page.tsx"), "utf8");

    expect(exercises).not.toContain('aria-hidden="true" tabIndex={-1} className="catalog-card__thumb"');
    expect(exercises).toContain('className="catalog-card__thumb" aria-hidden="true"');
  });

  it("keeps favorite controls at a usable mobile touch size", () => {
    const css = readFileSync(src("styles", "app.css"), "utf8");

    expect(css).toContain(".favbtn--sm { width: 44px; height: 44px;");
  });

  it("gives history tabs an explicit controlled panel", () => {
    const history = readFileSync(app("historial", "page.tsx"), "utf8");

    expect(history).toContain('aria-controls="historyPanel"');
    expect(history).toContain('id="historyPanel"');
  });

  it("uses unique accessible headings for multiple Today cards", () => {
    const hoy = readFileSync(app("hoy", "page.tsx"), "utf8");

    expect(hoy).toContain("const titleId = `todayTitle-${sessionIndex}`;");
    expect(hoy).toContain("aria-labelledby={titleId}");
    expect(hoy).toContain("id={titleId}");
  });
});

describe("route timing semantics", () => {
  it("records database duration separately from total route duration", () => {
    const plan = readFileSync(app("plan", "page.tsx"), "utf8");
    const timing = readFileSync(src("lib", "observability", "route-timing.ts"), "utf8");

    expect(timing).toContain("dbMs");
    expect(plan).toContain("{ dbMs: Date.now() - dbStartedAt }");
    expect(plan).not.toContain("{ data: Date.now() - startedAt }");
  });
});
