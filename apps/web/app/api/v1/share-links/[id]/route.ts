import { revokeShareLinkResponse } from "@/app/api/v1/share-links/[id]/handler";
import { currentUser } from "@/lib/current-user";
import { db } from "@/lib/db/client";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return revokeShareLinkResponse(await currentUser(request.headers), db, id);
}
