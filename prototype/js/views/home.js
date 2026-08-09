/* =====================================================================
 * Vista: Tu camino (LOTE 1, recortada en LOTE 2d)
 * Home contiene SOLO los 3 bloques de prioridad-hibrida-006 (criterio 3):
 * a) entrenamiento de hoy  b) plan de la semana (carril compacto)
 * c) cómo llegas hoy (check-in opcional). El resto (progreso de bloque,
 * estado semanal, evolución, actividad reciente, logro) vive ahora en la
 * vista Plan, sección "Tu progreso" (ver plan.js).
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  var ESTADO_LABEL = {
    planificada: "Planificada",
    en_curso: "En curso",
    completada: "Completada",
    adaptada: "Adaptada",
    parcial: "Parcial",
    omitida: "Omitida",
    // ---- resistencia-reloj-importacion-007: estados propios de resistencia
    // (nunca usados por sesiones de fuerza; fallback seguro más abajo).
    programada_reloj: "Programada en reloj",
    realizada_pendiente_importar: "Realizada, pendiente de importar",
    importada_asociada: "Importada y asociada",
    asociada_adaptacion: "Asociada con adaptación",
    sin_resultado: "Sin resultado"
  };

  function render(mount) {
    var data = App.data;

    var wrap = App.el("section", "view-home");
    wrap.appendChild(App.el("p", "kicker",
      data.plan.nombre + " · semana " + data.plan.semanaActual + " de " + data.plan.semanasTotales));
    var h1 = App.el("h1", "view-title", "Tu camino");
    wrap.appendChild(h1);

    // ---- prioridad-hibrida-006: exactamente 3 bloques antes de cualquier
    // contenido secundario, en este orden fijo (criterio 3 del contrato):
    // a) Entrenamiento de hoy  b) Plan de la semana  c) Cómo llegas hoy.
    // Todo lo demás (progreso de bloque, evolución, actividad reciente,
    // logro, enlaces) baja por debajo de los tres.

    // a) Entrenamiento de hoy
    wrap.appendChild(App.el("h2", "section-title", "Entrenamiento de hoy"));
    wrap.appendChild(buildHero(data));

    // b) Plan de la semana: carril semanal + frase de relación de carga
    wrap.appendChild(App.el("h2", "section-title", "Plan de la semana"));
    wrap.appendChild(buildWeekRail(data));
    wrap.appendChild(App.el("p", "rail-legend",
      "Relleno = completada · naranja = hoy · hueco = planificada · discontinuo = movida · punto = descanso."));
    var warn = data.weeklyLoadWarning();
    if (warn) wrap.appendChild(App.el("p", "notice notice--warn", loadWarningPhrase(warn, data)));

    // c) Cómo llegas hoy: bloque propio hacia el check-in, opcional y rápido
    wrap.appendChild(App.el("h2", "section-title", "Cómo llegas hoy"));
    wrap.appendChild(buildCheckinBlock(data));

    // ---- Contenido secundario (progreso de bloque, estado semanal,
    // evolución, actividad reciente, logro) ya NO vive en Home: se movió a
    // la vista Plan ("Tu progreso", al final) para que Home se quede en los
    // 3 bloques 1-3 de prioridad-hibrida-006. Plan y Perfil ya son
    // alcanzables desde la cabecera/bottomnav; Compartir se mueve al menú
    // "⋯" a nivel de plan (ver plan.js, lote 3).

    mount.appendChild(wrap);
  }

  /* ---- 1-2) Sesión protagonista y opciones subordinadas ----------------- */

  function buildHero(data) {
    var todaySession = data.sessionOnDay(data.hoy);
    var block = App.el("article", "today");
    block.setAttribute("aria-labelledby", "todayTitle");

    if (!todaySession) return buildRestHero(block, data);

    // ---- resistencia-reloj-importacion-007: "en_curso" ya no se alcanza
    // nunca para resistencia (no hay ejecución en la app); esta rama sigue
    // aplicando solo a fuerza.
    if (todaySession.tipo === "fuerza" && todaySession.estado === "en_curso") {
      block.classList.add("today--fuerza");
      block.appendChild(App.el("p", "today__eyebrow", "Hoy · sesión en curso"));
      var t1 = App.el("h2", "today__title", todaySession.nombre);
      t1.id = "todayTitle";
      block.appendChild(t1);
      block.appendChild(App.el("p", "today__why", "Tienes una sesión sin terminar. Retómala donde la dejaste."));
      var resume = App.el("button", "btn btn--primary btn--block", "Continuar sesión");
      resume.type = "button";
      resume.addEventListener("click", function () { App.navigate("train", { sessionId: todaySession.id }); });
      block.appendChild(resume);
      return block;
    }

    if (todaySession.estado === "completada" || todaySession.estado === "adaptada" || todaySession.estado === "parcial") {
      block.classList.add("today--done");
      var eyebrow = App.el("p", "today__eyebrow",
        todaySession.estado === "completada" ? "Hoy · sesión completada"
          : todaySession.estado === "adaptada" ? "Hoy · versión adaptada terminada"
          : "Hoy · sesión parcial");
      block.appendChild(eyebrow);
      var t2 = App.el("h2", "today__title", todaySession.nombre);
      t2.id = "todayTitle";
      block.appendChild(t2);
      block.appendChild(App.el("p", "today__why",
        "Registrada: " + (todaySession.duracionPrevista || 0) + " min activos aproximados."));
      var alts1 = App.el("div", "today__alts");
      alts1.appendChild(buildAlt("recovery", "Cambiar a recuperación", "10–15 min, sin carga", function () { App.navigate("recovery"); }));
      block.appendChild(alts1);
      return block;
    }

    if (todaySession.tipo === "fuerza" && todaySession.estado === "planificada") {
      block.appendChild(App.el("p", "today__eyebrow", "Hoy · fuerza"));
      var t3 = App.el("h2", "today__title", todaySession.nombre);
      t3.id = "todayTitle";
      block.appendChild(t3);
      block.appendChild(App.el("p", "today__why",
        "Prevista para hoy · " + (todaySession.duracionPrevista || "—") + " min aproximados."));

      var start = App.el("button", "btn btn--primary btn--block", "Empezar sesión");
      start.type = "button";
      start.addEventListener("click", function () { App.navigate("train", { sessionId: todaySession.id }); });
      block.appendChild(start);

      var alts2 = App.el("div", "today__alts");
      alts2.appendChild(buildAlt("adapt", "Ajustar a cómo llego hoy", "Check-in de 20 s · propone y confirmas", function () { App.navigate("checkin", { sessionId: todaySession.id }); }));
      alts2.appendChild(buildAlt("recovery", "Cambiar a recuperación", "Movilidad suave, 10–15 min", function () { App.navigate("recovery"); }));
      block.appendChild(alts2);
      return block;
    }

    if (todaySession.tipo === "resistencia") return buildEnduranceHero(block, data, todaySession);

    return buildRestHero(block, data);
  }

  // ---- resistencia-reloj-importacion-007: la app diseña, nunca ejecuta.
  // Ningún botón de este bloque implica "empezar" una actividad controlada
  // por la app: navega a la propuesta, a importar o al historial. ----------
  function buildEnduranceHero(block, data, session) {
    block.classList.add("today--cardio");

    if (session.estado === "importada_asociada" || session.estado === "asociada_adaptacion" || session.estado === "sin_resultado") {
      block.classList.add("today--done");
      block.appendChild(App.el("p", "today__eyebrow", "Hoy · " + ESTADO_LABEL[session.estado].toLowerCase()));
      var tDone = App.el("h2", "today__title", session.nombre);
      tDone.id = "todayTitle";
      block.appendChild(tDone);
      block.appendChild(App.el("p", "today__why",
        session.estado === "sin_resultado"
          ? "Sin actividad importada para esta sesión."
          : "Actividad importada y asociada a esta sesión."));
      var histBtn = App.el("button", "btn btn--ghost btn--block", "Ver en historial");
      histBtn.type = "button";
      histBtn.addEventListener("click", function () { App.navigate("history"); });
      block.appendChild(histBtn);
      return block;
    }

    block.appendChild(App.el("p", "today__eyebrow", "Hoy · resistencia"));
    var t = App.el("h2", "today__title", session.nombre);
    t.id = "todayTitle";
    block.appendChild(t);

    if (session.estado === "planificada") {
      block.appendChild(App.el("p", "today__why",
        "Prevista para hoy · " + (session.duracionPrevista || "—") + " min aproximados. Prepárala y créala manualmente en tu reloj."));
      var viewBtn = App.el("button", "btn btn--primary btn--block", "Ver sesión y preparar en el reloj");
      viewBtn.type = "button";
      viewBtn.addEventListener("click", function () { App.navigate("train", { sessionId: session.id }); });
      block.appendChild(viewBtn);
    } else if (session.estado === "programada_reloj") {
      block.appendChild(App.el("p", "today__why", "Ya la tienes creada en tu reloj. Cuando la hagas, importa el resultado."));
      var importBtn = App.el("button", "btn btn--primary btn--block", "Importar actividad");
      importBtn.type = "button";
      importBtn.addEventListener("click", function () { App.navigate("import", { sessionId: session.id }); });
      block.appendChild(importBtn);
    } else {
      // realizada_pendiente_importar
      block.appendChild(App.el("p", "today__why", "Registrada como realizada. Importa el archivo para ver el resultado."));
      var importBtn2 = App.el("button", "btn btn--primary btn--block", "Importar actividad");
      importBtn2.type = "button";
      importBtn2.addEventListener("click", function () { App.navigate("import", { sessionId: session.id }); });
      block.appendChild(importBtn2);
    }

    var alts2 = App.el("div", "today__alts");
    alts2.appendChild(buildAlt("adapt", "Ajustar a cómo llego hoy", "Check-in de 20 s · propone y confirmas", function () { App.navigate("checkin", { sessionId: session.id }); }));
    alts2.appendChild(buildAlt("recovery", "Cambiar a recuperación", "Movilidad suave, 10–15 min", function () { App.navigate("recovery"); }));
    block.appendChild(alts2);
    return block;
  }

  function buildRestHero(block, data) {
    var next = findNextSession(data);
    block.classList.add("today--recovery");
    block.appendChild(App.el("p", "today__eyebrow", "Hoy · descanso"));
    var t4 = App.el("h2", "today__title", "Día libre");
    t4.id = "todayTitle";
    block.appendChild(t4);
    if (next) {
      block.appendChild(App.el("p", "today__why",
        "Tu próxima sesión es " + next.session.nombre + " el " + next.day.nombre.toLowerCase() + "."));
    } else {
      block.appendChild(App.el("p", "today__why", "No hay más sesiones previstas esta semana."));
    }
    var planBtn = App.el("button", "btn btn--primary btn--block", "Ver plan semanal");
    planBtn.type = "button";
    planBtn.addEventListener("click", function () { App.navigate("plan"); });
    block.appendChild(planBtn);
    return block;
  }

  // ---- b) frase de relación de carga concreta (usa data.weeklyLoadWarning,
  // que reutiliza findConflict: no se reimplementa la regla de choque). -----
  function loadWarningPhrase(warn, data) {
    var cardioDay = data.dayByKey(warn.session.day);
    var legsDay = data.dayByKey(warn.conflict.day);
    return warn.session.nombre + " el " + (cardioDay ? cardioDay.nombre.toLowerCase() : warn.session.day) +
      ": justo al lado de " + warn.conflict.nombre.toLowerCase() + " (" + (legsDay ? legsDay.nombre.toLowerCase() : warn.conflict.day) +
      "). Puedes revisarlo desde Plan.";
  }

  // ---- c) Cómo llegas hoy: bloque propio, no un botón dentro de la tarjeta
  // de hoy. Check-in es opcional y rápido (20 s), nunca obligatorio. --------
  function buildCheckinBlock(data) {
    var box = App.el("div", "note");
    var today = data.sessionOnDay(data.hoy);
    box.appendChild(App.el("p", null, "Opcional y rápido: cuéntanos cómo llegas hoy (20 s) para ajustar la sesión si hace falta."));
    var btn = App.el("button", "btn btn--ghost btn--block", "Hacer check-in");
    btn.type = "button";
    btn.addEventListener("click", function () { App.navigate("checkin", today ? { sessionId: today.id } : {}); });
    box.appendChild(btn);
    return box;
  }

  function buildAlt(kind, title, meta, onClick) {
    var btn = App.el("button", "alt alt--" + kind);
    btn.type = "button";
    btn.appendChild(App.el("span", "alt__mark"));
    var body = App.el("span", "alt__body");
    body.appendChild(App.el("span", "alt__title", title));
    body.appendChild(App.el("span", "alt__meta", meta));
    btn.appendChild(body);
    var arrow = App.el("span", "alt__arrow", "→");
    arrow.setAttribute("aria-hidden", "true");
    btn.appendChild(arrow);
    btn.addEventListener("click", onClick);
    return btn;
  }

  function findNextSession(data) {
    var keys = data.DAYS.map(function (d) { return d.key; });
    var idx = keys.indexOf(data.hoy);
    for (var i = 1; i <= keys.length; i++) {
      var day = data.DAYS[(idx + i) % keys.length];
      var s = data.sessionOnDay(day.key);
      if (s && (s.estado === "planificada" || s.estado === "en_curso")) return { day: day, session: s };
    }
    return null;
  }

  /* ---- Carril semanal (forma + color, nunca solo color) ------------------ */
  /* LOTE 4: cada día es un control real (<button>) con nombre accesible que
   * incluye el día y qué hay ese día; tocarlo abre el detalle de la sesión
   * o del día de descanso, con teclado o con puntero. */

  function buildWeekRail(data) {
    var rail = App.el("ol", "weekrail");
    rail.setAttribute("aria-label", "Tu semana");

    data.DAYS.forEach(function (day) {
      var s = data.sessionOnDay(day.key);
      var ghost = s ? null : data.ghostOnDay(day.key);
      var isToday = day.key === data.hoy;

      var li = App.el("li");
      var btn = App.el("button", "weekrail__day");
      btn.type = "button";
      var name = App.el("span", "weekrail__name");
      var described;

      if (s) {
        if (s.tipo === "resistencia") btn.classList.add("is-cardio");
        name.textContent = s.nombre;
        if (s.estado === "completada" || s.estado === "adaptada" || s.estado === "importada_asociada" || s.estado === "asociada_adaptacion") {
          btn.classList.add("is-done");
          described = s.nombre + ", " + (ESTADO_LABEL[s.estado] || s.estado).toLowerCase();
        } else if (isToday) {
          btn.classList.add("is-today");
          described = s.nombre + ", hoy";
        } else if (s.estado === "omitida" || s.estado === "parcial" || s.estado === "sin_resultado") {
          btn.classList.add("is-skipped");
          described = s.nombre + ", " + (ESTADO_LABEL[s.estado] || s.estado).toLowerCase();
        } else {
          btn.classList.add("is-planned");
          described = s.nombre + ", " + (ESTADO_LABEL[s.estado] || "planificada").toLowerCase();
        }
        if (s.movedFrom) described += ", recolocada aquí";
      } else if (ghost) {
        btn.classList.add("is-moved");
        name.textContent = "movida";
        described = ghost.nombre + " se movió de este día";
      } else {
        btn.classList.add("is-rest");
        name.textContent = "descanso";
        described = "descanso";
      }

      btn.setAttribute("aria-label", day.nombre + ": " + described);
      btn.appendChild(App.el("span", "weekrail__label", day.abrev));
      btn.appendChild(App.el("span", "weekrail__mark"));
      btn.appendChild(name);
      btn.addEventListener("click", function () { openDayDetailSheet(day, s, ghost, isToday); });
      li.appendChild(btn);
      rail.appendChild(li);
    });

    return rail;
  }

  function openDayDetailSheet(day, session, ghost, isToday) {
    App.openSheet({
      title: day.nombre + (isToday ? " · hoy" : ""),
      render: function (body) {
        if (session) {
          body.appendChild(App.el("p", "kicker", session.tipo === "resistencia" ? "Resistencia" : "Fuerza"));
          body.appendChild(App.el("p", "lede", session.nombre));
          body.appendChild(App.el("p", "small", "Estado: " + (ESTADO_LABEL[session.estado] || session.estado) +
            (session.duracionPrevista ? " · " + session.duracionPrevista + " min aproximados" : "")));
          if (session.movedFrom) body.appendChild(App.el("p", "small", "Recolocada aquí desde otro día."));

          // ---- resistencia-reloj-importacion-007: para resistencia nunca se
          // ofrece "Empezar/Continuar sesión" (implicaría ejecución en vivo).
          // Se navega a la propuesta de solo lectura o a importar el
          // resultado, según en qué estado esté.
          if (session.tipo === "resistencia") {
            if (session.estado === "importada_asociada" || session.estado === "asociada_adaptacion" || session.estado === "sin_resultado") {
              var histBtnR = App.el("button", "btn btn--ghost btn--block", "Ver en historial");
              histBtnR.type = "button";
              histBtnR.addEventListener("click", function () { App.closeSheet(); App.navigate("history"); });
              body.appendChild(histBtnR);
            } else if (session.estado === "programada_reloj" || session.estado === "realizada_pendiente_importar") {
              var importBtnR = App.el("button", "btn btn--primary btn--block", "Importar actividad");
              importBtnR.type = "button";
              importBtnR.addEventListener("click", function () { App.closeSheet(); App.navigate("import", { sessionId: session.id }); });
              body.appendChild(importBtnR);
            } else {
              var viewBtnR = App.el("button", "btn btn--primary btn--block", "Ver sesión");
              viewBtnR.type = "button";
              viewBtnR.addEventListener("click", function () { App.closeSheet(); App.navigate("train", { sessionId: session.id }); });
              body.appendChild(viewBtnR);
            }
            return;
          }

          if (session.estado === "planificada" || session.estado === "en_curso") {
            var startBtn = App.el("button", "btn btn--primary btn--block",
              session.estado === "en_curso" ? "Continuar sesión" : "Empezar sesión");
            startBtn.type = "button";
            startBtn.addEventListener("click", function () {
              App.closeSheet();
              App.navigate("train", { sessionId: session.id });
            });
            body.appendChild(startBtn);
          } else {
            var historyBtn = App.el("button", "btn btn--ghost btn--block", "Ver en historial");
            historyBtn.type = "button";
            historyBtn.addEventListener("click", function () { App.closeSheet(); App.navigate("history"); });
            body.appendChild(historyBtn);
          }
          return;
        }

        if (ghost) {
          body.appendChild(App.el("p", "lede", "Sin sesión aquí"));
          body.appendChild(App.el("p", "small", ghost.nombre + " se recolocó a otro día. Este día queda libre."));
          return;
        }

        body.appendChild(App.el("p", "lede", "Día de descanso"));
        body.appendChild(App.el("p", "small", "No hay ninguna sesión planificada. Puedes aprovecharlo para recuperar o dejarlo libre."));
        var recoveryBtn = App.el("button", "btn btn--ghost btn--block", "Ver recuperación");
        recoveryBtn.type = "button";
        recoveryBtn.addEventListener("click", function () { App.closeSheet(); App.navigate("recovery"); });
        body.appendChild(recoveryBtn);
      }
    });
  }

  App.registerView("home", { title: "Tu camino", render: render });
})();
