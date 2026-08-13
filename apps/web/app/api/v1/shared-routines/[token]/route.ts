import { previewSharedRoutineResponse } from "@/app/api/v1/shared-routines/[token]/handler";
import { getDb } from "@/lib/db/client";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return previewSharedRoutineResponse(getDb(), token);
}
