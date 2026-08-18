// Public, unauthenticated endpoint (errors can happen before login) — cap every field so a
// malicious or runaway client can't flood Vercel's log volume with oversized payloads.
function truncate(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (typeof body?.message !== "string" || body.message.length === 0) {
      return new Response(null, { status: 400 });
    }
    console.error("[client-error]", {
      message: truncate(body.message, 500),
      name: truncate(body.name, 100),
      url: truncate(body.url, 500),
      stack: truncate(body.stack, 2000),
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
