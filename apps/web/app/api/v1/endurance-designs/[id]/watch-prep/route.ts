import { confirmWatchPrepResponse } from "@/app/api/v1/endurance-designs/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return confirmWatchPrepResponse(await currentUser(request.headers), getDb(), id);
}
