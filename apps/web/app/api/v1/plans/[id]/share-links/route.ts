import { createShareLinkResponse } from "@/app/api/v1/plans/[id]/share-links/handler";
import { currentUser } from "@/lib/current-user";
import { db } from "@/lib/db/client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return createShareLinkResponse(await currentUser(request.headers), db, id);
}
