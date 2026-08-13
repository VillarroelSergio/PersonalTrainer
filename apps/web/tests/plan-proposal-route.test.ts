import { describe, expect, it } from "vitest";
import { createPlanProposalResponse } from "@/app/api/v1/plan-proposals/handler";

const body = {
  clientOperationId: "2a7bf47a-3e92-4d3c-88a2-d0f9b93b0f40", baseVersion: 0, creationMode: "guided",
  goals: ["strength"], primaryGoal: "strength", experience: "intermediate", birthDate: "1992-04-12",
  heightCm: 178, weightKg: 76.5, strengthAvailability: ["monday", "wednesday", "friday"],
  enduranceActivities: [], sessionDurationMinutes: 60,
  environments: [{ kind: "full_gym", equipment: ["free_weights"] }]
};

describe("POST /api/v1/plan-proposals", () => {
  it("requires an authenticated account", async () => {
    const response = await createPlanProposalResponse(new Request("http://localhost/api/v1/plan-proposals", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "idempotency-key": body.clientOperationId } }), null);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("validates the mutation idempotency key and returns an explainable proposal", async () => {
    const response = await createPlanProposalResponse(new Request("http://localhost/api/v1/plan-proposals", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "idempotency-key": body.clientOperationId } }), { id: "account-a" });
    expect(response.status).toBe(200);
    expect((await response.json()).data.ruleVersion).toBe("plan-proposal-v1");

    const invalidKey = await createPlanProposalResponse(new Request("http://localhost/api/v1/plan-proposals", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "idempotency-key": "different" } }), { id: "account-a" });
    expect(invalidKey.status).toBe(400);
  });

  it("rejects malformed JSON and invalid drafts at the HTTP boundary", async () => {
    const malformed = await createPlanProposalResponse(new Request("http://localhost", { method: "POST", body: "not-json", headers: { "idempotency-key": body.clientOperationId } }), { id: "account-a" });
    expect(malformed.status).toBe(400);
    const invalid = await createPlanProposalResponse(new Request("http://localhost", { method: "POST", body: JSON.stringify({ ...body, heightCm: 0 }), headers: { "content-type": "application/json", "idempotency-key": body.clientOperationId } }), { id: "account-a" });
    expect(invalid.status).toBe(400);
  });
});
