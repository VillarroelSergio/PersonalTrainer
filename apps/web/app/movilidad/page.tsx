import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { MobilityCatalog } from "@/features/catalog/ui/MobilityCatalog";
import { getDb } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";

export default async function MovilidadPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const activePlan = await findActivePlanForOwner(getDb(), session.user.id);

  return (
    <AppShell title="Movilidad">
      <p className="kicker">Catálogo de bienestar</p>
      <h1 className="view-title">Movilidad y estiramientos</h1>
      <p className="lede small">Secuencias breves para preparar, complementar o cerrar tu entrenamiento. No sustituyen una valoración profesional.</p>
      <MobilityCatalog planId={activePlan?.id} />
    </AppShell>
  );
}
