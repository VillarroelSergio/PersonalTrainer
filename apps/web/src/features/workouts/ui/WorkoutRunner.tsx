"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EXERCISE_CATALOG, findVariant } from "@/features/catalog/data/exercise-catalog";
import { useOfflineSyncContext } from "@/lib/offline/OfflineSyncContext";

type SessionExercise = { id: string; variantId: string; position: number; status: string; targetSets: number; targetRepsMin: number; targetRepsMax: number };
type WorkoutSession = { id: string; status: string; version: number };
type Difficulty = "too_easy" | "just_right" | "too_hard";
type CloseStatus = "completed" | "adapted" | "partial";

const DIFFICULTY_LABEL: Record<Difficulty, string> = { too_easy: "Fácil", just_right: "Justa", too_hard: "Demasiado dura" };

export function WorkoutRunner({ planId, sessionIndex }: { planId: string; sessionIndex: number }) {
  const router = useRouter();
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<SessionExercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restSeconds, setRestSeconds] = useState(90);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    fetch("/api/v1/workouts", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ planId, sessionIndex }) })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? "No pudimos iniciar la sesión.");
        setWorkout(body.data.workoutSession);
        setExercises(body.data.sessionExercises);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "No pudimos iniciar la sesión."));
  }, [planId, sessionIndex]);

  useEffect(() => {
    if (restRemaining === null) return;
    if (restRemaining <= 0) return;
    const timeout = setTimeout(() => setRestRemaining((value) => (value !== null ? value - 1 : value)), 1000);
    return () => clearTimeout(timeout);
  }, [restRemaining]);

  if (error) return <p className="notice notice--warn" role="alert">{error}</p>;
  if (!workout) return <p className="lede">Preparando tu sesión…</p>;

  return (
    <section className="view-strength view-exercise">
      <div className="restlane">
        <span className="restlane__clock" aria-live="polite">{restRemaining !== null ? formatClock(restRemaining) : formatClock(restSeconds)}</span>
        <div className="restlane__body">
          <p className="restlane__label">Descanso</p>
          <span className="restlane__edit">
            <label htmlFor="rest-seconds" className="sr-only">Segundos de descanso</label>
            <input id="rest-seconds" type="number" min={0} value={restSeconds} onChange={(event) => setRestSeconds(Number(event.target.value))} />
            <span>s</span>
          </span>
        </div>
        <button type="button" className="chip chip--compact restlane__action" onClick={() => setRestRemaining(restSeconds)}>Iniciar</button>
      </div>

      {exercises.map((exercise) => (
        <ExerciseCard key={exercise.id} workoutId={workout.id} exercise={exercise} onSubstitute={(replacement) => setExercises((current) => current.map((item) => (item.id === exercise.id ? replacement : item)))} />
      ))}

      {!closing ? (
        <button type="button" className="btn btn--primary btn--block" onClick={() => setClosing(true)}>Terminar sesión</button>
      ) : (
        <CloseForm workoutId={workout.id} baseVersion={workout.version} onClosed={() => router.push("/hoy")} />
      )}
    </section>
  );
}

function formatClock(totalSeconds: number) {
  const seconds = Math.max(Math.round(totalSeconds), 0);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest < 10 ? "0" : ""}${rest}`;
}

function ExerciseCard({ workoutId, exercise, onSubstitute }: { workoutId: string; exercise: SessionExercise; onSubstitute: (replacement: SessionExercise) => void }) {
  const variant = findVariant(exercise.variantId);
  const alternatives = EXERCISE_CATALOG.filter((candidate) => candidate.movementPattern === variant?.movementPattern && candidate.id !== exercise.variantId);
  const [savedSets, setSavedSets] = useState<Record<number, boolean>>({});
  const sync = useOfflineSyncContext();

  async function saveSet(setNumber: number, loadKg: number | null, repetitions: number | null, difficulty: Difficulty | null) {
    const payload = { sessionExerciseId: exercise.id, setNumber, loadKg, repetitions, difficulty };
    const operationId = crypto.randomUUID();
    try {
      const response = await fetch(`/api/v1/workouts/${workoutId}/sets`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "idempotency-key": operationId },
        body: JSON.stringify(payload)
      });
      if (response.ok) setSavedSets((current) => ({ ...current, [setNumber]: true }));
    } catch {
      // No coverage: queue the series and mark it saved locally — the sync-pill in the header shows it as pending until it reaches the server.
      await sync.enqueue({ id: operationId, kind: "record_set", workoutSessionId: workoutId, payload, createdAt: Date.now(), status: "pending" });
      setSavedSets((current) => ({ ...current, [setNumber]: true }));
    }
  }

  async function substitute(newVariantId: string) {
    const response = await fetch(`/api/v1/workouts/${workoutId}/exercises/${exercise.id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variantId: newVariantId })
    });
    const body = await response.json();
    if (response.ok) onSubstitute(body.data);
  }

  return (
    <div>
      <div className="exhead">
        <div className="exhead__body">
          <p className="exhead__variant">{variant ? `${variant.exerciseName} — ${variant.variantName}` : exercise.variantId}</p>
          {variant ? <p className="exhead__line">{variant.guide}</p> : null}
          <p className="exhead__line">Objetivo: {exercise.targetSets} series de {exercise.targetRepsMin}-{exercise.targetRepsMax} repeticiones.</p>
        </div>
      </div>

      {alternatives.length > 0 ? (
        <div className="field">
          <label htmlFor={`alt-${exercise.id}`} className="field__label">Cambiar variante</label>
          <select id={`alt-${exercise.id}`} defaultValue="" onChange={(event) => event.target.value && substitute(event.target.value)}>
            <option value="" disabled>Elegir alternativa compatible</option>
            {alternatives.map((alternative) => (
              <option key={alternative.id} value={alternative.id}>{alternative.variantName}</option>
            ))}
          </select>
        </div>
      ) : null}

      <p className="section-title">Series</p>
      <ul className="lanes">
        {Array.from({ length: exercise.targetSets }, (_, index) => index + 1).map((setNumber) => (
          <SetRow key={setNumber} setNumber={setNumber} saved={Boolean(savedSets[setNumber])} onSave={(loadKg, repetitions, difficulty) => saveSet(setNumber, loadKg, repetitions, difficulty)} />
        ))}
      </ul>
    </div>
  );
}

function SetRow({ setNumber, saved, onSave }: { setNumber: number; saved: boolean; onSave: (loadKg: number | null, repetitions: number | null, difficulty: Difficulty | null) => void }) {
  const [loadKg, setLoadKg] = useState("");
  const [repetitions, setRepetitions] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");

  return (
    <li className="lane__error-row" style={{ display: "flex", flexDirection: "column", gap: 6, borderBottom: "1px solid var(--rule-soft)", paddingBottom: 8 }}>
      <div className={"lane" + (saved ? " is-done" : "")} style={{ borderBottom: "none", padding: "10px 0 4px" }}>
        <span className="lane__num">{setNumber}</span>
        <span className="lane__field">
          <label htmlFor={`load-${setNumber}`} className="sr-only">Carga en kg</label>
          <input id={`load-${setNumber}`} type="number" value={loadKg} onChange={(event) => setLoadKg(event.target.value)} />
          <span className="lane__unit">kg</span>
        </span>
        <span className="lane__field">
          <label htmlFor={`reps-${setNumber}`} className="sr-only">Repeticiones</label>
          <input id={`reps-${setNumber}`} type="number" value={repetitions} onChange={(event) => setRepetitions(event.target.value)} />
          <span className="lane__unit">reps</span>
        </span>
        <span className="lane__state">
          <button type="button" className={"setbtn" + (saved ? " is-done" : "")} onClick={() => onSave(loadKg ? Number(loadKg) : null, repetitions ? Number(repetitions) : null, difficulty || null)}>
            {saved ? "Hecha ✓" : "Confirmar"}
          </button>
        </span>
      </div>
      <div className="picker" role="group" aria-label={`Dificultad de la serie ${setNumber}`}>
        {(Object.entries(DIFFICULTY_LABEL) as Array<[Difficulty, string]>).map(([value, label]) => (
          <button key={value} type="button" className="picker__btn" aria-pressed={difficulty === value} onClick={() => setDifficulty(difficulty === value ? "" : (value as Difficulty))}>
            {label}
          </button>
        ))}
      </div>
    </li>
  );
}

function CloseForm({ workoutId, baseVersion, onClosed }: { workoutId: string; baseVersion: number; onClosed: () => void }) {
  const [status, setStatus] = useState<CloseStatus>("completed");
  const [globalEffort, setGlobalEffort] = useState(5);
  const [comment, setComment] = useState("");
  const [hasDiscomfort, setHasDiscomfort] = useState(false);
  const [zone, setZone] = useState("back");
  const [intensity, setIntensity] = useState("mild");
  const [error, setError] = useState<string | null>(null);
  const sync = useOfflineSyncContext();

  async function submit() {
    const operationId = crypto.randomUUID();
    const payload = { status, globalEffort, comment: comment || null, discomfort: hasDiscomfort ? { zone, intensity } : null };
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
      await sync.enqueue({ id: operationId, kind: "finish_workout", workoutSessionId: workoutId, baseVersion, payload, createdAt: Date.now(), status: "pending" });
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
        <label htmlFor="global-effort" className="field__label">Esfuerzo global (1-10)</label>
        <input id="global-effort" type="number" min={1} max={10} required value={globalEffort} onChange={(event) => setGlobalEffort(Number(event.target.value))} />
      </div>

      <div className="field">
        <label htmlFor="close-comment" className="field__label">Comentario (opcional)</label>
        <textarea id="close-comment" value={comment} onChange={(event) => setComment(event.target.value)} />
      </div>

      <label className="checkrow">
        <input type="checkbox" checked={hasDiscomfort} onChange={(event) => setHasDiscomfort(event.target.checked)} />
        Hubo alguna molestia general (no es un diagnóstico)
      </label>
      {hasDiscomfort ? (
        <div className="field" style={{ display: "flex", gap: 8 }}>
          <select value={zone} onChange={(event) => setZone(event.target.value)}>
            {["neck", "shoulder", "back", "elbow", "wrist", "hip", "knee", "ankle"].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select value={intensity} onChange={(event) => setIntensity(event.target.value)}>
            {["mild", "moderate", "important"].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      ) : null}

      <button type="button" className="btn btn--primary btn--block" onClick={submit}>Guardar sesión</button>
    </section>
  );
}
