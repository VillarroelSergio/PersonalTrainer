import { saveEnduranceDesignResponse } from "@/app/api/v1/endurance-designs/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request) {
  return saveEnduranceDesignResponse(request, await currentUser(request.headers), getDb());
}
