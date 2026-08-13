import { confirmActivityImportResponse } from "@/app/api/v1/activity-imports/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request) {
  return confirmActivityImportResponse(request, await currentUser(request.headers), getDb());
}
