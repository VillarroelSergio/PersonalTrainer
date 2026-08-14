export type RouteTimingLog = {
  level: "info";
  msg: "route_timing";
  route: string;
  requestId: string | null;
  ms: number;
  timings: Record<string, number>;
};

/** Keep Vercel logs queryable without exposing account data, credentials, or payloads. */
export function createRouteTimingLog(
  route: string,
  requestId: string | null,
  ms: number,
  timings: Record<string, number>
): RouteTimingLog {
  return { level: "info", msg: "route_timing", route, requestId, ms, timings };
}

export function logRouteTiming(
  route: string,
  requestId: string | null,
  startedAt: number,
  timings: Record<string, number> = {}
): void {
  console.info(JSON.stringify(createRouteTimingLog(route, requestId, Date.now() - startedAt, timings)));
}
