import { uploadActivityImportResponse } from "@/app/api/v1/activity-imports/handler";
import { currentUser } from "@/lib/current-user";
import { db, sqlite } from "@/lib/db/client";

export async function POST(request: Request) {
  return uploadActivityImportResponse(request, await currentUser(request.headers), db, sqlite);
}
