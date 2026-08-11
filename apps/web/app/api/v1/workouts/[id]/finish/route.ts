import { finishWorkoutResponse } from "@/app/api/v1/workouts/[id]/finish/handler";
import { currentUser } from "@/lib/current-user";
import { db, sqlite } from "@/lib/db/client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return finishWorkoutResponse(request, await currentUser(request.headers), db, sqlite, id);
}
