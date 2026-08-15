import { createPlanSessionAddOnResponse } from "@/app/api/v1/plans/[id]/session-add-ons/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return createPlanSessionAddOnResponse(request, await currentUser(request.headers), getDb(), id);
}

