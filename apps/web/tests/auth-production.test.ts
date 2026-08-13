import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAuth } from "@/lib/auth";

// Note: createAuth's parameter IS disableSignUp (default true), passed straight
// through to betterAuth's emailAndPassword.disableSignUp. The production export
// is `createAuth(process.env.NODE_ENV !== "development")`, which evaluates to
// createAuth(true) outside development — i.e. sign-up disabled.
describe("production auth keeps sign-up closed", () => {
  it("disables sign-up for the production-shaped call (NODE_ENV !== development)", () => {
    const productionAuth = createAuth(process.env.NODE_ENV !== "development");
    expect(productionAuth.options.emailAndPassword?.disableSignUp).toBe(true);
  });

  it("disables sign-up by default when no argument is passed", () => {
    const defaultAuth = createAuth();
    expect(defaultAuth.options.emailAndPassword?.disableSignUp).toBe(true);
  });

  it("only allows sign-up when explicitly opened (the development recovery path)", () => {
    const devRecoveryAuth = createAuth(false);
    expect(devRecoveryAuth.options.emailAndPassword?.disableSignUp).toBe(false);
  });
});

describe("login page gates the local sign-up affordance on development mode", () => {
  const source = readFileSync(join(process.cwd(), "apps/web/app/login/page.tsx"), "utf8");

  it("derives devSignup strictly from NODE_ENV === development", () => {
    expect(source).toMatch(/const devSignup = process\.env\.NODE_ENV === "development";/);
  });

  it("renders the 'Crear cuenta local' button label only inside a devSignup-guarded branch", () => {
    // The literal JSX label is quoted with no trailing punctuation; this is
    // distinct from the unrelated error-copy sentence ("...pulsa Crear
    // cuenta local.") earlier in the file, so match the quoted form only.
    const buttonLabelIndex = source.indexOf('"Crear cuenta local"');
    expect(buttonLabelIndex).toBeGreaterThan(-1);

    const guardIndex = source.indexOf("devSignup ? (");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(buttonLabelIndex);

    // The quoted button label appears exactly once, inside that one guarded
    // branch, so there is no unguarded second render path.
    const occurrences = source.split('"Crear cuenta local"').length - 1;
    expect(occurrences).toBe(1);
  });
});
