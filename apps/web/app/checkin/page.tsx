import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { CheckinRunner } from "@/features/training-engine/ui/CheckinRunner";
import { AppShell } from "@/components/AppShell";

export default async function CheckinPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (!activePlan) redirect("/onboarding");

  return (
    <AppShell title="Check-in" backHref="/hoy">
      <CheckinRunner />
    </AppShell>
  );
}
