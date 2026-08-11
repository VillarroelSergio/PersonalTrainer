import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { db, sqlite } from "@/lib/db/client";
import { findVariant, type MuscleGroup } from "@/features/catalog/data/exercise-catalog";
import { listOwnedFavoriteVariantIds } from "@/features/catalog/domain/favorite-repository";
import { FavoriteToggle } from "@/features/catalog/ui/FavoriteToggle";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { youtubeSearchUrl } from "@/features/catalog/domain/video-link";
import { AppShell } from "@/components/AppShell";

const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = { piernas: "Piernas", espalda: "Espalda", pecho: "Pecho", hombros: "Hombros", core: "Core", brazos: "Brazos" };
const MUSCLE_GROUP_IMAGE: Record<MuscleGroup, string> = { piernas: "cuadriceps-card-v1.webp", espalda: "espalda-card-v1.webp", pecho: "pecho-card-v1.webp", hombros: "hombros-card-v1.webp", core: "core-card-v1.webp", brazos: "biceps-card-v1.webp" };

export default async function ExerciseVariantPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const variant = findVariant(id);
  if (!variant) notFound();

  const favoriteIds = new Set(await listOwnedFavoriteVariantIds(db, session.user.id));
  const workoutRepo = createWorkoutSessionRepository(db, sqlite);
  const baseline = workoutRepo.getBaseline(session.user.id, id);

  // Real illustration for this exact variant when we have one (Bloqueante 5); the muscle-group
  // illustration is an honest fallback (a real photo/drawing, never an abstract icon), not a guess
  // at this specific variant's technique.
  const imageSrc = variant.mediaUrl ?? `/library/groups/${MUSCLE_GROUP_IMAGE[variant.primaryMuscleGroup]}`;

  return (
    <AppShell title="Trainer" backHref="/ejercicios">
      <p className="kicker">{MUSCLE_GROUP_LABEL[variant.primaryMuscleGroup]}</p>
      <h1 className="view-title">{variant.exerciseName} — {variant.variantName}</h1>

      <Image className="catalog-card__thumb" src={imageSrc} alt="" width={320} height={400} style={{ width: "100%", height: "auto", borderRadius: "var(--r-md)" }} />

      <h2 className="section-title">Músculo principal</h2>
      <p className="lede small">{MUSCLE_GROUP_LABEL[variant.primaryMuscleGroup]}</p>

      <h2 className="section-title">Guía breve</h2>
      <p className="lede small">{variant.guide}</p>

      <h2 className="section-title">Último rendimiento</h2>
      {baseline ? (
        <p className="lede small">
          {baseline.summaryJson ? JSON.parse(baseline.summaryJson).lastLoadKg != null ? `${JSON.parse(baseline.summaryJson).lastLoadKg} kg × ${JSON.parse(baseline.summaryJson).lastRepetitions} reps` : "Sin carga registrada (peso corporal)." : "Sin historial todavía."}
        </p>
      ) : (
        <p className="lede small">Aún sin historial para esta variante.</p>
      )}

      <div className="dayrow__actions">
        <FavoriteToggle variantId={variant.id} initialFavorite={favoriteIds.has(variant.id)} />
        <a href={youtubeSearchUrl(variant.exerciseName, variant.variantName)} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">
          Buscar en YouTube (externo)
        </a>
      </div>

      <p className="lede small">
        <Link href={`/ejercicios?grupo=${variant.primaryMuscleGroup}`}>← Volver a {MUSCLE_GROUP_LABEL[variant.primaryMuscleGroup]}</Link>
      </p>
    </AppShell>
  );
}
