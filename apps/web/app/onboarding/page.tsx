import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { OnboardingRoute } from "@/features/onboarding/ui/OnboardingRoute";

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (activePlan) redirect("/hoy");

  return <OnboardingRoute />;
}
