"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { EXERCISE_CATALOG, exerciseMediaAlt, exerciseMediaSrc, findVariant, MUSCLE_GROUP_LABEL, type ExerciseVariant } from "@/features/catalog/data/exercise-catalog";
import { createClientId } from "@/lib/client-id";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { useOfflineSyncContext } from "@/lib/offline/OfflineSyncContext";
import { finishWorkoutOffline, recordSetOffline, removeSetOffline, startWorkoutOffline, substituteVariantOffline } from "@/features/workouts/domain/workout-offline";
import { DISCOMFORT_ZONE_OPTIONS } from "@/features/onboarding/presentation/constants";
import type { DiscomfortZone } from "@/features/onboarding/presentation/types";
import { MOLESTIA_OPTIONS, type MolestiaLevel } from "@/features/training-engine/domain/checkin-discomfort";
import { youtubeSearchUrl } from "@/features/catalog/domain/video-link";
import { adjustRestSeconds, isRestComplete, remainingRestSeconds } from "@/features/workouts/domain/rest-timer";
import type { ExerciseTrackingMode } from "@/features/catalog/domain/editorial-content";
import type { TrainingBlock } from "@/features/catalog/domain/training-block";
import { findMobilityExercise } from "@/features/catalog/data/mobility-catalog";
import { sessionBlockLabel } from "@/features/catalog/data/session-blocks";

type PreviewExercise = { variantId: string; targetSets: number; targetRepsMin: number; targetRepsMax: number };
type PersistedSet = { setNumber: number; loadKg: number | null; repetitions: number | null; difficulty: Difficulty | null };
type SessionExercise = { id: string; variantId: string; position: number; status: string; targetSets: number; targetRepsMin: number; targetRepsMax: number; sets?: PersistedSet[] };
type WorkoutSession = { id: string; status: string; version: number };
type Difficulty = "too_easy" | "just_right" | "too_hard";
type CloseStatus = "completed" | "adapted" | "partial";

export function showLoadInput(trackingMode: ExerciseTrackingMode | undefined): boolean {
  return trackingMode !== "reps_only";
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { too_easy: "Fácil", just_right: "Justa", too_hard: "Demasiado dura" };
const DEFAULT_REST_SECONDS = 90;

function objetivoText(exercise: PreviewExercise | SessionExercise): string {
  return `${exercise.targetSets} series de ${exercise.targetRepsMin}-${exercise.targetRepsMax} repeticiones`;
}

export function WorkoutRunner({
  planId,
  sessionIndex,
  previewExercises,
  previewBlocks,
  favoriteVariantIds,
  recentVariantIds,
  autoStart = false
}: {
  planId: string;
  sessionIndex: number;
  previewExercises: PreviewExercise[];
  previewBlocks: TrainingBlock[];
  favoriteVariantIds: string[];
  recentVariantIds: string[];
  autoStart?: boolean;
}) {
  const router = useRouter();
  const offlineData = useOfflineData();
  const sync = useOfflineSyncContext();
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const [exerciseStats, setExerciseStats] = useState<Record<string, { total: number; done: number }>>({});
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  const [restLabel, setRestLabel] = useState<string | null>(null);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restNow, setRestNow] = useState(() => Date.now());
  const restRemaining = restEndsAt === null ? null : remainingRestSeconds(restEndsAt, restNow);

  useEffect(() => {
    if (restEndsAt === null) return;
    const tick = () => {
      const now = Date.now();
      setRestNow(now);
      if (isRestComplete(restEndsAt, now)) {
        setRestEndsAt(null);
        setRestLabel(null);
      }
    };
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [restEndsAt]);

  // El descanso solo tiene sentido entre series de una sesión activa: se detiene y
  // oculta en cuanto se pasa a cerrar la sesión, para no seguir corriendo tras terminar.
  useEffect(() => {
    if (closing) {
      setRestEndsAt(null);
      setRestLabel(null);
    }
  }, [closing]);

  useEffect(() => {
    if (autoStart) startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  function reportStats(exerciseId: string, stats: { total: number; done: number }) {
    setExerciseStats((current) => ({ ...current, [exerciseId]: stats }));
  }

  function onSetConfirmed(label: string) {
    setRestLabel(label);
    setRestNow(Date.now());
    setRestEndsAt((current) => current ?? Date.now() + restSeconds * 1_000);
  }

  async function startSession() {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/workouts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, sessionIndex })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "No pudimos iniciar la sesión.");
      setWorkout(body.data.workoutSession);
      setExercises(body.data.sessionExercises);
    } catch (cause) {
      if (offlineData.snapshot) {
        // No coverage: no network — start the session locally from the preview so the
        // person can keep training; the outbox reconciles it with a real server id later.
        const previewSessionExercises: SessionExercise[] = previewExercises.map((exercise, index) => ({
          id: `local-exercise-${index + 1}`,
          variantId: exercise.variantId,
          position: index,
          status: "pending",
          targetSets: exercise.targetSets,
          targetRepsMin: exercise.targetRepsMin,
          targetRepsMax: exercise.targetRepsMax
        }));
        const started = startWorkoutOffline(offlineData.snapshot, { planId, sessionIndex }, createClientId);
        offlineData.applyLocalMutation(started.snapshot.data);
        await sync.enqueue(started.operation);
        setWorkout(started.session);
        setExercises(previewSessionExercises);
      } else {
        setError(cause instanceof Error ? cause.message : "No pudimos iniciar la sesión.");
      }
    } finally {
      setStarting(false);
    }
  }

  if (error && !workout) return <p className="notice notice--warn" role="alert">{error}</p>;

  // P0-1: vista previa de la sesión (prototype/js/views/strength.js drawList) — la
  // sesión real solo se crea (POST /api/v1/workouts) al pulsar "Empezar sesión".
  if (!workout) {
    const setsTotal = previewExercises.reduce((sum, exercise) => sum + exercise.targetSets, 0);
    return (
      <section className="view-strength view-strength--preview">
        <div className="session-meter">
          <div className="meter" role="img" aria-label="Progreso de la sesión: 0 por ciento de las series registradas">
            <div className="meter__fill" style={{ width: "0%" }} />
          </div>
          <p className="meter__text">0 de {previewExercises.length} ejercicios · 0 de {setsTotal} series</p>
        </div>

        <SessionBlocks blocks={previewBlocks} />

        <ol className="exlist">
          {previewExercises.map((exercise, index) => {
            const variant = findVariant(exercise.variantId);
            const previewImage = variant ? exerciseMediaSrc(variant) : null;
            return (
              <li key={exercise.variantId + index}>
                <div className="exrow">
                  <span className="exrow__index">{index + 1}</span>
                  {previewImage ? (
                    <span className="exrow__thumb" aria-hidden="true">
                      <Image src={previewImage} alt={variant ? exerciseMediaAlt(variant) : "Ejercicio"} width={44} height={44} />
                    </span>
                  ) : (
                    <span className="exrow__thumb" aria-hidden="true">
                      <Image src="/library/groups/core-card-v1.webp" alt={`Ejercicio ${exercise.variantId}`} width={44} height={44} />
                    </span>
                  )}
                  <span className="exrow__body">
                    <span className="exrow__name">{variant ? `${variant.exerciseName} — ${variant.variantName}` : exercise.variantId}</span>
                    <span className="exrow__meta">{objetivoText(exercise)}</span>
                  </span>
                  <span className="exrow__sets">
                    {Array.from({ length: exercise.targetSets }, (_, setIndex) => <span key={setIndex} className="exrow__pip" />)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {error ? <p className="notice notice--warn" role="alert">{error}</p> : null}
        <button type="button" className="btn btn--primary btn--block session-preview__start" disabled={starting} onClick={startSession}>
          {starting ? "Preparando…" : "Empezar sesión"}
        </button>
      </section>
    );
  }

  const statsValues = Object.values(exerciseStats);
  const setsTotal = statsValues.reduce((sum, stat) => sum + stat.total, 0);
  const setsDone = statsValues.reduce((sum, stat) => sum + stat.done, 0);
  const exDone = statsValues.filter((stat) => stat.total > 0 && stat.done === stat.total).length;
  const pct = setsTotal ? Math.round((setsDone / setsTotal) * 100) : 0;

  return (
    <section className={"view-strength view-exercise" + (closing ? " is-closing" : "")}>
      <SessionBlocks blocks={previewBlocks} />
      {exercises.map((exercise) => (
        <ExerciseCard
          key={exercise.id}
          workoutId={workout.id}
          exercise={exercise}
          favoriteVariantIds={favoriteVariantIds}
          recentVariantIds={recentVariantIds}
          onSubstitute={(replacement) => setExercises((current) => current.map((item) => (item.id === exercise.id ? replacement : item)))}
          onStats={reportStats}
          onSetConfirmed={onSetConfirmed}
        />
      ))}

      {!closing ? (
        <button type="button" className="btn btn--primary btn--block" onClick={() => setClosing(true)}>Terminar sesión</button>
      ) : (
        <CloseForm workoutId={workout.id} baseVersion={workout.version} onClosed={() => router.push("/hoy")} />
      )}

      {/* Barra persistente (prototype mountSessionBar/buildRestWidget): única fuente de
          progreso + descanso visible durante la sesión activa; se oculta al cerrar para
          no duplicar el resumen del cierre ni dejar el temporizador corriendo. */}
      {!closing ? (
        <div className="sessionbar" role="region" aria-label={`Progreso de la sesión: ${pct} por ciento de las series registradas`}>
          <div className="sessionbar__top">
            <div className="sessionbar__meta">
              <p className="sessionbar__progress">{setsDone} de {setsTotal} series</p>
              <p className="sessionbar__current">{exDone} de {exercises.length} ejercicios completos</p>
            </div>
            <div className="sessionbar__fill" style={{ width: `${pct}%` }} aria-hidden="true" />
          </div>
          {restLabel ? (
            <div className="sessionbar__rest">
              <span className="sessionbar__clock" aria-live="polite">{formatClock(restRemaining ?? restSeconds)}</span>
              <span className="sessionbar__restlabel">{restRemaining !== null ? `Descansando · ${restLabel}` : `Descanso terminado · ${restLabel}`}</span>
              <div className="sessionbar__restedit" aria-label="Ajustar próximo descanso">
                <button type="button" className="sessionbar__reststep" onClick={() => setRestSeconds((value) => adjustRestSeconds(value, -15))} aria-label="Restar 15 segundos">−15</button>
                <span>{restSeconds}s</span>
                <button type="button" className="sessionbar__reststep" onClick={() => setRestSeconds((value) => adjustRestSeconds(value, 15))} aria-label="Sumar 15 segundos">+15</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SessionBlocks({ blocks }: { blocks: TrainingBlock[] }) {
  if (blocks.length === 0) return null;
  return (
    <section className="session-blocks" aria-label="Preparación y cierre de la sesión">
      <div className="session-blocks__heading"><div><p className="session-blocks__eyebrow">Añadido a esta sesión</p><h2 className="session-blocks__title">Preparación y cierre</h2></div><span className="session-blocks__meta">Opcional</span></div>
      <div className="session-blocks__list">
        {blocks.map((block) => {
          const exercises = (block.variantIds ?? []).map(findMobilityExercise).filter((item): item is NonNullable<typeof item> => Boolean(item));
          return (
            <article className="session-blocks__card" key={block.id}>
              <div className="session-blocks__card-heading"><strong>{sessionBlockLabel(block)}</strong><span>{block.estimatedMinutes} min</span></div>
              {exercises.length ? <div className="session-blocks__exercise-list">{exercises.map((exercise) => <div className="session-blocks__exercise" key={exercise.id}><Image src={exercise.mediaUrl} alt={`${exercise.exerciseName} — ${exercise.variantName}`} width={48} height={48} /><span><strong>{exercise.variantName}</strong><small>{exercise.metric === "seconds" ? `Tiempo · ${exercise.defaultDose}` : `Repeticiones · ${exercise.defaultDose}`}</small></span></div>)}</div> : <p>{block.instructions}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(Math.round(totalSeconds), 0);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest < 10 ? "0" : ""}${rest}`;
}

type SetRowState = { setNumber: number; loadKg: string; reps: string; difficulty: Difficulty | ""; saved: boolean };

function initialSets(targetSets: number, persisted: PersistedSet[] | undefined, trackingMode: ExerciseTrackingMode | undefined): SetRowState[] {
  const byNumber = new Map((persisted ?? []).map((set) => [set.setNumber, set]));
  const count = Math.max(targetSets, byNumber.size);
  return Array.from({ length: count }, (_, index) => {
    const setNumber = index + 1;
    const saved = byNumber.get(setNumber);
    return saved
      ? { setNumber, loadKg: showLoadInput(trackingMode) ? saved.loadKg?.toString() ?? "" : "", reps: saved.repetitions?.toString() ?? "", difficulty: saved.difficulty ?? "", saved: true }
      : { setNumber, loadKg: "", reps: "", difficulty: "", saved: false };
  });
}

function ExerciseCard({
  workoutId,
  exercise,
  favoriteVariantIds,
  recentVariantIds,
  onSubstitute,
  onStats,
  onSetConfirmed
}: {
  workoutId: string;
  exercise: SessionExercise;
  favoriteVariantIds: string[];
  recentVariantIds: string[];
  onSubstitute: (replacement: SessionExercise) => void;
  onStats: (exerciseId: string, stats: { total: number; done: number }) => void;
  onSetConfirmed: (label: string) => void;
}) {
  const variant = findVariant(exercise.variantId);
  const trackingMode = variant?.trackingMode;
  const [sets, setSets] = useState<SetRowState[]>(() => initialSets(exercise.targetSets, exercise.sets, trackingMode));

  // "Cambiar variante" reemplaza exercise (nuevo targetSets) sin desmontar la tarjeta:
  // sin este efecto, sets seguía con el conteo de la variante anterior.
  useEffect(() => {
    setSets(initialSets(exercise.targetSets, exercise.sets, trackingMode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise.variantId]);
  const [lastAction, setLastAction] = useState<{ type: "repeat" | "addSet"; setNumber: number; prev: Omit<SetRowState, "setNumber"> } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [variantSheetOpen, setVariantSheetOpen] = useState(false);
  const sync = useOfflineSyncContext();
  const offlineData = useOfflineData();

  useEffect(() => {
    onStats(exercise.id, { total: sets.length, done: sets.filter((set) => set.saved).length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, exercise.id]);

  async function persistSet(setNumber: number, loadKg: number | null, repetitions: number | null, difficulty: Difficulty | null) {
    const payload = { sessionExerciseId: exercise.id, setNumber, loadKg, repetitions, difficulty };
    const operationId = createClientId();
    try {
      const response = await fetch(`/api/v1/workouts/${workoutId}/sets`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": operationId },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("request failed");
    } catch {
      // No coverage: queue the series and mark it saved locally — the sync-pill in the header shows it as pending until it reaches the server.
      if (offlineData.snapshot) {
        const result = recordSetOffline(offlineData.snapshot, workoutId, payload, () => operationId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
      } else {
        await sync.enqueue({ id: operationId, kind: "record_set", workoutSessionId: workoutId, payload, createdAt: Date.now(), status: "pending" });
      }
    }
  }

  async function confirmSet(setNumber: number) {
    const row = sets.find((set) => set.setNumber === setNumber);
    if (!row) return;
    const loadKg = showLoadInput(trackingMode) && row.loadKg ? Number(row.loadKg) : null;
    const repetitions = row.reps ? Number(row.reps) : null;
    const difficulty = row.difficulty || null;
    await persistSet(setNumber, loadKg, repetitions, difficulty);
    setSets((current) => current.map((set) => (set.setNumber === setNumber ? { ...set, saved: true } : set)));
    onSetConfirmed(variant ? `${variant.exerciseName} — ${variant.variantName}` : exercise.variantId);
  }

  async function unconfirmSet(setNumber: number) {
    const operationId = createClientId();
    const payload = { sessionExerciseId: exercise.id, setNumber };
    try {
      const response = await fetch(`/api/v1/workouts/${workoutId}/sets`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": operationId },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("request failed");
    } catch {
      if (offlineData.snapshot) {
        const result = removeSetOffline(offlineData.snapshot, workoutId, payload, () => operationId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
      } else {
        await sync.enqueue({ id: operationId, kind: "remove_set", workoutSessionId: workoutId, payload, createdAt: Date.now(), status: "pending" });
      }
    }
    setSets((current) => current.map((set) => (set.setNumber === setNumber ? { ...set, saved: false } : set)));
  }

  function updateSet(setNumber: number, patch: Partial<SetRowState>) {
    setSets((current) => current.map((set) => (set.setNumber === setNumber ? { ...set, ...patch } : set)));
  }

  // registro-un-toque (prototype repeatLastSet): repite los valores de la última serie
  // confirmada en la siguiente serie pendiente y la confirma en un solo toque.
  async function repeatLastSet() {
    const target = sets.find((set) => !set.saved);
    if (!target) return;
    const done = sets.filter((set) => set.saved);
    if (done.length === 0) return;
    const source = done[done.length - 1];
    setLastAction({ type: "repeat", setNumber: target.setNumber, prev: { loadKg: target.loadKg, reps: target.reps, difficulty: target.difficulty, saved: target.saved } });
    const sourceLoadKg = showLoadInput(trackingMode) ? source.loadKg : "";
    setSets((current) => current.map((set) => (set.setNumber === target.setNumber ? { ...set, loadKg: sourceLoadKg, reps: source.reps, saved: true } : set)));
    await persistSet(target.setNumber, sourceLoadKg ? Number(sourceLoadKg) : null, source.reps ? Number(source.reps) : null, source.difficulty || null);
    onSetConfirmed(variant ? `${variant.exerciseName} — ${variant.variantName}` : exercise.variantId);
  }

  function addSet() {
    const last = sets[sets.length - 1];
    const setNumber = sets.length + 1;
    setLastAction({ type: "addSet", setNumber, prev: { loadKg: "", reps: "", difficulty: "", saved: false } });
    setSets((current) => [...current, { setNumber, loadKg: showLoadInput(trackingMode) ? last?.loadKg ?? "" : "", reps: last?.reps ?? "", difficulty: "", saved: false }]);
  }

  async function undo() {
    if (!lastAction) return;
    if (lastAction.type === "addSet") {
      setSets((current) => current.filter((set) => set.setNumber !== lastAction.setNumber));
    } else {
      updateSet(lastAction.setNumber, lastAction.prev);
      if (lastAction.prev.saved === false) await persistSet(lastAction.setNumber, null, null, null);
    }
    setLastAction(null);
  }

  async function substitute(newVariantId: string) {
    try {
      const response = await fetch(`/api/v1/workouts/${workoutId}/exercises/${exercise.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId: newVariantId })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "request failed");
      setVariantSheetOpen(false);
      onSubstitute(body.data);
    } catch {
      // Offline: apply the substitution locally and queue it so it reaches the server on flush.
      if (offlineData.snapshot) {
        const result = substituteVariantOffline(offlineData.snapshot, workoutId, exercise.id, newVariantId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
        if (result.exercise) {
          setVariantSheetOpen(false);
          onSubstitute(result.exercise);
        }
      }
    }
  }

  return (
    <div>
      <div className="exhead">
        {variant ? (
          <div className="exercise-media">
            <Image className="exercise-media__img" src={exerciseMediaSrc(variant)} alt={exerciseMediaAlt(variant)} width={60} height={60} />
          </div>
        ) : (
          <div className="exercise-media">
            <Image className="exercise-media__img" src="/library/groups/core-card-v1.webp" alt={`Ejercicio ${exercise.variantId}`} width={60} height={60} />
          </div>
        )}
        <div className="exhead__body">
          <p className="exhead__variant">{variant ? `${variant.exerciseName} — ${variant.variantName}` : exercise.variantId}</p>
          <p className="exhead__line">Objetivo: {objetivoText(exercise)}</p>
        </div>
      </div>

      <div className="chiprow">
        <button type="button" className="chip chip--compact" aria-disabled={!sets.some((set) => set.saved)} onClick={repeatLastSet}>Repetir</button>
        <button type="button" className="chip chip--compact" onClick={addSet}>+ Serie</button>
        <button type="button" className="chip chip--compact" aria-disabled={!lastAction} onClick={undo}>Deshacer</button>
        <button type="button" className="chip chip--compact" onClick={() => setGuideOpen(true)}>Ver guía</button>
        <button type="button" className="chip chip--compact" onClick={() => setVariantSheetOpen(true)}>Cambiar variante</button>
      </div>

      <p className="section-title">Series</p>
      <ul className="lanes">
        {sets.map((set) => (
          <SetRow key={set.setNumber} set={set} showLoad={showLoadInput(trackingMode)} onChange={(patch) => updateSet(set.setNumber, patch)} onConfirm={() => confirmSet(set.setNumber)} onUnconfirm={() => unconfirmSet(set.setNumber)} />
        ))}
      </ul>

      {guideOpen && variant ? <GuideSheet variant={variant} onClose={() => setGuideOpen(false)} /> : null}
      {variantSheetOpen ? (
        <VariantSheet
          currentVariantId={exercise.variantId}
          favoriteVariantIds={favoriteVariantIds}
          recentVariantIds={recentVariantIds}
          onPick={substitute}
          onClose={() => setVariantSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}

function SetRow({ set, showLoad, onChange, onConfirm, onUnconfirm }: { set: SetRowState; showLoad: boolean; onChange: (patch: Partial<SetRowState>) => void; onConfirm: () => void; onUnconfirm: () => void }) {
  return (
    <li className="lane__error-row">
      <div className={"lane lane--set" + (set.saved ? " is-done" : "")}>
        <span className="lane__num">{set.setNumber}</span>
        {showLoad ? (
          <span className="lane__field">
            <label htmlFor={`load-${set.setNumber}`} className="sr-only">Carga en kg</label>
            <input id={`load-${set.setNumber}`} type="number" min={0} max={500} value={set.loadKg} disabled={set.saved} onChange={(event) => onChange({ loadKg: event.target.value })} />
            <span className="lane__unit">kg</span>
          </span>
        ) : null}
        <span className="lane__field">
          <label htmlFor={`reps-${set.setNumber}`} className="sr-only">Repeticiones</label>
          <input id={`reps-${set.setNumber}`} type="number" min={0} max={100} value={set.reps} disabled={set.saved} onChange={(event) => onChange({ reps: event.target.value })} />
          <span className="lane__unit">reps</span>
        </span>
        <span className="lane__state">
          <button type="button" className={"setbtn" + (set.saved ? " is-done" : "")} onClick={() => (set.saved ? onUnconfirm() : onConfirm())}>
            {set.saved ? "Hecha ✓" : "Confirmar"}
          </button>
        </span>
      </div>
      {!set.saved ? (
        <div className="picker" role="group" aria-label={`Dificultad de la serie ${set.setNumber}`}>
          {(Object.entries(DIFFICULTY_LABEL) as Array<[Difficulty, string]>).map(([value, label]) => (
            <button key={value} type="button" className="picker__btn" aria-pressed={set.difficulty === value} onClick={() => onChange({ difficulty: set.difficulty === value ? "" : value })}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

// P1-3: guía por ejercicio (prototype openGuideSheet) — cues/músculo/vídeo reutilizando el
// catálogo (guide/primaryMuscleGroup) y el mismo enlace de búsqueda externo que /ejercicios/[id].
function GuideSheet({ variant, onClose }: { variant: ExerciseVariant; onClose: () => void }) {
  const titleId = "guideSheetTitle";
  return (
    <div className="sheet-overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className="sheet__header">
          <h2 id={titleId}>{variant.exerciseName} — {variant.variantName}</h2>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <div className="sheet__body">
          <p className="field__label">Músculo principal</p>
          <p className="lede small">{MUSCLE_GROUP_LABEL[variant.primaryMuscleGroup]}</p>
          <p className="field__label">Cómo hacerlo</p>
          <p className="lede small">{variant.guide}</p>
          <a href={youtubeSearchUrl(variant.exerciseName, variant.variantName)} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--block">
            Buscar vídeo en YouTube ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// P1-6: hoja de variante categorizada (prototype openVariantSheet) en vez de un <select>
// plano — Favoritas/Recientes ya se leen igual que en /ejercicios, Mismo patrón y Catálogo
// se derivan del propio EXERCISE_CATALOG.
function VariantSheet({
  currentVariantId,
  favoriteVariantIds,
  recentVariantIds,
  onPick,
  onClose
}: {
  currentVariantId: string;
  favoriteVariantIds: string[];
  recentVariantIds: string[];
  onPick: (variantId: string) => void;
  onClose: () => void;
}) {
  const current = findVariant(currentVariantId);
  const titleId = "variantSheetTitle";
  const shown = new Set<string>([currentVariantId]);

  function takeGroup(ids: string[]): ExerciseVariant[] {
    const result: ExerciseVariant[] = [];
    for (const id of ids) {
      if (shown.has(id)) continue;
      const found = findVariant(id);
      if (!found) continue;
      shown.add(id);
      result.push(found);
    }
    return result;
  }

  const favoritas = takeGroup(favoriteVariantIds);
  const recientes = takeGroup(recentVariantIds);
  const mismoPatron = current ? takeGroup(EXERCISE_CATALOG.filter((item) => item.movementPattern === current.movementPattern).map((item) => item.id)) : [];
  const catalogo = takeGroup(EXERCISE_CATALOG.map((item) => item.id));

  const groups: Array<{ title: string; items: ExerciseVariant[] }> = [
    { title: "Favoritas", items: favoritas },
    { title: "Usadas recientemente", items: recientes },
    { title: "Mismo patrón", items: mismoPatron },
    { title: "Catálogo general", items: catalogo }
  ];

  return (
    <div className="sheet-overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className="sheet__header">
          <h2 id={titleId}>Cambiar variante</h2>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <div className="sheet__body">
          <p className="lede small">El registro que hagas a partir de ahora se guarda con la variante realmente usada.</p>
          {groups.map((group) =>
            group.items.length ? (
              <div className="optgroup" key={group.title}>
                <p className="optgroup__title">{group.title}</p>
                {group.items.map((item) => (
                  <button key={item.id} type="button" className="opt" onClick={() => onPick(item.id)}>
                    <Image className="opt__media" src={exerciseMediaSrc(item)} alt="" width={44} height={44} />
                    <span className="opt__name">{item.exerciseName} — {item.variantName}</span>
                  </button>
                ))}
              </div>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

function CloseForm({ workoutId, baseVersion, onClosed }: { workoutId: string; baseVersion: number; onClosed: () => void }) {
  const [status, setStatus] = useState<CloseStatus>("completed");
  const [globalEffort, setGlobalEffort] = useState(5);
  const [molestiaLevel, setMolestiaLevel] = useState<MolestiaLevel>("none");
  const [zone, setZone] = useState<DiscomfortZone>("back");
  const [error, setError] = useState<string | null>(null);
  const sync = useOfflineSyncContext();
  const offlineData = useOfflineData();

  async function submit() {
    const operationId = createClientId();
    const discomfort = molestiaLevel === "none" ? null : { zone, intensity: molestiaLevel };
    const payload = { status, globalEffort, comment: null, discomfort };
    try {
      const response = await fetch(`/api/v1/workouts/${workoutId}/finish`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": operationId },
        body: JSON.stringify({ clientOperationId: operationId, baseVersion, ...payload })
      });
      if (response.ok) {
        onClosed();
        return;
      }
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "No pudimos cerrar la sesión.");
    } catch {
      // No coverage: the close queues and applies once back online. Leaving the screen now is safe — the outbox owns delivery, and a version conflict (someone else closed it first) surfaces in the sync-pill, never silently.
      if (offlineData.snapshot) {
        const result = finishWorkoutOffline(offlineData.snapshot, workoutId, baseVersion, payload, () => operationId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
      } else {
        await sync.enqueue({ id: operationId, kind: "finish_workout", workoutSessionId: workoutId, baseVersion, payload, createdAt: Date.now(), status: "pending" });
      }
      onClosed();
    }
  }

  const statusLabel: Record<CloseStatus, string> = { completed: "Completa", adapted: "Adaptada", partial: "Parcial" };

  return (
    <section aria-label="Cerrar sesión">
      {error ? <p className="notice notice--warn" role="alert">{error}</p> : null}

      <div className={"closesummary" + (status === "partial" ? " closesummary--partial" : "")}>
        <p className="closesummary__head">{status === "completed" ? "Sesión completada" : status === "adapted" ? "Sesión adaptada" : "Se guardará como parcial"}</p>
      </div>

      <p className="field__label">¿Cómo terminó la sesión?</p>
      <div className="picker picker--wide" role="group" aria-label="Estado de cierre">
        {(["completed", "adapted", "partial"] as const).map((value) => (
          <button key={value} type="button" className="picker__btn" aria-pressed={status === value} onClick={() => setStatus(value)}>
            {statusLabel[value]}
          </button>
        ))}
      </div>

      <div className="field">
        <p className="field__label" id="global-effort-label">Esfuerzo global</p>
        <div className="effort-picker" role="group" aria-labelledby="global-effort-label">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              type="button"
              className="effort-picker__value"
              aria-pressed={globalEffort === value}
              aria-label={`Esfuerzo ${value} de 10`}
              onClick={() => setGlobalEffort(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {/* P1-7: picker de 4 niveles (Ninguna/Leve/Moderada/Importante), mismo patrón que /checkin
          (CheckinRunner.tsx), en vez del checkbox + selects anterior. */}
      <div className="field">
        <p className="field__label">Molestias al cerrar (opcional)</p>
        <div className="picker picker--wide" role="group" aria-label="Molestias al cerrar">
          {MOLESTIA_OPTIONS.map((option) => (
            <button key={option.value} type="button" className="picker__btn" aria-pressed={molestiaLevel === option.value} onClick={() => setMolestiaLevel(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {molestiaLevel !== "none" ? (
        <div className="field">
          <p className="field__label">Zona aproximada</p>
          <div className="picker picker--compact" role="group" aria-label="Zona aproximada de molestia">
            {DISCOMFORT_ZONE_OPTIONS.map((option) => (
              <button key={option.value} type="button" className="picker__btn" aria-pressed={zone === option.value} onClick={() => setZone(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {molestiaLevel === "important" ? (
        <p className="notice notice--warn" role="alert">
          Molestia importante: esto no es un diagnóstico. Si la molestia persiste o es intensa, considera detener o adaptar la sesión y consultar a un profesional de salud.
        </p>
      ) : null}

      <button type="button" className="btn btn--primary btn--block" onClick={submit}>Guardar sesión</button>
    </section>
  );
}
