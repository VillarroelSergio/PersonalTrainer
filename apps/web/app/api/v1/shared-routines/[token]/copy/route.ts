import { copySharedRoutineResponse } from "@/app/api/v1/shared-routines/[token]/copy/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return copySharedRoutineResponse(await currentUser(request.headers), getDb(), token);
}
