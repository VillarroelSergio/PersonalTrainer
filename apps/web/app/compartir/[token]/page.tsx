import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { previewSharedRoutine, ShareLinkNotFoundError } from "@/features/planning/domain/share-repository";
import { CopySharedRoutineButton } from "@/features/planning/ui/CopySharedRoutineButton";

export default async function SharedRoutinePreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  let preview;
  try {
    preview = await previewSharedRoutine(db, token);
  } catch (cause) {
    if (cause instanceof ShareLinkNotFoundError) {
      return (
        <main id="mainContent" className="view-share">
          <h1 className="view-title">Enlace no disponible</h1>
          <p className="lede">Este enlace no existe o ya no está disponible.</p>
        </main>
      );
    }
    throw cause;
  }

  return (
    <main id="mainContent" className="view-share">
      <h1 className="view-title">{preview.planName}</h1>
      <p className="lede small">Vas a crear una copia independiente. Empezarás con tu propio registro: esta copia no incluye cargas ni historial de quien la compartió, y sus cambios posteriores no te afectarán.</p>

      <div className="refblock">
        <p className="field__label">Bloque inicial</p>
        <p className="small">{preview.initialBlock?.name ?? "Sin bloque inicial"} · {preview.initialBlock?.weeks ?? 0} semanas</p>
        <p className="field__label">Sesiones por semana</p>
        <p className="small">{preview.sessionCount}</p>
      </div>

      {session?.user ? (
        <CopySharedRoutineButton token={token} />
      ) : (
        <Link href={`/login?next=/compartir/${token}`} className="btn btn--primary btn--block">Inicia sesión para copiarla</Link>
      )}
    </main>
  );
}
