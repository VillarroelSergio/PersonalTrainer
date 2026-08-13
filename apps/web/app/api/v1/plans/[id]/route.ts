import { deletePlanResponse, renamePlanResponse } from "@/app/api/v1/plans/[id]/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renamePlanResponse(request, await currentUser(request.headers), getDb(), id);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return deletePlanResponse(await currentUser(request.headers), getDb(), id);
}
