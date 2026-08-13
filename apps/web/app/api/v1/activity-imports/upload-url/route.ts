import { createActivityImportUploadUrlResponse } from "@/app/api/v1/activity-imports/upload-url/handler";
import { currentUser } from "@/lib/current-user";

export async function POST(request: Request) {
  return createActivityImportUploadUrlResponse(request, await currentUser(request.headers));
}
