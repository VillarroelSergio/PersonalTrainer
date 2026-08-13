import { startRecoverySessionResponse } from "@/app/api/v1/recovery-sessions/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request) {
  return startRecoverySessionResponse(request, await currentUser(request.headers), getDb());
}
