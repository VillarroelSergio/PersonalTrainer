# Onboarding Editor and Catalog Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make guided onboarding skip the irrelevant routine step, make custom routines selectable and inspectable, let users replace compatible exercises before activation, and ship the first expanded editorial exercise/routine catalog.

**Architecture:** Keep the existing onboarding state and `PlanProposal` contracts, derive a visible step list from creation mode, and add pure catalog selectors for proposal editing. The proposal editor works on a local immutable draft; activation already accepts the edited proposal, so no database migration is needed.

**Tech Stack:** Next.js App Router, React/TypeScript, CSS Modules, Vitest, Playwright mobile Chromium.

## Global Constraints

- Mobile viewport is the primary design target; CTAs remain reachable with long proposal content.
- Compatible replacements must keep the same movement pattern and satisfy the declared environment/equipment.
- Existing exercise IDs and persisted proposal fields remain backwards compatible.
- No public signup, new cloud credentials, database migration, or inventory-by-brand/model.
- Do not invent media URLs; optional exercise media must reference existing editorial assets.

---

### Task 1: Mode-aware onboarding steps

**Files:**
- Modify: `apps/web/src/features/onboarding/presentation/types.ts`
- Modify: `apps/web/src/features/onboarding/presentation/state.ts`
- Modify: `apps/web/src/features/onboarding/ui/OnboardingFlow.tsx`
- Test: `apps/web/tests/onboarding/state.test.ts`

**Interfaces:**
- Produce `visibleStepOrder(mode: CreationMode | null): StepId[]` and use it for progress, navigation, and `canAdvance`.
- Preserve `formStepPatch` step IDs and the persisted draft contract.

- [ ] **Step 1: Write the failing tests**

```ts
it("omits the template step for guided mode", () => {
  expect(visibleStepOrder("guided")).not.toContain("template");
  expect(visibleStepOrder("guided")).toHaveLength(13);
});

it("keeps the template step for self-directed mode", () => {
  expect(visibleStepOrder("self_directed")).toContain("template");
  expect(visibleStepOrder("self_directed")).toHaveLength(14);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- apps/web/tests/onboarding/state.test.ts`

Expected: FAIL because `visibleStepOrder` does not exist and the fixed order still contains `template` for guided mode.

- [ ] **Step 3: Implement the visible step list**

Use the fixed `STEP_ORDER` as the source and filter only `template` when `mode === "guided"`. Update reducer `GO_NEXT`, `GO_BACK`, `GO_TO_STEP`, and `canAdvance` to use the visible list. Pass the visible total and current label to `ProgressHeader`.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- apps/web/tests/onboarding/state.test.ts`

Expected: PASS, including existing reducer tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding/presentation/types.ts apps/web/src/features/onboarding/presentation/state.ts apps/web/src/features/onboarding/ui/OnboardingFlow.tsx apps/web/tests/onboarding/state.test.ts
git commit -m "fix: skip routine selection in guided onboarding"
```

### Task 2: Compatible exercise alternatives

**Files:**
- Create: `apps/web/src/features/planning/domain/exercise-alternatives.ts`
- Test: `apps/web/tests/exercise-alternatives.test.ts`

**Interfaces:**
- Produce `exerciseById(variantId: string)` returning an `EditorialVariant | undefined`.
- Produce `compatibleExerciseAlternatives(variantId: string, environment: EquipmentProfile): EditorialVariant[]`.

- [ ] **Step 1: Write failing domain tests**

```ts
it("returns only active variants with the same movement pattern and compatible equipment", () => {
  const alternatives = compatibleExerciseAlternatives("push-h-bench", {
    kind: "basic_gym",
    equipment: ["free_weights", "benches_supports"]
  });
  expect(alternatives.map((item) => item.id)).toContain("push-h-dumbbell");
  expect(alternatives.map((item) => item.id)).not.toContain("pull-h-dumbbell-row");
  expect(alternatives.map((item) => item.id)).not.toContain("push-h-chest-machine");
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- apps/web/tests/exercise-alternatives.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the pure selector**

Resolve the current variant from `EDITORIAL_VARIANTS`, derive capabilities with `capabilitiesForEnvironment`, filter `active`, matching `movementPattern`, matching `environments`, and `isEquipmentRequirementSatisfied`. Return a stable catalog order and exclude the current ID.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- apps/web/tests/exercise-alternatives.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/planning/domain/exercise-alternatives.ts apps/web/tests/exercise-alternatives.test.ts
git commit -m "feat: resolve compatible exercise alternatives"
```

### Task 3: Routine cards and exercise previews

**Files:**
- Modify: `apps/web/src/features/onboarding/ui/screens/TemplateCatalogScreen.tsx`
- Modify: `apps/web/src/features/onboarding/ui/screens/TemplateCatalogScreen.module.css`
- Modify: `apps/web/src/features/onboarding/ui/OnboardingFlow.tsx`
- Test: `apps/web/tests/plan-template.test.ts`

**Interfaces:**
- Keep `selectedTemplateId` controlled by the reducer.
- Expose each compatible routine as a radio card with a toggleable exercise preview.

- [ ] **Step 1: Add failing catalog assertions**

```ts
it("contains seven full-gym templates across three, four and five days", () => {
  const gymTemplates = PLAN_TEMPLATES.flatMap((item) => item.versions).filter((item) => item.environmentKind === "full_gym");
  expect(gymTemplates).toHaveLength(7);
  expect(gymTemplates.filter((item) => item.content.blockBlueprints.length === 3)).toHaveLength(3);
  expect(gymTemplates.filter((item) => item.content.blockBlueprints.length === 4)).toHaveLength(2);
  expect(gymTemplates.filter((item) => item.content.blockBlueprints.length === 5)).toHaveLength(2);
});
```

- [ ] **Step 2: Run the focused test and confirm the current catalog fails if incomplete**

Run: `npm test -- apps/web/tests/plan-template.test.ts`

Expected: FAIL until the catalog and counts are reconciled.

- [ ] **Step 3: Implement visible selection and previews**

Render a radio button/card with `aria-checked`, a check indicator, and explicit missing-capability copy. Add a `Ver ejercicios` control that expands session names and resolved variant names using `EDITORIAL_VARIANTS`. Keep the main CTA enabled only when a compatible template is selected.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- apps/web/tests/plan-template.test.ts apps/web/tests/onboarding/state.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding/ui/screens/TemplateCatalogScreen.tsx apps/web/src/features/onboarding/ui/screens/TemplateCatalogScreen.module.css apps/web/src/features/onboarding/ui/OnboardingFlow.tsx apps/web/tests/plan-template.test.ts
git commit -m "feat: make routine selection inspectable on mobile"
```

### Task 4: Proposal session and exercise editor

**Files:**
- Modify: `apps/web/src/features/onboarding/ui/screens/ProposalScreen.tsx`
- Modify: `apps/web/src/features/onboarding/ui/screens/ProposalScreen.module.css`
- Modify: `apps/web/src/features/onboarding/ui/OnboardingFlow.tsx`
- Test: `apps/web/tests/plan-proposal.test.ts`

**Interfaces:**
- `ProposalScreen` receives `environment?: EquipmentProfile`.
- Local `draft` updates only `week.sessions[].exercises[].variantId`; series/repetition values remain unchanged.

- [ ] **Step 1: Add failing proposal assertions**

```ts
it("keeps exercise targets when a compatible variant is selected", () => {
  const proposal = buildPlanProposal(onboardingDraftSchema.parse(validDraft));
  const session = proposal.week.sessions.find((item) => item.kind === "strength")!;
  expect(session.exercises?.[0]).toEqual(expect.objectContaining({ targetSets: 3, targetRepsMin: 4, targetRepsMax: 6 }));
});
```

- [ ] **Step 2: Run the focused tests and establish the baseline**

Run: `npm test -- apps/web/tests/plan-proposal.test.ts`

Expected: Existing tests pass; UI behavior remains unimplemented.

- [ ] **Step 3: Implement the editor**

Remove the session-name input. Add collapsible session cards with day and duration controls, an exercise list showing exercise and variant names, target sets/reps, and a native select for compatible alternatives. Keep the current variant selectable as the displayed value when there are no alternatives, and show a clear “No hay otra variante compatible” message.

- [ ] **Step 4: Run focused and type checks**

Run: `npm test -- apps/web/tests/plan-proposal.test.ts`; then `npm run typecheck`.

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/onboarding/ui/screens/ProposalScreen.tsx apps/web/src/features/onboarding/ui/screens/ProposalScreen.module.css apps/web/src/features/onboarding/ui/OnboardingFlow.tsx apps/web/tests/plan-proposal.test.ts
git commit -m "feat: edit compatible exercises before activation"
```

### Task 5: Catalog and routine expansion reconciliation

**Files:**
- Modify: `apps/web/src/features/catalog/data/editorial-exercises.ts`
- Modify: `apps/web/src/features/planning/data/plan-templates.ts`
- Modify: `apps/web/src/contracts/onboarding.ts` only if a genuinely new category is needed
- Test: `apps/web/tests/editorial-content.test.ts`
- Test: `apps/web/tests/plan-proposal-route.test.ts`

**Interfaces:**
- Preserve all existing IDs and use only existing equipment categories unless a new category is explicitly represented in the onboarding UI and schema.

- [ ] **Step 1: Add failing count and resolution assertions**

```ts
it("keeps at least 45 active editorial variants", () => {
  expect(EDITORIAL_VARIANTS.filter((item) => item.active).length).toBeGreaterThanOrEqual(45);
});

it("resolves at least one exercise for every pattern in each compatible full-gym template", () => {
  for (const template of fullGymTemplates()) {
    const proposal = buildPlanProposal(draftForTemplate(template.templateId));
    expect(proposal.week.sessions.every((session) => (session.exercises?.length ?? 0) > 0)).toBe(true);
  }
});
```

- [ ] **Step 2: Run the focused tests and confirm any gaps**

Run: `npm test -- apps/web/tests/editorial-content.test.ts apps/web/tests/plan-proposal-route.test.ts`

Expected: FAIL only for missing catalog entries or unresolved patterns.

- [ ] **Step 3: Reconcile catalog data**

Keep 45+ active variants, add any missing compatible alternatives required by the seven full-gym templates, and ensure each template declares accurate essential capabilities and day count. Do not add fake media paths.

- [ ] **Step 4: Run the focused tests**

Run: `npm test -- apps/web/tests/editorial-content.test.ts apps/web/tests/plan-proposal-route.test.ts apps/web/tests/plan-template.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/catalog/data/editorial-exercises.ts apps/web/src/features/planning/data/plan-templates.ts apps/web/src/contracts/onboarding.ts apps/web/tests/editorial-content.test.ts apps/web/tests/plan-proposal-route.test.ts
git commit -m "feat: expand compatible exercise and routine catalog"
```

### Task 6: Mobile E2E and final verification

**Files:**
- Modify: `tests/e2e/production-smoke.spec.ts` only for stable read-only assertions
- Create or modify: `tests/e2e/onboarding-editor.spec.ts`

- [ ] **Step 1: Add a mobile E2E path**

Use the dedicated E2E account only in a local/preview environment for mutating onboarding; production coverage stays read-only. Assert that guided mode does not show “Elige una rutina”, custom mode marks a selected card, exercise details render, and a compatible replacement changes the displayed variant without changing targets.

- [ ] **Step 2: Run the E2E listing and focused local/preview test**

Run: `npx playwright test --config playwright.production.config.ts --list` and then the configured E2E target when credentials and a safe environment are available.

Expected: the new tests are listed; production smoke remains read-only.

- [ ] **Step 3: Run the complete verification suite**

Run: `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`.

Expected: all commands exit 0; only existing non-blocking warnings may remain.

- [ ] **Step 4: Verify mobile visually**

Check the onboarding wizard, routine cards, proposal editor, sticky CTA, expanded exercise lists, and long scrolling content at a narrow mobile viewport. Confirm keyboard focus and reduced-motion-safe behavior.

- [ ] **Step 5: Commit and push**

```bash
git status --short
git add apps/web tests package.json package-lock.json
git commit -m "feat: complete onboarding routine editor and catalog expansion"
git push -u origin feature/performance-observability-e2e
```
