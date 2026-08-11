import { addBodyMetricResponse } from "@/app/api/v1/body-metrics/handler";
import { currentUser } from "@/lib/current-user";
import { db } from "@/lib/db/client";

export async function POST(request: Request) {
  return addBodyMetricResponse(request, await currentUser(request.headers), db);
}
