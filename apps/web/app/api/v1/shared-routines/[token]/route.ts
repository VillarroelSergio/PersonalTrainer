import { previewSharedRoutineResponse } from "@/app/api/v1/shared-routines/[token]/handler";
import { db } from "@/lib/db/client";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return previewSharedRoutineResponse(db, token);
}
