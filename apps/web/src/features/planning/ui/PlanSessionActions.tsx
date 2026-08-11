"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_LABEL, WEEKDAYS, type Weekday } from "@/lib/weekdays";

type EditBody =
  | { kind: "move"; isoWeekStart: string; sessionIndex: number; targetDay: Weekday }
  | { kind: "skip" | "remove" | "restore" | "remove_added"; isoWeekStart: string; sessionIndex: number }
  | { kind: "add"; isoWeekStart: string; day: Weekday; title: string; sessionKind: "strength" | "endurance"; estimatedMinutes: number };

async function submitEdit(planId: string, body: EditBody): Promise<boolean> {
  const response = await fetch(`/api/v1/plans/${planId}/session-edits`, {
    method: "POST", credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return response.ok;
}

function RowActions({ planId, weekStart, sessionIndex, status, isAdded }: { planId: string; weekStart: string; sessionIndex: number; status: string; isAdded: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [targetDay, setTargetDay] = useState<Weekday>("monday");

  async function run(body: EditBody) {
    setPending(true);
    const ok = await submitEdit(planId, body);
    setPending(false);
    if (ok) router.refresh();
  }

  const hasAdjustment = status === "skipped" || status === "removed" || status === "moved_here";

  return (
    <div className="dayrow__actions">
      {!isAdded && (
        <>
          <select aria-label="Mover a día" value={targetDay} onChange={(event) => setTargetDay(event.target.value as Weekday)} disabled={pending}>
            {WEEKDAYS.map((day) => <option key={day} value={day}>{WEEKDAY_LABEL[day as Weekday]}</option>)}
          </select>
          <button type="button" className="chip" disabled={pending} onClick={() => run({ kind: "move", isoWeekStart: weekStart, sessionIndex, targetDay })}>Mover</button>
          <button type="button" className="chip" disabled={pending} onClick={() => run({ kind: "skip", isoWeekStart: weekStart, sessionIndex })}>Omitir</button>
          <button type="button" className="chip" disabled={pending} onClick={() => run({ kind: "remove", isoWeekStart: weekStart, sessionIndex })}>Eliminar</button>
          {hasAdjustment ? (
            <button type="button" className="chip" disabled={pending} onClick={() => run({ kind: "restore", isoWeekStart: weekStart, sessionIndex })}>Deshacer</button>
          ) : null}
        </>
      )}
      {isAdded ? (
        <button type="button" className="chip" disabled={pending} onClick={() => run({ kind: "remove_added", isoWeekStart: weekStart, sessionIndex })}>Quitar sesión añadida</button>
      ) : null}
    </div>
  );
}

function AddForm({ planId, weekStart }: { planId: string; weekStart: string }) {
  const router = useRouter();
  const [day, setDay] = useState<Weekday>("monday");
  const [title, setTitle] = useState("");
  const [sessionKind, setSessionKind] = useState<"strength" | "endurance">("strength");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    const ok = await submitEdit(planId, { kind: "add", isoWeekStart: weekStart, day, title: title.trim(), sessionKind, estimatedMinutes });
    setPending(false);
    if (ok) { setTitle(""); router.refresh(); }
  }

  return (
    <form className="field" onSubmit={submit}>
      <label className="field__label" htmlFor="planAddTitle">Nombre</label>
      <input id="planAddTitle" type="text" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required />
      <div className="picker" role="group" aria-label="Día">
        {WEEKDAYS.map((weekday) => (
          <button key={weekday} type="button" className="picker__btn" aria-pressed={day === weekday} onClick={() => setDay(weekday as Weekday)}>{WEEKDAY_LABEL[weekday as Weekday]}</button>
        ))}
      </div>
      <div className="picker" role="group" aria-label="Tipo">
        <button type="button" className="picker__btn" aria-pressed={sessionKind === "strength"} onClick={() => setSessionKind("strength")}>Fuerza</button>
        <button type="button" className="picker__btn" aria-pressed={sessionKind === "endurance"} onClick={() => setSessionKind("endurance")}>Resistencia</button>
      </div>
      <label className="field__label" htmlFor="planAddMinutes">Minutos estimados</label>
      <input id="planAddMinutes" type="number" min={10} max={180} value={estimatedMinutes} onChange={(event) => setEstimatedMinutes(Number(event.target.value))} />
      <button type="submit" className="btn btn--primary btn--block" disabled={pending}>Añadir sesión</button>
    </form>
  );
}

export const PlanSessionActions = { RowActions, AddForm };
