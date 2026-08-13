import { describe, expect, it } from "vitest";
import { requireOwnedResource } from "@/features/identity/authorization";

describe("owner authorization", () => {
  it("does not disclose a resource owned by another account", () => {
    expect(requireOwnedResource({ id: "plan-a", ownerId: "account-a" }, "account-b")).toBeNull();
  });

  it("permits the resource owner", () => {
    expect(requireOwnedResource({ id: "plan-a", ownerId: "account-a" }, "account-a")).toEqual({ id: "plan-a", ownerId: "account-a" });
  });
});
