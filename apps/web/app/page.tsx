import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const activePlan = await findActivePlanForOwner(db, session.user.id);
  redirect(activePlan ? "/hoy" : "/onboarding");
}
