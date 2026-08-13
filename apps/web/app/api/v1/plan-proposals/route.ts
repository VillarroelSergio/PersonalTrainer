import { createPlanProposalResponse } from "@/app/api/v1/plan-proposals/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request) {
  return createPlanProposalResponse(request, await currentUser(request.headers), getDb());
}
