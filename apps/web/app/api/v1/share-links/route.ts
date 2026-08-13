import { listShareLinksResponse } from "@/app/api/v1/share-links/handler";
import { currentUser } from "@/lib/current-user";
import { db } from "@/lib/db/client";

export async function GET(request: Request) {
  return listShareLinksResponse(await currentUser(request.headers), db);
}
