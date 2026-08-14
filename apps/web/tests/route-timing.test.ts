import { describe, expect, it } from "vitest";
import { createRouteTimingLog } from "@/lib/observability/route-timing";

describe("createRouteTimingLog", () => {
  it("emits route timings without user or request payload data", () => {
    expect(createRouteTimingLog("/hoy", "iad1::request", 125, { session: 20, data: 90 })).toEqual({
      level: "info", msg: "route_timing", route: "/hoy", requestId: "iad1::request", ms: 125, timings: { session: 20, data: 90 }
    });
  });
});
