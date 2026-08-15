import { createOfflineSnapshotResponse } from "@/app/api/v1/offline-snapshot/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function GET(request: Request) {
  return createOfflineSnapshotResponse(request, await currentUser(request.headers), getDb());
}
