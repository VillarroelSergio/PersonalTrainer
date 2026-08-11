import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { db, sqlite } from "@/lib/db/client";
import { EXERCISE_CATALOG, findVariant, type MuscleGroup } from "@/features/catalog/data/exercise-catalog";
import { listOwnedFavoriteVariantIds } from "@/features/catalog/domain/favorite-repository";
import { FavoriteToggle } from "@/features/catalog/ui/FavoriteToggle";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { AppShell } from "@/components/AppShell";

const MUSCLE_GROUP_LABEL: Record<MuscleGroup, string> = { piernas: "Piernas", espalda: "Espalda", pecho: "Pecho", hombros: "Hombros", core: "Core", brazos: "Brazos" };
const MUSCLE_GROUP_IMAGE: Record<MuscleGroup, string> = { piernas: "cuadriceps-card-v1.webp", espalda: "espalda-card-v1.webp", pecho: "pecho-card-v1.webp", hombros: "hombros-card-v1.webp", core: "core-card-v1.webp", brazos: "biceps-card-v1.webp" };

export default async function EjerciciosPage({ searchParams }: { searchParams: Promise<{ grupo?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const favoriteIds = new Set(await listOwnedFavoriteVariantIds(db, session.user.id));
  const workoutRepo = createWorkoutSessionRepository(db, sqlite);
  const recentVariants = workoutRepo.listRecentVariantIds(session.user.id, 5).map(findVariant).filter((variant) => variant != null);
  const groups = (Object.keys(MUSCLE_GROUP_LABEL) as MuscleGroup[]).filter((group) => EXERCISE_CATALOG.some((variant) => variant.primaryMuscleGroup === group));
  const { grupo } = await searchParams;
  const selected = grupo && groups.includes(grupo as MuscleGroup) ? (grupo as MuscleGroup) : null;

  return (
    <AppShell title="Trainer">
      <h1 className="view-title">Ejercicios</h1>
      <p className="lede small">Busca por grupo muscular. No modelamos el inventario exacto de tu gimnasio.</p>

      {!selected && recentVariants.length > 0 ? (
        <>
          <p className="field__label">Recientes</p>
          <ul className="catalog-list">
            {recentVariants.map((variant) => (
              <li key={variant.id} className="catalog-card">
                <div className="catalog-card__top">
                  <div className="catalog-card__body">
                    <Link href={`/ejercicios/${variant.id}`} className="catalog-card__name">{variant.exerciseName} — {variant.variantName}</Link>
                  </div>
                  <FavoriteToggle variantId={variant.id} initialFavorite={favoriteIds.has(variant.id)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {!selected ? (
        <>
          <p className="field__label">Grupos musculares</p>
          <div className="musclegrid">
            {groups.map((group) => {
              const count = EXERCISE_CATALOG.filter((variant) => variant.primaryMuscleGroup === group).length;
              return (
                <Link key={group} href={`/ejercicios?grupo=${group}`} className="opt musclecard" aria-label={`Ver ejercicios de ${MUSCLE_GROUP_LABEL[group]}`}>
                  <span className="musclecard__media">
                    <Image className="musclecard__img" src={`/library/groups/${MUSCLE_GROUP_IMAGE[group]}`} alt="" aria-hidden="true" width={240} height={300} />
                  </span>
                  <span className="musclecard__body">
                    <span className="musclecard__name">{MUSCLE_GROUP_LABEL[group]}</span>
                    <span className="musclecard__meta">{count} {count === 1 ? "ejercicio" : "ejercicios"}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <Link href="/ejercicios" className="chip">← Accesos rápidos</Link>
          <p className="section-title">{MUSCLE_GROUP_LABEL[selected]}</p>
          <ul className="catalog-list">
            {EXERCISE_CATALOG.filter((variant) => variant.primaryMuscleGroup === selected).map((variant) => (
              <li key={variant.id} className="catalog-card">
                <div className="catalog-card__top">
                  <div className="catalog-card__body">
                    <Link href={`/ejercicios/${variant.id}`} className="catalog-card__name">{variant.exerciseName} — {variant.variantName}</Link>
                    <p className="catalog-card__meta">{variant.guide}</p>
                  </div>
                  <FavoriteToggle variantId={variant.id} initialFavorite={favoriteIds.has(variant.id)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
