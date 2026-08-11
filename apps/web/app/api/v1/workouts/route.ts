import { startWorkoutResponse } from "@/app/api/v1/workouts/handler";
import { currentUser } from "@/lib/current-user";
import { db, sqlite } from "@/lib/db/client";

export async function POST(request: Request) {
  return startWorkoutResponse(request, await currentUser(request.headers), db, sqlite);
}
