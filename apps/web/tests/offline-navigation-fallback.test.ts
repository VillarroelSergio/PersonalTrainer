import { describe, expect, it } from "vitest";
import { findSamePathnameCacheUrl } from "@/lib/offline/cache-fallback";

describe("findSamePathnameCacheUrl", () => {
  it("finds a cached entry for the same pathname with a different query string", () => {
    const result = findSamePathnameCacheUrl(["https://app.example/entrenar?session=0", "https://app.example/hoy"], "https://app.example/entrenar?session=3");
    expect(result).toBe("https://app.example/entrenar?session=0");
  });

  it("returns null when no cached entry shares the pathname", () => {
    const result = findSamePathnameCacheUrl(["https://app.example/hoy"], "https://app.example/plan?tab=1");
    expect(result).toBeNull();
  });

  it("matches an entry with no query string against a request that has one", () => {
    const result = findSamePathnameCacheUrl(["https://app.example/entrenar"], "https://app.example/entrenar?session=1");
    expect(result).toBe("https://app.example/entrenar");
  });

  it("returns the first matching cached entry when several share the pathname", () => {
    const result = findSamePathnameCacheUrl(["https://app.example/entrenar?session=0", "https://app.example/entrenar?session=1"], "https://app.example/entrenar?session=9");
    expect(result).toBe("https://app.example/entrenar?session=0");
  });
});
