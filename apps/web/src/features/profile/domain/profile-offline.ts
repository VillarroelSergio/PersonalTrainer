/**
 * Pure local-first write path for /perfil (local-first offline plan, Task 6). The real
 * write mechanism is a Next.js Server Action (saveProfileSection in app/perfil/page.tsx),
 * which cannot run offline at all — this replaces it with a client fetch that falls back
 * here on failure. Mirrors saveOwnedDraft's merge semantics exactly: `{ ...existing, ...patch }`,
 * a shallow spread where the patch wins per key (array-valued fields like `goals` or
 * `environments` are replaced wholesale, never merged element-wise — same as the server).
 */

import type { OfflineSnapshot } from "@/lib/offline/snapshot";
import { applyLocalMutation } from "@/lib/offline/snapshot-client";
import { createClientId } from "@/lib/client-id";
import type { OutboxOperation } from "@/lib/offline/outbox";
import type { OnboardingFormPatch } from "@/contracts/onboarding";

export type CreateId = () => string;

export type OnboardingDraftRow = { formJson: string; updatedAt: string | Date; form: OnboardingFormPatch };

export function saveProfileOffline(
  snapshot: OfflineSnapshot,
  patch: OnboardingFormPatch,
  createId: CreateId = createClientId
): { snapshot: OfflineSnapshot; operation: OutboxOperation } {
  const existingDraft = snapshot.data.onboardingDraft as OnboardingDraftRow | null | undefined;
  const merged: OnboardingFormPatch = { ...(existingDraft?.form ?? {}), ...patch };
  const draftRow: OnboardingDraftRow = { formJson: JSON.stringify(merged), updatedAt: new Date().toISOString(), form: merged };

  const nextSnapshot = applyLocalMutation(snapshot, { onboardingDraft: draftRow });
  const operation: OutboxOperation = { id: createId(), kind: "update_onboarding_draft", payload: patch, createdAt: Date.now(), status: "pending" };
  return { snapshot: nextSnapshot, operation };
}
