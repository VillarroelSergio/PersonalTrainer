import { describe, expect, it } from "vitest";
import { isTrustedDevelopmentOrigin } from "@/lib/auth-origin";

describe("isTrustedDevelopmentOrigin", () => {
  it("accepts the local browser hosts used to open the development app", () => {
    expect(isTrustedDevelopmentOrigin("http://localhost:3000")).toBe(true);
    expect(isTrustedDevelopmentOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isTrustedDevelopmentOrigin("http://192.168.1.42:3000")).toBe(true);
    expect(isTrustedDevelopmentOrigin("http://10.0.0.15:3000")).toBe(true);
  });

  it("does not trust arbitrary or encrypted remote origins in development", () => {
    expect(isTrustedDevelopmentOrigin("https://example.com")).toBe(false);
    expect(isTrustedDevelopmentOrigin("http://8.8.8.8:3000")).toBe(false);
    expect(isTrustedDevelopmentOrigin("not a url")).toBe(false);
  });
});
