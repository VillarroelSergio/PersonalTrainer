import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { findActivePlanForOwner } from "@/features/planning/domain/training-plan-repository";
import { listOwnedShareLinks } from "@/features/planning/domain/share-repository";
import { AppShell } from "@/components/AppShell";
import { ShareLinkManager } from "@/features/planning/ui/ShareLinkManager";

export default async function CompartirPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const activePlan = await findActivePlanForOwner(db, session.user.id);
  if (!activePlan) redirect("/onboarding");

  const links = await listOwnedShareLinks(db, session.user.id);

  return (
    <AppShell title="Compartir" backHref="/plan">
      <h1 className="view-title">Compartir rutina</h1>
      <p className="lede small">Comparte tu plan como una plantilla; quien la abra crea una copia independiente. Nunca comparte tus cargas, tu historial ni tus cambios posteriores.</p>

      <h2 className="section-title">Tu rutina activa</h2>
      <div className="refblock">
        <p className="field__label">{activePlan.name}</p>
        <p className="small">{links.length === 0 ? "Todavía no has generado ningún enlace." : `${links.filter((link) => !link.revokedAt).length} enlace(s) activo(s).`}</p>
      </div>

      <ShareLinkManager planId={activePlan.id} initialLinks={links.map((link) => ({ id: link.id, createdAt: link.createdAt.toISOString(), revoked: Boolean(link.revokedAt) }))} />
    </AppShell>
  );
}
