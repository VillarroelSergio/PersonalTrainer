import { createPlanSessionContentResponse } from "@/app/api/v1/plans/[id]/session-content/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return createPlanSessionContentResponse(request, await currentUser(request.headers), getDb(), id);
}
