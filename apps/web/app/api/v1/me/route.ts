import { deleteOwnAccountResponse } from "@/app/api/v1/me/handler";
import { currentUser } from "@/lib/current-user";
import { db } from "@/lib/db/client";

export async function DELETE(request: Request) {
  return deleteOwnAccountResponse(await currentUser(request.headers), db);
}
