"use client";

import { useState } from "react";
import { ENDURANCE_OBJECTIVES } from "@/features/endurance/data/objectives";
import { ImportActivityEntry } from "@/features/endurance/ui/ImportActivityEntry";

/**
 * Parity with prototype/js/views/endurance.js `render()` empty branch + `openObjectivesSheet`
 * (no endurance session resolved for today): explains the six objectives instead of bouncing
 * straight back to /hoy, and still offers importing an already-done activity.
 */
export function EnduranceEmptyState() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <section className="view-endurance">
      <div className="state-block">
        <p className="state-block__title">No hay ninguna sesión de resistencia para hoy</p>
        <p className="lede small">Puedes explorar los seis objetivos de resistencia o importar una actividad ya realizada.</p>
        <div className="state-block__actions">
          <button type="button" className="btn btn--primary btn--block" onClick={() => setSheetOpen(true)}>Ver los seis objetivos</button>
        </div>
      </div>

      <ImportActivityEntry />

      {sheetOpen ? (
        <div className="sheet-overlay" role="presentation" onClick={() => setSheetOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="objectivesSheetTitle" onClick={(event) => event.stopPropagation()}>
            <div className="sheet__header">
              <h2 id="objectivesSheetTitle">Objetivos de resistencia</h2>
              <button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => setSheetOpen(false)}>×</button>
            </div>
            <div className="sheet__body">
              <p className="lede small">Varias formas de planificar una sesión de correr, bici o caminar. Explica duración, intensidad y estructura en lenguaje llano.</p>
              {ENDURANCE_OBJECTIVES.map((objective) => (
                <div className="objective-card" key={objective.id}>
                  <p className="objective-card__name">{objective.name}</p>
                  <p className="objective-card__meta">{objective.durationText} · {objective.intensityText}</p>
                  <p className="lede small">{objective.purpose}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
