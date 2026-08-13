import { lastPerformanceResponse } from "@/app/api/v1/exercise-variants/[id]/last-performance/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return lastPerformanceResponse(await currentUser(request.headers), getDb(), id);
}
