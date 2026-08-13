import { decideRecommendationResponse } from "@/app/api/v1/recommendations/decision/handler";
import { currentUser } from "@/lib/current-user";
import { getDb } from "@/lib/db/client";

export async function POST(request: Request) {
  return decideRecommendationResponse(request, await currentUser(request.headers), getDb());
}
