import { substituteVariantResponse } from "@/app/api/v1/workouts/[id]/exercises/[sessionExerciseId]/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; sessionExerciseId: string }> }) {
  const { id, sessionExerciseId } = await params;
  return substituteVariantResponse(request, await currentUser(request.headers), getDb(), id, sessionExerciseId);
}
