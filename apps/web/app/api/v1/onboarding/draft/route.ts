import { getOnboardingDraftResponse, putOnboardingDraftResponse } from "@/app/api/v1/onboarding/draft/handler";
import { currentUser } from "@/lib/current-user";
import { db } from "@/lib/db/client";

export async function GET(request: Request) {
  return getOnboardingDraftResponse(await currentUser(request.headers), db);
}

export async function PUT(request: Request) {
  return putOnboardingDraftResponse(request, await currentUser(request.headers), db);
}
