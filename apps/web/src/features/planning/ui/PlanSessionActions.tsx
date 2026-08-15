"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_LABEL, WEEKDAYS, type Weekday } from "@/lib/weekdays";
import { applySessionEditOffline } from "@/features/planning/domain/plan-session-edit-offline";
import { createClientId } from "@/lib/client-id";
import { useOfflineData } from "@/lib/offline/OfflineDataContext";
import { useOfflineSyncContext } from "@/lib/offline/OfflineSyncContext";

type EditBody =
  | { kind: "move"; isoWeekStart: string; sessionIndex: number; targetDay: Weekday }
  | { kind: "skip" | "remove" | "restore"; isoWeekStart: string; sessionIndex: number };

type PlanSessionActionsProps = { planId: string; weekStart: string; sessionIndex: number; status: string; currentDay: Weekday };

export default function PlanSessionActions({ planId, weekStart, sessionIndex, status, currentDay }: PlanSessionActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // Moving to the day the session is already on is a no-op, so it's excluded
  // from the target options below — default to the first other day instead.
  const otherDays = WEEKDAYS.filter((day) => day !== currentDay) as Weekday[];
  const [targetDay, setTargetDay] = useState<Weekday>(otherDays[0] ?? currentDay);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const offlineData = useOfflineData();
  const sync = useOfflineSyncContext();

  useEffect(() => {
    if (!sheetOpen) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeSheet();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [sheetOpen]);

  function closeSheet() {
    setSheetOpen(false);
    setError(null);
    triggerRef.current?.focus();
  }

  async function run(body: EditBody) {
    setPending(true);
    setError(null);
    let response: Response;
    try {
      response = await fetch(`/api/v1/plans/${planId}/session-edits`, {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch {
      // Network failure (not a server rejection): apply the edit locally and queue it — the
      // change IS saved, just not synced yet, same treatment as CheckinRunner/WorkoutRunner.
      if (offlineData.snapshot) {
        const result = applySessionEditOffline(offlineData.snapshot, planId, body, createClientId);
        offlineData.applyLocalMutation(result.snapshot.data);
        await sync.enqueue(result.operation);
        setPending(false);
        setSheetOpen(false);
        router.refresh();
        return;
      }
      setPending(false);
      setError("No pudimos guardar el cambio. Inténtalo de nuevo.");
      return;
    }
    setPending(false);
    if (!response.ok) {
      const parsed = await response.json().catch(() => null);
      setError(parsed?.error?.message ?? "No pudimos guardar el cambio. Inténtalo de nuevo.");
      return;
    }
    setSheetOpen(false);
    router.refresh();
  }

  const hasAdjustment = status === "skipped" || status === "removed" || status === "moved_here";
  const sheetTitleId = `planRowSheetTitle-${sessionIndex}`;

  return (
    <>
      <button ref={triggerRef} type="button" className="icon-btn" aria-label="Más acciones para esta sesión" onClick={() => setSheetOpen(true)}>
        <span aria-hidden="true">⋯</span>
      </button>

      {sheetOpen ? (
        <div className="sheet-overlay" role="presentation" onClick={closeSheet}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={sheetTitleId} onClick={(event) => event.stopPropagation()}>
            <div className="sheet__header sheet__header--compact">
              <h2 id={sheetTitleId}>Más acciones</h2>
              <button type="button" className="icon-btn" aria-label="Cerrar" onClick={closeSheet}>×</button>
            </div>
            {error ? <p className="notice notice--warn" role="alert">{error}</p> : null}
            <div className="sheet__body sheet__body--compact">
              <div className="field field--compact">
                <label className="field__label" htmlFor={`planRowTargetDay-${sessionIndex}`}>Mover a</label>
                <select id={`planRowTargetDay-${sessionIndex}`} value={targetDay} onChange={(event) => setTargetDay(event.target.value as Weekday)} disabled={pending}>
                  {otherDays.map((day) => <option key={day} value={day}>{WEEKDAY_LABEL[day as Weekday]}</option>)}
                </select>
              </div>
              <button type="button" className="opt opt--compact" disabled={pending} onClick={() => run({ kind: "move", isoWeekStart: weekStart, sessionIndex, targetDay })}>
                <span className="opt__name">Mover</span>
              </button>
              <button type="button" className="opt opt--compact" disabled={pending} onClick={() => run({ kind: "skip", isoWeekStart: weekStart, sessionIndex })}>
                <span className="opt__name">Omitir</span>
              </button>
              <button type="button" className="opt opt--compact" disabled={pending} onClick={() => run({ kind: "remove", isoWeekStart: weekStart, sessionIndex })}>
                <span className="opt__name">Eliminar</span>
              </button>
              {hasAdjustment ? (
                <button type="button" className="opt opt--compact" disabled={pending} onClick={() => run({ kind: "restore", isoWeekStart: weekStart, sessionIndex })}>
                  <span className="opt__name">Deshacer</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
