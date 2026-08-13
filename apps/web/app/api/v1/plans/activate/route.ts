import { activatePlanResponse } from "@/app/api/v1/plans/activate/handler";
import { currentUser } from "@/lib/current-user";
import { db, sqlite } from "@/lib/db/client";

export async function POST(request: Request) {
  return activatePlanResponse(request, await currentUser(request.headers), db, sqlite);
}
