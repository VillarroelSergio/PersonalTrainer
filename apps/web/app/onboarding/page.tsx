import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { OnboardingRoute } from "@/features/onboarding/ui/OnboardingRoute";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { new: createNew } = await searchParams;
  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (activePlan && createNew !== "1") redirect("/hoy");

  return <OnboardingRoute />;
}
