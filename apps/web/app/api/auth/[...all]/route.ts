import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { logRouteTiming } from "@/lib/observability/route-timing";

const handlers = toNextJsHandler(auth);

async function timedAuth(method: "GET" | "POST", request: Request) {
  const startedAt = Date.now();
  try {
    return await handlers[method](request);
  } finally {
    logRouteTiming(`/api/auth/${method.toLowerCase()}`, request.headers.get("x-vercel-id"), startedAt);
  }
}

export const GET = (request: Request) => timedAuth("GET", request);
export const POST = (request: Request) => timedAuth("POST", request);
