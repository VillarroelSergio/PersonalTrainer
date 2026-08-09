/* =====================================================================
 * Vista: Tu camino (LOTE 1)
 * Orden de contenido según nota 28 (fuente de verdad, prevalece sobre
 * MVP-DEFINITION.md §6 en caso de conflicto):
 * 1) sesión protagonista  2) opciones subordinadas  3) estado semanal
 * 4) evolución breve  5) actividad reciente  6) un único logro.
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
    omitida: "Omitida"
  };

  var PROCEDENCIA_LABEL = {
    local: "Local",
    importado: "Importado",
    adaptado: "Adaptado por ti"
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
      "Relleno: completada · anillo naranja: hoy · anillo hueco: planificada · trazo discontinuo: día del que se movió una sesión · punto: descanso."));
    var warn = data.weeklyLoadWarning();
    if (warn) wrap.appendChild(App.el("p", "notice notice--warn", loadWarningPhrase(warn, data)));

    // c) Cómo llegas hoy: bloque propio hacia el check-in, opcional y rápido
    wrap.appendChild(App.el("h2", "section-title", "Cómo llegas hoy"));
    wrap.appendChild(buildCheckinBlock(data));

    // ---- Contenido secundario, siempre por debajo de los 3 bloques --------

    // Progreso del bloque
    wrap.appendChild(App.el("h2", "section-title", data.plan.nombre));
    wrap.appendChild(buildBlockProgress(data.plan));

    // Estado semanal
    wrap.appendChild(buildWeekStats(data));

    // Evolución breve
    wrap.appendChild(App.el("h2", "section-title", "Cómo va"));
    wrap.appendChild(buildEvolutionNote(data));

    // Actividad reciente
    wrap.appendChild(App.el("h2", "section-title", "Actividad reciente"));
    wrap.appendChild(buildRecentActivity(data));

    // Un único logro
    var achievement = pickAchievement(data.ACHIEVEMENTS);
    if (achievement) wrap.appendChild(buildAchievement(achievement));

    var quickNav = App.el("div", "quick-nav");
    var planLink = App.el("button", "link-btn", "Ver plan →");
    planLink.type = "button";
    planLink.addEventListener("click", function () { App.navigate("plan"); });
    quickNav.appendChild(planLink);
    var historyLink = App.el("button", "link-btn", "Ver historial →");
    historyLink.type = "button";
    historyLink.addEventListener("click", function () { App.navigate("history"); });
    quickNav.appendChild(historyLink);
    // ---- LOTE 6: puntos de enganche a Perfil y Compartir. Home no tiene
    // otro punto de entrada a estas vistas (el icono de perfil de la
    // cabecera abre la hoja ligera de core.js, que no se toca en este
    // lote); se añaden aquí, en el mismo quick-nav ya existente.
    var profileLink = App.el("button", "link-btn", "Perfil →");
    profileLink.type = "button";
    profileLink.addEventListener("click", function () { App.navigate("profile"); });
    quickNav.appendChild(profileLink);
    var shareLink = App.el("button", "link-btn", "Compartir rutina →");
    shareLink.type = "button";
    shareLink.addEventListener("click", function () { App.navigate("share"); });
    quickNav.appendChild(shareLink);
    wrap.appendChild(quickNav);

    mount.appendChild(wrap);
  }

  /* ---- 1-2) Sesión protagonista y opciones subordinadas ----------------- */

  function buildHero(data) {
    var todaySession = data.sessionOnDay(data.hoy);
    var block = App.el("article", "today");
    block.setAttribute("aria-labelledby", "todayTitle");

    if (todaySession && todaySession.estado === "en_curso") {
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

    if (todaySession && (todaySession.estado === "completada" || todaySession.estado === "adaptada" || todaySession.estado === "parcial")) {
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

    if (todaySession && todaySession.estado === "planificada") {
      if (todaySession.tipo === "resistencia") block.classList.add("today--cardio");
      block.appendChild(App.el("p", "today__eyebrow", "Hoy · " + (todaySession.tipo === "resistencia" ? "resistencia" : "fuerza")));
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

    // Sin sesión hoy: mostrar la próxima y acciones de plan.
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

  /* ---- Progreso del bloque ------------------------------------------------ */

  function buildBlockProgress(plan) {
    var wrap = App.el("div", "blockprog");
    var track = App.el("div", "blockprog__track");
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", "Semana " + plan.semanaActual + " de " + plan.semanasTotales + " del " + plan.nombre.toLowerCase());
    var fill = App.el("div", "blockprog__fill");
    fill.style.width = Math.round((plan.semanaActual / plan.semanasTotales) * 100) + "%";
    track.appendChild(fill);
    wrap.appendChild(track);
    var label = App.el("p", "blockprog__label");
    label.appendChild(App.el("b", null, "Semana " + plan.semanaActual));
    label.appendChild(document.createTextNode(" de " + plan.semanasTotales));
    wrap.appendChild(label);
    return wrap;
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
        if (s.estado === "completada" || s.estado === "adaptada") {
          btn.classList.add("is-done");
          described = s.nombre + ", " + ESTADO_LABEL[s.estado].toLowerCase();
        } else if (isToday) {
          btn.classList.add("is-today");
          described = s.nombre + ", hoy";
        } else if (s.estado === "omitida" || s.estado === "parcial") {
          btn.classList.add("is-skipped");
          described = s.nombre + ", " + ESTADO_LABEL[s.estado].toLowerCase();
        } else {
          btn.classList.add("is-planned");
          described = s.nombre + ", planificada";
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

  /* ---- 3) Estado semanal --------------------------------------------------- */

  function buildWeekStats(data) {
    var stats = data.weekStats();
    var figures = App.el("div", "figures");
    figures.setAttribute("aria-label", "Resumen de la semana");

    var f1 = App.el("div", "figure");
    var num1 = App.el("p", "figure__num");
    num1.appendChild(document.createTextNode(String(stats.hechas)));
    var of1 = App.el("span", "figure__of", "/" + stats.previstas);
    num1.appendChild(of1);
    f1.appendChild(num1);
    f1.appendChild(App.el("p", "figure__label", "sesiones"));
    figures.appendChild(f1);

    var f2 = App.el("div", "figure");
    var num2 = App.el("p", "figure__num");
    num2.appendChild(document.createTextNode(String(stats.minutos)));
    num2.appendChild(App.el("span", "figure__unit", "min"));
    f2.appendChild(num2);
    f2.appendChild(App.el("p", "figure__label", "activos"));
    figures.appendChild(f2);

    var f3 = App.el("div", "figure");
    var num3 = App.el("p", "figure__num");
    num3.appendChild(document.createTextNode(String(stats.constancia)));
    num3.appendChild(App.el("span", "figure__unit", "sem"));
    f3.appendChild(num3);
    f3.appendChild(App.el("p", "figure__label", "de constancia"));
    figures.appendChild(f3);

    return figures;
  }

  /* ---- 4) Evolución breve --------------------------------------------------- */
  /* LOTE 4: nunca se afirma una evolución que no existe. Sin historial
   * previo, no se inventa una tendencia (nota: nunca se inventan datos que
   * la persona no ha generado todavía, mismo criterio que history.js). */

  function buildEvolutionNote(data) {
    var note = App.el("div", "note");

    if (!data.HISTORY || !data.HISTORY.length) {
      note.appendChild(App.el("p", null,
        "Todavía no hay sesiones registradas para mostrar una evolución. Aparecerá aquí en cuanto completes tu primera sesión."));
      return note;
    }

    // No afirmar una tendencia positiva con datos insuficientes: hace falta
    // más de un registro y que el más reciente sea completada/adaptada
    // (una sesión parcial u omitida no sostiene "sube con constancia").
    var last = data.HISTORY[0];
    if (data.HISTORY.length < 2 || (last.estado !== "completada" && last.estado !== "adaptada")) {
      note.appendChild(App.el("p", null,
        "Todavía es pronto para mostrar una tendencia. Aparecerá en cuanto tengas más sesiones registradas."));
      return note;
    }

    var spark = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    spark.setAttribute("class", "spark");
    spark.setAttribute("viewBox", "0 0 120 32");
    spark.setAttribute("aria-hidden", "true");
    spark.setAttribute("preserveAspectRatio", "none");
    var poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("points", "2,26 22,22 42,23 62,16 82,12 102,9 118,6");
    poly.setAttribute("fill", "none");
    poly.setAttribute("stroke", "currentColor");
    poly.setAttribute("stroke-width", "2.5");
    poly.setAttribute("stroke-linecap", "round");
    poly.setAttribute("stroke-linejoin", "round");
    spark.appendChild(poly);
    note.appendChild(spark);
    note.appendChild(App.el("p", null,
      "Tu fuerza en tracción sube con constancia y la carga semanal se mantiene estable. La carrera suave del martes ayudó a recuperar sin restar piernas."));
    return note;
  }

  /* ---- 5) Actividad reciente --------------------------------------------- */

  function buildRecentActivity(data) {
    var list = App.el("ul", "log");
    data.HISTORY.slice(0, 3).forEach(function (item) { list.appendChild(buildLogItem(item)); });
    return list;
  }

  function buildLogItem(item) {
    var li = App.el("li", "log__item");
    li.appendChild(App.el("span", "log__bar log__bar--" + item.estado));
    var body = App.el("div", "log__body");
    body.appendChild(App.el("p", "log__title", item.nombre));
    var meta = item.meta + " · " + PROCEDENCIA_LABEL[item.procedencia];
    body.appendChild(App.el("p", "log__meta", meta));
    li.appendChild(body);
    li.appendChild(App.el("span", "state state--" + item.estado, ESTADO_LABEL[item.estado] || item.estado));
    return li;
  }

  /* ---- 6) Un único logro --------------------------------------------------- */

  function pickAchievement(list) {
    if (!list || !list.length) return null;
    var nearest = null;
    for (var i = 0; i < list.length; i++) {
      if (!list[i].alcanzado) { nearest = list[i]; break; }
    }
    return nearest || list[list.length - 1];
  }

  function buildAchievement(achievement) {
    var p = App.el("p", "achievement");
    var mark = App.el("span", "achievement__mark");
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l2.5 5.6 6.1.6-4.6 4.1 1.4 6-5.4-3-5.4 3 1.4-6L3.4 9.2l6.1-.6L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    p.appendChild(mark);
    p.appendChild(document.createTextNode(achievement.titulo + ". Logro privado, solo lo ves tú."));
    return p;
  }

  App.registerView("home", { title: "Tu camino", render: render });
})();
