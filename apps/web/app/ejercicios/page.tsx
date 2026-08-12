import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { db, sqlite } from "@/lib/db/client";
import { EXERCISE_CATALOG, findVariant, MUSCLE_GROUPS, MUSCLE_GROUP_LABEL, MUSCLE_GROUP_IMAGE, type MuscleGroup, type ExerciseVariant } from "@/features/catalog/data/exercise-catalog";
import { listOwnedFavoriteVariantIds } from "@/features/catalog/domain/favorite-repository";
import { FavoriteToggle } from "@/features/catalog/ui/FavoriteToggle";
import { createWorkoutSessionRepository } from "@/features/workouts/domain/workout-session-repository";
import { AppShell } from "@/components/AppShell";

function ExerciseListItem({ variant, isFavorite }: { variant: ExerciseVariant; isFavorite: boolean }) {
  return (
    <li className="catalog-card">
      <div className="catalog-card__top">
        <Link href={`/ejercicios/${variant.id}`} aria-hidden="true" tabIndex={-1} className={`catalog-card__thumb${variant.mediaUrl ? "" : " catalog-card__thumb--pending"}`}>
          {variant.mediaUrl ? (
            <Image className="catalog-card__thumb-img" src={variant.mediaUrl} alt="" width={52} height={52} />
          ) : (
            <span className="catalog-card__thumb-pending">Próx.</span>
          )}
        </Link>
        <div className="catalog-card__body">
          <Link href={`/ejercicios/${variant.id}`} className="catalog-card__name">{variant.exerciseName} — {variant.variantName}</Link>
          <p className="catalog-card__group">{MUSCLE_GROUP_LABEL[variant.primaryMuscleGroup]}</p>
          {variant.secondaryMuscleGroups?.length ? (
            <p className="catalog-card__secondary">
              + {variant.secondaryMuscleGroups.map((group) => MUSCLE_GROUP_LABEL[group]).join(", ")}
            </p>
          ) : null}
          <p className="catalog-card__meta">{variant.guide}</p>
        </div>
        <FavoriteToggle variantId={variant.id} initialFavorite={isFavorite} compact />
      </div>
    </li>
  );
}

export default async function EjerciciosPage({ searchParams }: { searchParams: Promise<{ grupo?: string; q?: string; favoritos?: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const favoriteIds = new Set(await listOwnedFavoriteVariantIds(db, session.user.id));
  const workoutRepo = createWorkoutSessionRepository(db, sqlite);
  const recentVariants = workoutRepo.listRecentVariantIds(session.user.id, 5).map(findVariant).filter((variant): variant is ExerciseVariant => variant != null);
  const { grupo, q, favoritos } = await searchParams;
  const query = q?.trim().toLocaleLowerCase("es") ?? "";
  const showFavorites = favoritos === "1";
  const selected = grupo && MUSCLE_GROUPS.includes(grupo as MuscleGroup) ? (grupo as MuscleGroup) : null;

  let results = EXERCISE_CATALOG;
  if (selected) results = results.filter((variant) => variant.primaryMuscleGroup === selected);
  if (showFavorites) results = results.filter((variant) => favoriteIds.has(variant.id));
  if (query) results = results.filter((variant) => `${variant.exerciseName} ${variant.variantName}`.toLocaleLowerCase("es").includes(query));
  const isFiltering = Boolean(selected || showFavorites || query);
  // Corrección: el buscador es un <form method="get"> independiente de los chips de
  // filtro (grupo/favoritos), así que escribir una búsqueda perdía silenciosamente
  // el filtro activo. Ahora el grupo/favoritos activo viaja como input oculto dentro
  // del propio formulario de búsqueda.
  const clearSearchParams = new URLSearchParams();
  if (selected) clearSearchParams.set("grupo", selected);
  if (showFavorites) clearSearchParams.set("favoritos", "1");
  const clearSearchQuery = clearSearchParams.toString();

  return (
    <AppShell title="Trainer">
      <h1 className="view-title">Ejercicios</h1>
      <p className="lede small">Busca por grupo muscular. No modelamos el inventario exacto de tu gimnasio.</p>

      <form className="searchbar" action="/ejercicios" method="get" role="search">
        <svg className="searchbar__icon" width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <label className="sr-only" htmlFor="exerciseSearch">Buscar ejercicio o variante</label>
        <input id="exerciseSearch" name="q" type="search" defaultValue={q ?? ""} placeholder="Buscar ejercicio o variante" className="searchbar__input" />
        {selected ? <input type="hidden" name="grupo" value={selected} /> : null}
        {showFavorites ? <input type="hidden" name="favoritos" value="1" /> : null}
        {q ? (
          <Link href={`/ejercicios${clearSearchQuery ? `?${clearSearchQuery}` : ""}`} className="searchbar__clear" aria-label="Borrar búsqueda">✕</Link>
        ) : null}
      </form>

      <div className="dayrow__actions" style={{ marginBottom: 12 }}>
        {!showFavorites ? (
          <Link href={`/ejercicios?favoritos=1${selected ? `&grupo=${selected}` : ""}${query ? `&q=${encodeURIComponent(q ?? "")}` : ""}`} className="chip chip--compact">☆ Favoritos</Link>
        ) : (
          <Link href="/ejercicios" className="chip chip--compact" aria-pressed="true">★ Favoritos</Link>
        )}
        {isFiltering ? <Link href="/ejercicios" className="chip chip--compact">Ver todos</Link> : null}
      </div>

      {!isFiltering && recentVariants.length > 0 ? (
        <>
          <p className="field__label">Recientes</p>
          <ul className="catalog-list">
            {recentVariants.map((variant) => <ExerciseListItem key={variant.id} variant={variant} isFavorite={favoriteIds.has(variant.id)} />)}
          </ul>
        </>
      ) : null}

      {!isFiltering ? (
        <>
          <p className="field__label">Grupos musculares</p>
          <div className="musclegrid">
            {MUSCLE_GROUPS.map((group) => {
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
          <p className="section-title">{selected ? MUSCLE_GROUP_LABEL[selected] : showFavorites ? "Favoritos" : `Resultados para «${q}»`}</p>
          {results.length === 0 ? (
            <p className="lede small">Todavía no hay ejercicios aquí.</p>
          ) : (
            <ul className="catalog-list">
              {results.map((variant) => <ExerciseListItem key={variant.id} variant={variant} isFavorite={favoriteIds.has(variant.id)} />)}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}
