import { describe, expect, it } from "vitest";
import { activateProposal } from "@/features/planning/application/activate-proposal";

describe("activateProposal", () => {
  it("creates one active plan from an owned draft and archives the previous active plan", async () => {
    const result = await activateProposal({ ownerId: "account-a", proposalId: "proposal-a" }, {
      findProposal: async () => ({ id: "proposal-a", ownerId: "account-a", proposalJson: "{\"week\":{\"sessions\":[]}}" }),
      archiveActivePlans: async () => 1,
      createActivePlan: async (input) => ({ id: "plan-a", ...input }),
      markProposalActivated: async () => undefined
    });
    expect(result.id).toBe("plan-a");
    expect(result.ownerId).toBe("account-a");
  });

  it("does not activate another account's proposal", async () => {
    await expect(activateProposal({ ownerId: "account-b", proposalId: "proposal-a" }, {
      findProposal: async () => undefined, archiveActivePlans: async () => 0,
      createActivePlan: async () => { throw new Error("must not create"); }, markProposalActivated: async () => undefined
    })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
