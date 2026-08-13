import { deleteFavoriteResponse, putFavoriteResponse } from "@/app/api/v1/me/favorites/exercise-variants/[id]/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return putFavoriteResponse(await currentUser(request.headers), getDb(), id);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return deleteFavoriteResponse(await currentUser(request.headers), getDb(), id);
}
