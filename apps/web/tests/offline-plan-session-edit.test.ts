import { describe, expect, it } from "vitest";
import { applySessionContentEditOffline, applySessionEditOffline } from "@/features/planning/domain/plan-session-edit-offline";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";

const PLAN_ID = "plan-1";

const proposal = {
  week: {
    sessions: [
      { day: "monday", kind: "strength", title: "Piernas", estimatedMinutes: 45, exercises: [{ variantId: "squat-back", targetSets: 3, targetRepsMin: 8, targetRepsMax: 10 }] }
    ]
  }
};

function createId() {
  let n = 0;
  return () => String(++n);
}

function baseSnapshot(overrides: Partial<OfflineSnapshot["data"]> = {}): OfflineSnapshot {
  return {
    userId: "owner-1",
    syncedAt: Date.now(),
    data: {
      activePlan: { id: PLAN_ID, contentJson: JSON.stringify(proposal), version: 1 },
      planEdits: [],
      ...overrides
    }
  };
}

describe("applySessionEditOffline", () => {
  it("writes a reschedule adjustment row for a 'move' edit", () => {
    const snapshot = baseSnapshot();
    const result = applySessionEditOffline(snapshot, PLAN_ID, { kind: "move", isoWeekStart: "2026-08-17", sessionIndex: 0, targetDay: "wednesday" }, createId());
    const planEdits = result.snapshot.data.planEdits as Array<{ planId: string; sessionIndex: number; kind: string; targetDay: string | null; originDay: string }>;
    expect(planEdits).toContainEqual(expect.objectContaining({ planId: PLAN_ID, sessionIndex: 0, kind: "reschedule", targetDay: "wednesday", originDay: "monday" }));
    expect(result.operation).toMatchObject({ kind: "plan_session_edit", planId: PLAN_ID, payload: { kind: "move", targetDay: "wednesday" } });
  });

  it("deletes any existing adjustment instead of writing one when moving back onto the session's own day", () => {
    const moved = applySessionEditOffline(baseSnapshot(), PLAN_ID, { kind: "move", isoWeekStart: "2026-08-17", sessionIndex: 0, targetDay: "wednesday" }, createId());
    const restored = applySessionEditOffline(moved.snapshot, PLAN_ID, { kind: "move", isoWeekStart: "2026-08-17", sessionIndex: 0, targetDay: "monday" }, createId());
    expect(restored.snapshot.data.planEdits).toEqual([]);
  });

  it("writes a 'skipped' adjustment for a skip edit", () => {
    const result = applySessionEditOffline(baseSnapshot(), PLAN_ID, { kind: "skip", isoWeekStart: "2026-08-17", sessionIndex: 0 }, createId());
    const planEdits = result.snapshot.data.planEdits as Array<{ kind: string; targetDay: string | null }>;
    expect(planEdits).toContainEqual(expect.objectContaining({ kind: "skipped", targetDay: null }));
  });

  it("writes a 'removed' adjustment for a remove edit", () => {
    const result = applySessionEditOffline(baseSnapshot(), PLAN_ID, { kind: "remove", isoWeekStart: "2026-08-17", sessionIndex: 0 }, createId());
    const planEdits = result.snapshot.data.planEdits as Array<{ kind: string }>;
    expect(planEdits).toContainEqual(expect.objectContaining({ kind: "removed" }));
  });

  it("deletes the existing adjustment for a restore edit", () => {
    const skipped = applySessionEditOffline(baseSnapshot(), PLAN_ID, { kind: "skip", isoWeekStart: "2026-08-17", sessionIndex: 0 }, createId());
    const restored = applySessionEditOffline(skipped.snapshot, PLAN_ID, { kind: "restore", isoWeekStart: "2026-08-17", sessionIndex: 0 }, createId());
    expect(restored.snapshot.data.planEdits).toEqual([]);
    expect(restored.operation).toMatchObject({ kind: "plan_session_edit", payload: { kind: "restore" } });
  });

  it("replaces (never duplicates) an existing adjustment for the same occurrence", () => {
    const skipped = applySessionEditOffline(baseSnapshot(), PLAN_ID, { kind: "skip", isoWeekStart: "2026-08-17", sessionIndex: 0 }, createId());
    const removed = applySessionEditOffline(skipped.snapshot, PLAN_ID, { kind: "remove", isoWeekStart: "2026-08-17", sessionIndex: 0 }, createId());
    const planEdits = removed.snapshot.data.planEdits as Array<{ kind: string }>;
    expect(planEdits).toHaveLength(1);
    expect(planEdits[0].kind).toBe("removed");
  });
});

describe("applySessionContentEditOffline", () => {
  it("patches the session's exercises/blocks directly into activePlan.contentJson, without writing a planEdits row", () => {
    const snapshot = baseSnapshot();
    const input = { isoWeekStart: "2026-08-17", sessionIndex: 0, exercises: [{ variantId: "bench-press", targetSets: 4, targetRepsMin: 6, targetRepsMax: 8 }], blocks: [] };
    const result = applySessionContentEditOffline(snapshot, PLAN_ID, input, createId());

    const nextActivePlan = result.snapshot.data.activePlan as { contentJson: string; version: number };
    const nextProposal = JSON.parse(nextActivePlan.contentJson) as typeof proposal;
    expect(nextProposal.week.sessions[0].exercises).toEqual(input.exercises);
    expect(nextActivePlan.version).toBe(2);
    expect(result.snapshot.data.planEdits).toEqual(snapshot.data.planEdits);
    expect(result.operation).toMatchObject({ kind: "plan_session_content_edit", planId: PLAN_ID, payload: input });
  });

  it("keeps the session's existing blocks when the input omits them", () => {
    const withBlocks = baseSnapshot({
      activePlan: { id: PLAN_ID, version: 1, contentJson: JSON.stringify({ week: { sessions: [{ ...proposal.week.sessions[0], blocks: [{ id: "warmup-1", kind: "warmup", estimatedMinutes: 5, instructions: "x" }] }] } }) }
    });
    const input = { isoWeekStart: "2026-08-17", sessionIndex: 0, exercises: proposal.week.sessions[0].exercises };
    const result = applySessionContentEditOffline(withBlocks, PLAN_ID, input, createId());
    const nextProposal = JSON.parse((result.snapshot.data.activePlan as { contentJson: string }).contentJson);
    expect(nextProposal.week.sessions[0].blocks).toEqual([{ id: "warmup-1", kind: "warmup", estimatedMinutes: 5, instructions: "x" }]);
  });
});
