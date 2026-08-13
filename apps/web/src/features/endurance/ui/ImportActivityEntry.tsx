import Link from "next/link";

/** Shared with the empty state (no session today) and a real session — same copy/markup as prototype's buildImportEntry. */
export function ImportActivityEntry({ sessionIndex }: { sessionIndex?: number }) {
  return (
    <div className="endurance-import-entry">
      <Link href={sessionIndex != null ? `/importar?session=${sessionIndex}` : "/importar"} className="btn btn--ghost btn--block">Importar actividad</Link>
      <p className="lede small">Admite .FIT, .TCX y .GPX de tu reloj. Trainer nunca crea ni envía nada al dispositivo: la actividad la haces fuera de la app y la importas después.</p>
    </div>
  );
}
