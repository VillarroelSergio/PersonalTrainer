import { submitCheckinResponse } from "@/app/api/v1/checkins/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request) {
  return submitCheckinResponse(request, await currentUser(request.headers), getDb());
}
