import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { exerciseMediaAlt, exerciseMediaSrc, findVariant, MUSCLE_GROUP_IMAGE, MUSCLE_GROUP_LABEL } from "@/features/catalog/data/exercise-catalog";
import { listOwnedFavoriteVariantIds } from "@/features/catalog/domain/favorite-repository";
import { FavoriteToggle } from "@/features/catalog/ui/FavoriteToggle";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { youtubeSearchUrl } from "@/features/catalog/domain/video-link";
import { AppShell } from "@/components/AppShell";

export default async function ExerciseVariantPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const variant = findVariant(id);
  if (!variant) notFound();

  const favoriteIds = new Set(await listOwnedFavoriteVariantIds(getDb(), session.user.id));
  const workoutRepo = createWorkoutSessionRepository(getDb());
  const baseline = await workoutRepo.getBaseline(session.user.id, id);

  const summary = baseline?.summaryJson ? JSON.parse(baseline.summaryJson) as { lastLoadKg: number | null; lastRepetitions: number | null } : null;

  return (
    <AppShell title="Trainer" backHref="/ejercicios">
      <h1 className="view-title">{variant.exerciseName} — {variant.variantName}</h1>

      <div className="exercise-media">
        <Image
          className="exercise-media__img"
          src={exerciseMediaSrc(variant)}
          alt={exerciseMediaAlt(variant)}
          width={320}
          height={400}
        />
      </div>

      <div className="tags" aria-label="Músculos implicados">
        <span className="tag">{MUSCLE_GROUP_LABEL[variant.primaryMuscleGroup]} · principal</span>
        {variant.secondaryMuscleGroups?.map((group) => (
          <span key={group} className="tag tag--muted">{MUSCLE_GROUP_LABEL[group]} · secundario</span>
        ))}
      </div>

      <h2 className="section-title">Guía breve</h2>
      <p className="lede small">{variant.guide}</p>

      <h2 className="section-title">Último rendimiento</h2>
      {summary ? (
        <p className="lede small">
          {summary.lastLoadKg != null ? `${summary.lastLoadKg} kg × ${summary.lastRepetitions} reps` : "Sin carga registrada (peso corporal)."}
        </p>
      ) : (
        <p className="lede small">Aún sin historial para esta variante.</p>
      )}

      <div className="dayrow__actions">
        <FavoriteToggle variantId={variant.id} initialFavorite={favoriteIds.has(variant.id)} compact />
        <a href={youtubeSearchUrl(variant.exerciseName, variant.variantName)} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">
          Buscar en YouTube (externo)
        </a>
      </div>

      <Link href={`/ejercicios?grupo=${variant.primaryMuscleGroup}`} className="back-btn" aria-label={`Volver a ${MUSCLE_GROUP_LABEL[variant.primaryMuscleGroup]}`} style={{ marginTop: 20 }}>
        ←
      </Link>
    </AppShell>
  );
}
