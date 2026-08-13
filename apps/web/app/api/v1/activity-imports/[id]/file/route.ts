import { deleteActivityImportFileResponse } from "@/app/api/v1/activity-imports/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return deleteActivityImportFileResponse(await currentUser(request.headers), getDb(), id);
}
