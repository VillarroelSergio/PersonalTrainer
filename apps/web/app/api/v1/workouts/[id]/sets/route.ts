import { recordSetResponse, removeSetResponse } from "@/app/api/v1/workouts/[id]/sets/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return recordSetResponse(request, await currentUser(request.headers), getDb(), id);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return removeSetResponse(request, await currentUser(request.headers), getDb(), id);
}
