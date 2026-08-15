import { describe, expect, it } from "vitest";
import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { saveProfileOffline } from "@/features/profile/domain/profile-offline";

function createId() {
  let n = 0;
  return () => `id-${++n}`;
}

function snapshotWithDraft(form: Record<string, unknown> | null): OfflineSnapshot {
  return {
    userId: "user-1",
    syncedAt: 1,
    data: {
      onboardingDraft: form ? { formJson: JSON.stringify(form), updatedAt: "2026-01-01T00:00:00.000Z", form } : null
    }
  };
}

describe("saveProfileOffline", () => {
  it("shallow-merges the patch onto the existing draft form, patch wins per key", () => {
    const snapshot = snapshotWithDraft({ goals: ["strength"], heightCm: 180, sessionDurationMinutes: 60 });
    const patch = { heightCm: 185 };
    const result = saveProfileOffline(snapshot, patch, createId());
    const draft = result.snapshot.data.onboardingDraft as { form: Record<string, unknown> };
    expect(draft.form).toEqual({ goals: ["strength"], heightCm: 185, sessionDurationMinutes: 60 });
  });

  it("replaces array-valued fields wholesale, never merges them element-wise", () => {
    const snapshot = snapshotWithDraft({ goals: ["strength", "endurance"] });
    const patch = { goals: ["fat_loss"] as const };
    const result = saveProfileOffline(snapshot, patch as never, createId());
    const draft = result.snapshot.data.onboardingDraft as { form: Record<string, unknown> };
    expect(draft.form.goals).toEqual(["fat_loss"]);
  });

  it("builds a fresh draft when none existed yet", () => {
    const snapshot = snapshotWithDraft(null);
    const patch = { heightCm: 170 };
    const result = saveProfileOffline(snapshot, patch, createId());
    const draft = result.snapshot.data.onboardingDraft as { form: Record<string, unknown> };
    expect(draft.form).toEqual({ heightCm: 170 });
  });

  it("queues an update_onboarding_draft operation with the raw patch as payload", () => {
    const snapshot = snapshotWithDraft({ heightCm: 180 });
    const patch = { heightCm: 185 };
    const result = saveProfileOffline(snapshot, patch, createId());
    expect(result.operation).toMatchObject({ id: "id-1", kind: "update_onboarding_draft", payload: patch, status: "pending" });
  });

  it("does not mutate the input snapshot", () => {
    const snapshot = snapshotWithDraft({ heightCm: 180 });
    saveProfileOffline(snapshot, { heightCm: 190 }, createId());
    const draft = snapshot.data.onboardingDraft as { form: Record<string, unknown> };
    expect(draft.form).toEqual({ heightCm: 180 });
  });
});
