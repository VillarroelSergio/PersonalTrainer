/* =====================================================================
 * Vista: Tu plan (LOTE 2)
 * Tres pestañas: Semana (calendario, nota 15), Fases (línea temporal,
 * nota 22) y Tus planes (gestión del ciclo de vida, nota 22).
 * El cambio de pestaña es un re-render local (sin App.navigate): no debe
 * robar el foco del título ni resetear el scroll, solo el propio tab.
 * Cualquier mutación de datos (recolocar, omitir, editar, pausar…) navega
 * de nuevo a "plan" con replace para que el router gestione foco y scroll
 * de forma consistente con el resto del prototipo.
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
    // (fuerza nunca los usa; fallback seguro donde se lea ESTADO_LABEL).
    programada_reloj: "Programada en reloj",
    realizada_pendiente_importar: "Realizada, pendiente de importar",
    importada_asociada: "Importada y asociada",
    asociada_adaptacion: "Asociada con adaptación",
    sin_resultado: "Sin resultado"
  };

  var PROCEDENCIA_LABEL = {
    local: "Registrada en la app",
    importado: "Importada del reloj",
    adaptado: "Adaptado por ti"
  };

  var PLAN_ESTADO_LABEL = {
    borrador: "Borrador",
    activo: "Activo",
    pausado: "Pausado",
    finalizado: "Finalizado",
    archivado: "Archivado"
  };

  var TABS = [
    { key: "semana", label: "Semana" },
    { key: "fases", label: "Fases" },
    { key: "gestion", label: "Tus planes" }
  ];

  /* ---- Entrada de la vista ---------------------------------------------- */

  function render(mount) {
    var ctx = App.viewContext("plan");
    if (!ctx.tab) ctx.tab = "semana";
    draw(mount, ctx);
  }

  function draw(mount, ctx) {
    mount.innerHTML = "";
    var data = App.data;

    var wrap = App.el("section", "view-plan");
    wrap.appendChild(App.el("p", "kicker", data.plan.nombre));
    wrap.appendChild(App.el("h1", "view-title", "Tu plan"));

    // ---- LOTE 3a: "Compartir" es una acción a nivel de PLAN (no de sesión),
    // en la cabecera de la vista. Reutiliza tal cual la vista "share" (nota
    // 10, share.js): no se reimplementa el enlace simulado ni la copia
    // independiente aquí.
    var shareBtn = App.el("button", "btn btn--ghost btn--sm", "Compartir plan");
    shareBtn.type = "button";
    shareBtn.addEventListener("click", function () { App.navigate("share"); });
    wrap.appendChild(shareBtn);

    wrap.appendChild(buildPlanStatus(data.plan));
    wrap.appendChild(buildTabs(ctx, mount));

    var panel = App.el("div", "tabpanel");
    panel.id = "planPanel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("tabindex", "0");
    panel.setAttribute("aria-labelledby", "planTab-" + ctx.tab);
    if (ctx.tab === "semana") renderSemana(panel, data);
    else if (ctx.tab === "fases") renderFases(panel, data);
    else renderGestion(panel, data);
    wrap.appendChild(panel);

    // ---- LOTE 2d: "Tu progreso" (progreso de bloque, estado semanal,
    // evolución, actividad reciente, logro) se movió aquí desde Home
    // (prioridad-hibrida-006, criterio 3: Home se queda en sus 3 bloques).
    // Visible al final de la vista Plan, sea cual sea la pestaña activa.
    wrap.appendChild(App.el("h2", "section-title", "Tu progreso"));
    wrap.appendChild(buildProgressSection(data));

    mount.appendChild(wrap);
  }

  function buildPlanStatus(plan) {
    var wrap = App.el("div", "planrow");
    var top = App.el("div", "planrow__top");
    var body = document.createElement("div");
    body.appendChild(App.el("p", "planrow__meta", "Semana " + plan.semanaActual + " de " + plan.semanasTotales));
    top.appendChild(body);
    top.appendChild(App.el("span", "state state--" + plan.estado, PLAN_ESTADO_LABEL[plan.estado] || plan.estado));
    wrap.appendChild(top);
    if (plan.estado === "pausado") {
      wrap.appendChild(App.el("p", "notice notice--info",
        "Plan pausado: el historial se conserva y las sesiones pendientes no cuentan como incumplimientos."));
    } else if (plan.estado !== "activo") {
      wrap.appendChild(App.el("p", "notice notice--info",
        "Este plan no está activo ahora mismo. Gestiónalo desde la pestaña “Tus planes”."));
    }
    return wrap;
  }

  /* ---- Pestañas: role=tab, aria-selected, roving tabindex --------------- */

  function buildTabs(ctx, mount) {
    var tabs = App.el("div", "tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Secciones del plan");

    TABS.forEach(function (t, i) {
      var selected = ctx.tab === t.key;
      var btn = App.el("button", "tab", t.label);
      btn.type = "button";
      btn.id = "planTab-" + t.key;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(selected));
      btn.setAttribute("aria-controls", "planPanel");
      btn.tabIndex = selected ? 0 : -1;

      btn.addEventListener("click", function () { selectTab(t.key); });
      btn.addEventListener("keydown", function (e) {
        var nextIdx = null;
        if (e.key === "ArrowRight") nextIdx = (i + 1) % TABS.length;
        else if (e.key === "ArrowLeft") nextIdx = (i - 1 + TABS.length) % TABS.length;
        else if (e.key === "Home") nextIdx = 0;
        else if (e.key === "End") nextIdx = TABS.length - 1;
        if (nextIdx === null) return;
        e.preventDefault();
        selectTab(TABS[nextIdx].key);
      });

      tabs.appendChild(btn);
    });

    function selectTab(key) {
      ctx.tab = key;
      draw(mount, ctx);
      var el = App.$("planTab-" + key);
      if (el) el.focus();
    }

    return tabs;
  }

  /* ---- Pestaña: Semana (calendario, nota 15) ----------------------------- */

  function renderSemana(panel, data) {
    var isActive = data.plan.estado === "activo";
    panel.appendChild(App.el("p", "lede small",
      "Total previsto: " + data.SESSIONS.length + " sesiones · " + data.weekPlannedMinutes() + " min previstos esta semana."));

    // ---- prioridad-hibrida-006: aviso PROACTIVO de guardarraíl (no solo
    // reactivo al intentar mover). Reutiliza data.weeklyLoadWarning(), que a
    // su vez reutiliza findConflict: nunca cambia el plan por sí solo.
    if (isActive) {
      var warn = data.weeklyLoadWarning();
      if (warn) panel.appendChild(buildLoadWarningBanner(warn, data));
    }

    var list = App.el("ol", "daylist");
    data.DAYS.forEach(function (day) {
      list.appendChild(buildDayRow(day, data, isActive));
    });
    panel.appendChild(list);
  }

  function buildDayRow(day, data, isActive) {
    var session = data.sessionOnDay(day.key);
    var ghost = session ? null : data.ghostOnDay(day.key);
    var isToday = day.key === data.hoy;

    var cls = "dayrow";
    if (session) {
      if (session.tipo === "resistencia") cls += " dayrow--cardio";
      if (session.estado === "completada" || session.estado === "adaptada" || session.estado === "parcial") cls += " dayrow--completada";
      else if (isToday) cls += " dayrow--hoy";
      else if (session.estado === "omitida") cls += " dayrow--omitida";
      else cls += " dayrow--planificada";
    } else if (ghost) {
      cls += " dayrow--ghost";
    } else {
      cls += " dayrow--descanso";
    }

    var row = App.el("li", cls);
    var top = App.el("div", "dayrow__top");
    var body = document.createElement("div");
    body.appendChild(App.el("p", "dayrow__day", day.nombre + (isToday ? " · hoy" : "")));

    if (session) {
      body.appendChild(App.el("p", "dayrow__title", session.nombre));
      var metaParts = [(session.duracionPrevista || 0) + " min previstos"];
      if (session.movedFrom) {
        metaParts.push("recolocada desde " + dayNameFromKey(data, session.movedFrom).toLowerCase());
      }
      if (session.estado === "omitida") {
        metaParts.push(session.motivoOmision ? "omitida: " + session.motivoOmision : "omitida sin motivo");
      }
      metaParts.push(PROCEDENCIA_LABEL[session.procedencia] || session.procedencia);
      body.appendChild(App.el("p", "dayrow__meta", metaParts.join(" · ")));
    } else if (ghost) {
      body.appendChild(App.el("p", "dayrow__title", "Se movió al " + dayNameFromKey(data, ghost.day).toLowerCase()));
      body.appendChild(App.el("p", "dayrow__meta",
        ghost.nombre + " ya no está aquí. No es una sesión activa: sin acciones y sin entrar en el recuento."));
    } else {
      body.appendChild(App.el("p", "dayrow__title", "Descanso"));
    }

    top.appendChild(body);
    if (session) {
      // La sincronización es un estado de la app entera (icono en la
      // cabecera), no de cada sesión: repetir aquí el mismo pill genérico en
      // cada fila contradecía visualmente el estado real de la sesión (nota
      // revisión UX: "0/4 y Push planificado" junto a "Sincronizado").
      var badges = App.el("div", "dayrow__actions");
      badges.appendChild(App.el("span", "state state--" + session.estado, ESTADO_LABEL[session.estado]));
      top.appendChild(badges);
    }
    row.appendChild(top);

    if (session && isActive) {
      var actions = App.el("div", "dayrow__actions");
      // ---- LOTE 3a: una sola acción principal visible; Editar/Omitir/
      // Recolocar se agrupan detrás de "⋯" (App.openSheet). "Deshacer…" se
      // mantiene visible aparte: es transitoria (solo tras la acción que
      // deshace) y no forma parte del grupo de gestión de la sesión.
      var menuActions = [];
      if (session.estado === "planificada") {
        // ---- resistencia-reloj-importacion-007: resistencia nunca pasa a
        // "en_curso" (no hay ejecución en la app); solo fuerza lo hace.
        // Resistencia navega directo a su propuesta de solo lectura.
        if (session.tipo === "resistencia") {
          actions.appendChild(buildActionBtn("Ver sesión", function () {
            App.navigate("train", { sessionId: session.id });
          }));
        } else {
          actions.appendChild(buildActionBtn("Iniciar", function () {
            data.setSessionState(session.id, "en_curso");
            App.navigate("train", { sessionId: session.id });
          }));
        }
        menuActions.push(["Editar", function () { openEditSheet(session, data); }]);
        menuActions.push(["Omitir", function () { openSkipSheet(session, data); }]);
        menuActions.push(["Recolocar", function () { openMoveSheet(session, data); }]);
      } else if (session.estado === "omitida") {
        menuActions.push(["Editar", function () { openEditSheet(session, data); }]);
        menuActions.push(["Recolocar", function () { openMoveSheet(session, data); }]);
        if (isUndoable(data, "omitir", session.id)) {
          actions.appendChild(buildActionBtn("Deshacer omisión", function () { runUndo(data, "Omisión deshecha."); }));
        }
      }
      if (session.movedFrom && isUndoable(data, "recolocar", session.id)) {
        actions.appendChild(buildActionBtn("Deshacer recolocación", function () { runUndo(data, "Recolocación deshecha."); }));
      }
      if (menuActions.length) {
        var moreBtn = buildActionBtn("⋯", function () { openSessionMenuSheet(session, menuActions); });
        moreBtn.setAttribute("aria-label", "Más acciones para " + session.nombre);
        actions.appendChild(moreBtn);
      }
      if (actions.childNodes.length) row.appendChild(actions);
    }

    return row;
  }

  // Hoja "⋯" con las acciones secundarias de gestión de una sesión
  // (Editar/Omitir/Recolocar). Cada opción cierra la hoja antes de abrir su
  // propio flujo, igual que el resto de hojas de este archivo.
  function openSessionMenuSheet(session, menuActions) {
    App.openSheet({
      title: session.nombre,
      render: function (body) {
        menuActions.forEach(function (pair) {
          var btn = App.el("button", "opt");
          btn.type = "button";
          btn.appendChild(App.el("span", "opt__name", pair[0]));
          btn.addEventListener("click", function () { App.closeSheet(); pair[1](); });
          body.appendChild(btn);
        });
      }
    });
  }

  /* ---- "Tu progreso" (movido desde home.js, LOTE 2d) --------------------- */
  /* Mismo contenido y orden que antes en Home: progreso de bloque, estado
   * semanal, evolución breve (nunca inventa una tendencia sin datos) y un
   * único logro. Reutiliza data.ACHIEVEMENTS/data.HISTORY tal cual. */

  function buildProgressSection(data) {
    var host = App.el("div", "plan-progress");

    host.appendChild(App.el("p", "field__label", data.plan.nombre));
    host.appendChild(buildBlockProgress(data.plan));
    host.appendChild(buildWeekStats(data));

    host.appendChild(App.el("p", "field__label", "Cómo va"));
    host.appendChild(buildEvolutionNote(data));

    host.appendChild(App.el("p", "field__label", "Actividad reciente"));
    host.appendChild(buildRecentActivity(data));

    var achievement = pickAchievement(data.ACHIEVEMENTS);
    if (achievement) host.appendChild(buildAchievement(achievement));

    return host;
  }

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

  // LOTE 4 (home.js original): nunca se afirma una evolución que no existe.
  // Sin historial previo, no se inventa una tendencia.
  function buildEvolutionNote(data) {
    var note = App.el("div", "note");

    if (!data.HISTORY || !data.HISTORY.length) {
      note.appendChild(App.el("p", null,
        "Todavía no hay sesiones registradas para mostrar una evolución. Aparecerá aquí en cuanto completes tu primera sesión."));
      return note;
    }

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

  function isUndoable(data, type, sessionId) {
    return !!(data.lastAction && data.lastAction.type === type && data.lastAction.sessionId === sessionId);
  }

  function runUndo(data, message) {
    data.undoLastAction();
    App.toast(message);
    App.navigate("plan", {}, { replace: true });
  }

  function dayNameFromKey(data, key) {
    var d = data.dayByKey(key);
    return d ? d.nombre : key;
  }

  function buildActionBtn(label, onClick) {
    var btn = App.el("button", "chip", label);
    btn.type = "button";
    btn.addEventListener("click", onClick);
    return btn;
  }

  /* ---- prioridad-hibrida-006: guardarraíl de carga con 4 salidas --------- */
  /* Nunca bloquea ni cambia el plan sin confirmación explícita: cada opción
   * exige tocar su propio botón. Reutilizado tanto por el aviso proactivo de
   * esta pestaña como por el flujo reactivo de recolocar (openConflictSheet). */

  function buildLoadWarningBanner(warn, data) {
    var box = App.el("div", "notice notice--warn");
    box.appendChild(App.el("p", null,
      warn.session.nombre + " queda junto a " + warn.conflict.nombre.toLowerCase() +
      ": puedes llegar con más fatiga a una de las dos sesiones. Tú decides qué hacer."));
    var btn = App.el("button", "btn btn--ghost btn--block", "Ver opciones");
    btn.type = "button";
    btn.addEventListener("click", function () { openGuardrailSheet(warn.session, warn.conflict, data); });
    box.appendChild(btn);
    return box;
  }

  function openGuardrailSheet(session, conflict, data) {
    App.openSheet({
      title: "Choque de carga: " + session.nombre + " y " + conflict.nombre,
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          session.nombre + " y " + conflict.nombre.toLowerCase() + " quedan en días seguidos. Ninguna opción se aplica sola: eliges tú."));

        var keepBtn = App.el("button", "opt");
        keepBtn.type = "button";
        keepBtn.appendChild(App.el("span", "opt__name", "Mantener"));
        keepBtn.appendChild(App.el("span", "opt__meta", "Dejar el plan tal como está."));
        keepBtn.addEventListener("click", function () { App.closeSheet(); App.toast("Mantienes el plan tal como está."); });
        body.appendChild(keepBtn);

        var moveBtn = App.el("button", "opt");
        moveBtn.type = "button";
        moveBtn.appendChild(App.el("span", "opt__name", "Mover"));
        moveBtn.appendChild(App.el("span", "opt__meta", "Elegir otro día para " + session.nombre.toLowerCase() + "."));
        moveBtn.addEventListener("click", function () { App.closeSheet(); openMoveSheet(session, data); });
        body.appendChild(moveBtn);

        var softBtn = App.el("button", "opt");
        softBtn.type = "button";
        softBtn.appendChild(App.el("span", "opt__name", "Hacer versión suave"));
        softBtn.appendChild(App.el("span", "opt__meta", "Reduce la intensidad sin cambiarla de día."));
        softBtn.addEventListener("click", function () { App.closeSheet(); applySoftVersion(session, data); });
        body.appendChild(softBtn);

        var envBtn = App.el("button", "opt");
        envBtn.type = "button";
        envBtn.appendChild(App.el("span", "opt__name", "Cambiar de entorno"));
        envBtn.appendChild(App.el("span", "opt__meta", "Sustituye por una alternativa de bajo impacto (cinta, casa, bici estática)."));
        envBtn.addEventListener("click", function () { App.closeSheet(); applyEnvChange(session, data); });
        body.appendChild(envBtn);
      }
    });
  }

  // "Hacer versión suave": mismo criterio que endurance.js (reducir a ~60%
  // de la duración prevista, marcar adaptada). Aplica también a fuerza.
  function applySoftVersion(session, data) {
    session.duracionPrevista = Math.max(10, Math.round((session.duracionPrevista || 30) * 0.6));
    session.esAdaptada = true;
    session.procedencia = "adaptado";
    session.sync = "local";
    App.toast(session.nombre + ": versión suave aplicada (" + session.duracionPrevista + " min).");
    App.navigate("plan", {}, { replace: true });
  }

  function applyEnvChange(session, data) {
    if (session.nombre.indexOf("(entorno de bajo impacto)") < 0) {
      session.nombre = session.nombre + " (entorno de bajo impacto)";
    }
    session.esAdaptada = true;
    session.procedencia = "adaptado";
    session.sync = "local";
    App.toast("Cambiada a un entorno de bajo impacto (cinta, casa o bici estática).");
    App.navigate("plan", {}, { replace: true });
  }

  /* ---- Hoja: recolocar sesión -------------------------------------------- */

  function openMoveSheet(session, data) {
    var days = data.freeDays(session.day);
    App.openSheet({
      title: "Recolocar " + session.nombre,
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          "Elige el día destino. El total semanal previsto y los minutos no cambian: la sesión se mueve, no se duplica."));
        if (!days.length) {
          body.appendChild(App.el("p", "notice notice--info", "No hay días libres esta semana para recolocar."));
          return;
        }
        days.forEach(function (day) {
          var conflict = data.findConflict(data.SESSIONS, day.key, session);
          var btn = App.el("button", "opt");
          btn.type = "button";
          btn.appendChild(App.el("span", "opt__name", day.nombre));
          btn.appendChild(App.el("span", "opt__meta", conflict ? "Choque de carga" : "Sin choque"));
          btn.addEventListener("click", function () {
            App.closeSheet();
            if (conflict) openConflictSheet(session, day, conflict, data, days);
            else confirmMove(session, day, data);
          });
          body.appendChild(btn);
        });
      }
    });
  }

  function confirmMove(session, day, data) {
    App.confirmSheet({
      title: "Confirmar recolocación",
      body: "Mover " + session.nombre + " a " + day.nombre.toLowerCase() +
        ". El día de origen quedará marcado como recolocado, sin acciones propias ni recuento aparte.",
      confirmLabel: "Recolocar",
      onConfirm: function () {
        data.moveSession(session.id, day.key);
        App.toast(session.nombre + " se movió a " + day.nombre.toLowerCase() + ".");
        App.navigate("plan", {}, { replace: true });
      }
    });
  }

  function openConflictSheet(session, day, otherSession, data, allDays) {
    App.openSheet({
      title: "Choque de carga en " + day.nombre.toLowerCase(),
      render: function (body) {
        body.appendChild(App.el("p", "notice notice--warn",
          "Junto a " + otherSession.nombre.toLowerCase() + " puedes llegar con más fatiga a una de las dos sesiones. " +
          "Puedes moverla igualmente o elegir otro día."));

        var alternatives = allDays.filter(function (d) {
          return d.key !== day.key && !data.findConflict(data.SESSIONS, d.key, session);
        });
        if (alternatives.length) {
          body.appendChild(App.el("p", "field__label", "Destinos alternativos sin choque"));
          alternatives.forEach(function (d) {
            var altBtn = App.el("button", "opt");
            altBtn.type = "button";
            altBtn.appendChild(App.el("span", "opt__name", d.nombre));
            altBtn.appendChild(App.el("span", "opt__meta", "Sin choque"));
            altBtn.addEventListener("click", function () { App.closeSheet(); confirmMove(session, d, data); });
            body.appendChild(altBtn);
          });
        }

        var confirmBtn = App.el("button", "btn btn--primary btn--block", "Mover igualmente a " + day.nombre.toLowerCase());
        confirmBtn.type = "button";
        confirmBtn.addEventListener("click", function () { App.closeSheet(); confirmMove(session, day, data); });
        body.appendChild(confirmBtn);

        // ---- prioridad-hibrida-006: mismas 4 salidas del guardarraíl,
        // también accesibles desde el flujo reactivo de recolocar. "Mantener"
        // aquí equivale a cancelar (el día de origen no cambia).
        var softBtn = App.el("button", "btn btn--ghost btn--block", "Hacer versión suave en vez de mover");
        softBtn.type = "button";
        softBtn.addEventListener("click", function () { App.closeSheet(); applySoftVersion(session, data); });
        body.appendChild(softBtn);

        var envBtn = App.el("button", "btn btn--ghost btn--block", "Cambiar de entorno en vez de mover");
        envBtn.type = "button";
        envBtn.addEventListener("click", function () { App.closeSheet(); applyEnvChange(session, data); });
        body.appendChild(envBtn);

        var cancelBtn = App.el("button", "btn btn--ghost btn--block", "Mantener (cancelar)");
        cancelBtn.type = "button";
        cancelBtn.addEventListener("click", function () { App.closeSheet(); });
        body.appendChild(cancelBtn);
      }
    });
  }

  /* ---- Hoja: omitir sesión ------------------------------------------------ */

  function openSkipSheet(session, data) {
    var motivo = null;
    App.openSheet({
      title: "Omitir " + session.nombre,
      render: function (body) {
        body.appendChild(App.el("p", "lede small", "El motivo es opcional. Puedes deshacer la omisión justo después."));
        var group = App.el("div", "picker picker--wide");
        group.setAttribute("role", "group");
        group.setAttribute("aria-label", "Motivo (opcional)");
        data.SKIP_REASONS.forEach(function (reason) {
          var btn = App.el("button", "picker__btn", reason);
          btn.type = "button";
          btn.setAttribute("aria-pressed", "false");
          btn.addEventListener("click", function () {
            var wasSelected = motivo === reason;
            motivo = wasSelected ? null : reason;
            Array.prototype.forEach.call(group.children, function (c) { c.setAttribute("aria-pressed", "false"); });
            if (!wasSelected) btn.setAttribute("aria-pressed", "true");
          });
          group.appendChild(btn);
        });
        body.appendChild(group);

        var confirmBtn = App.el("button", "btn btn--primary btn--block", "Confirmar omisión");
        confirmBtn.type = "button";
        confirmBtn.addEventListener("click", function () {
          App.closeSheet();
          data.skipSession(session.id, motivo);
          App.toast(session.nombre + " se omitió.");
          App.navigate("plan", {}, { replace: true });
        });
        body.appendChild(confirmBtn);

        var cancelBtn = App.el("button", "btn btn--ghost btn--block", "Cancelar");
        cancelBtn.type = "button";
        cancelBtn.addEventListener("click", function () { App.closeSheet(); });
        body.appendChild(cancelBtn);
      }
    });
  }

  /* ---- Hoja: editar sesión ------------------------------------------------ */

  function openEditSheet(session, data) {
    App.openSheet({
      title: "Editar " + session.nombre,
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          "Cambiar el nombre o el tipo no afecta a sesiones ya realizadas ni a sus registros."));

        var nameField = App.el("div", "field");
        var label = App.el("label", "field__label", "Nombre de la sesión");
        label.setAttribute("for", "editSessionName");
        nameField.appendChild(label);
        var input = document.createElement("input");
        input.type = "text";
        input.id = "editSessionName";
        input.value = session.nombre;
        nameField.appendChild(input);
        body.appendChild(nameField);

        var typeGroup = App.el("div", "picker");
        typeGroup.setAttribute("role", "group");
        typeGroup.setAttribute("aria-label", "Tipo de sesión");
        var newTipo = session.tipo;
        ["fuerza", "resistencia"].forEach(function (tipo) {
          var b = App.el("button", "picker__btn", tipo === "fuerza" ? "Fuerza" : "Resistencia");
          b.type = "button";
          b.setAttribute("aria-pressed", String(tipo === newTipo));
          b.addEventListener("click", function () {
            newTipo = tipo;
            Array.prototype.forEach.call(typeGroup.children, function (c) { c.setAttribute("aria-pressed", "false"); });
            b.setAttribute("aria-pressed", "true");
          });
          typeGroup.appendChild(b);
        });
        body.appendChild(typeGroup);

        var confirmBtn = App.el("button", "btn btn--primary btn--block", "Guardar cambios");
        confirmBtn.type = "button";
        confirmBtn.addEventListener("click", function () {
          if (!input.value.trim()) { App.toast("Escribe un nombre para la sesión."); return; }
          App.closeSheet();
          data.editSession(session.id, { nombre: input.value.trim(), tipo: newTipo });
          App.toast("Sesión actualizada.");
          App.navigate("plan", {}, { replace: true });
        });
        body.appendChild(confirmBtn);

        var cancelBtn = App.el("button", "btn btn--ghost btn--block", "Cancelar");
        cancelBtn.type = "button";
        cancelBtn.addEventListener("click", function () { App.closeSheet(); });
        body.appendChild(cancelBtn);
      }
    });
  }

  /* ---- Pestaña: Fases (línea temporal, nota 22) -------------------------- */

  function renderFases(panel, data) {
    var plan = data.plan;
    if (!plan.fases || !plan.fases.length) {
      App.states.empty(panel, {
        title: "Sin línea temporal todavía",
        body: "Este plan no tiene fases generadas. Actívalo desde “Tus planes” para generarlas."
      });
      return;
    }

    var bar = App.el("div", "phasebar");
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", "Progresión de fases, semana " + plan.semanaActual + " de " + plan.semanasTotales);
    plan.fases.forEach(function (f) {
      var seg = App.el("div", "phaseseg" + (f.estado === "completada" ? " phaseseg--done" : f.estado === "actual" ? " phaseseg--current" : ""));
      seg.style.flexGrow = String(f.span);
      seg.style.flexBasis = "0";
      seg.textContent = f.span + (f.span === 1 ? " sem" : " sem");
      bar.appendChild(seg);
    });
    panel.appendChild(bar);

    var list = App.el("ul", "phaselist");
    plan.fases.forEach(function (f) {
      var li = App.el("li", f.estado === "actual" ? "is-current" : "");
      var body = document.createElement("div");
      body.appendChild(App.el("p", "phase__name", f.nombre));
      body.appendChild(App.el("p", "lede small", f.proposito));
      li.appendChild(body);
      li.appendChild(App.el("span", "phase__weeks", f.semanas));
      list.appendChild(li);
    });
    panel.appendChild(list);

    panel.appendChild(App.el("p", "lede small",
      "El cambio de fase se explica por su propósito (adaptación, progresión, descarga o mantenimiento), nunca por un cálculo oculto."));
  }

  /* ---- Pestaña: Tus planes (ciclo de vida, nota 22) ----------------------- */

  function renderGestion(panel, data) {
    var list = App.el("ul", "planlist");
    data.PLANS.forEach(function (plan) {
      list.appendChild(buildPlanRow(plan, data));
    });
    panel.appendChild(list);

    var createBtn = App.el("button", "btn btn--ghost btn--block", "Crear plan nuevo");
    createBtn.type = "button";
    createBtn.addEventListener("click", function () { App.navigate("planBuilder"); });
    panel.appendChild(createBtn);
  }

  function buildPlanRow(plan, data) {
    var li = App.el("li", "planrow");
    var top = App.el("div", "planrow__top");
    var body = document.createElement("div");
    body.appendChild(App.el("p", "planrow__title", plan.nombre));
    body.appendChild(App.el("p", "planrow__meta", planMetaText(plan, data)));
    top.appendChild(body);
    top.appendChild(App.el("span", "state state--" + plan.estado, PLAN_ESTADO_LABEL[plan.estado] || plan.estado));
    li.appendChild(top);

    var actions = App.el("div", "planrow__actions");
    if (plan.estado === "borrador") {
      actions.appendChild(buildActionBtn("Activar", function () { confirmActivate(plan, data); }));
      actions.appendChild(buildActionBtn("Renombrar", function () { openRenameSheet(plan, data); }));
    } else if (plan.estado === "activo") {
      actions.appendChild(buildActionBtn("Pausar", function () {
        confirmLifecycle(plan, data, "pausado", "Pausar plan",
          "El historial se conserva. Las sesiones pendientes no se presentarán como incumplimientos mientras esté pausado.");
      }));
      actions.appendChild(buildActionBtn("Finalizar", function () {
        confirmLifecycle(plan, data, "finalizado", "Finalizar plan",
          "El plan pasa a finalizado. Podrás archivarlo después conservando el historial.");
      }));
      actions.appendChild(buildActionBtn("Duplicar", function () { confirmDuplicate(plan, data); }));
    } else if (plan.estado === "pausado") {
      actions.appendChild(buildActionBtn("Reanudar", function () {
        confirmLifecycle(plan, data, "activo", "Reanudar plan", "Vuelves a la semana en curso tal y como la dejaste.");
      }));
      actions.appendChild(buildActionBtn("Finalizar", function () {
        confirmLifecycle(plan, data, "finalizado", "Finalizar plan", "El plan pasa a finalizado.");
      }));
      actions.appendChild(buildActionBtn("Duplicar", function () { confirmDuplicate(plan, data); }));
    } else if (plan.estado === "finalizado") {
      actions.appendChild(buildActionBtn("Archivar", function () {
        confirmLifecycle(plan, data, "archivado", "Archivar plan", "El historial queda conservado como referencia.");
      }));
      actions.appendChild(buildActionBtn("Duplicar", function () { confirmDuplicate(plan, data); }));
    } else if (plan.estado === "archivado") {
      actions.appendChild(buildActionBtn("Duplicar", function () { confirmDuplicate(plan, data); }));
    }
    if (actions.childNodes.length) li.appendChild(actions);

    return li;
  }

  function planMetaText(plan, data) {
    var estadoTxt = PLAN_ESTADO_LABEL[plan.estado] || plan.estado;
    if (plan.estado === "activo" || plan.estado === "pausado") {
      return estadoTxt + " · semana " + plan.semanaActual + " de " + plan.semanasTotales;
    }
    if (plan.estado === "finalizado" || plan.estado === "archivado") {
      return estadoTxt + " · " + plan.semanasTotales + " semanas";
    }
    var tmpl = plan.plantilla && data.PLAN_TEMPLATES[plan.plantilla];
    return estadoTxt + (tmpl ? " · plantilla " + tmpl.nombre : "");
  }

  function confirmActivate(plan, data) {
    App.confirmSheet({
      title: "Activar " + plan.nombre,
      body: "Se generará su semana con ajustes por defecto (editables después)." +
        (data.plan.estado === "activo" && data.plan.id !== plan.id ? " El plan activo actual (" + data.plan.nombre + ") pasará a pausado." : ""),
      confirmLabel: "Activar",
      onConfirm: function () {
        if (data.plan.estado === "activo" && data.plan.id !== plan.id) data.plan.estado = "pausado";
        // Si el borrador viene del creador guiado ("Guardar como borrador y
        // editar en el calendario") ya trae su propia semana: se respeta en
        // vez de regenerar una por defecto.
        var generated = (plan.sessions && plan.sessions.length) ? plan.sessions : data.generatePlanWeek({
          modo: "plantilla",
          plantilla: plan.plantilla || "ppl",
          diasDisponibles: "4",
          duracionHabitual: "40 min",
          cardioActividad: "Ninguna",
          cardioFrecuencia: "0"
        }).sessions;
        data.SESSIONS.length = 0;
        Array.prototype.push.apply(data.SESSIONS, generated);
        plan.estado = "activo";
        plan.fases = data.buildFasesFromTemplate(1);
        plan.semanaActual = 1;
        plan.semanasTotales = plan.semanasTotales || 8;
        plan.constanciaSemanas = plan.constanciaSemanas || 0;
        data.plan = plan;
        data.lastAction = null;
        App.toast(plan.nombre + " está activo.");
        App.navigate("plan", {}, { replace: true });
      }
    });
  }

  function confirmLifecycle(plan, data, nextEstado, title, body) {
    App.confirmSheet({
      title: title,
      body: body,
      confirmLabel: title,
      onConfirm: function () {
        plan.estado = nextEstado;
        App.toast(plan.nombre + ": " + (PLAN_ESTADO_LABEL[nextEstado] || nextEstado).toLowerCase() + ".");
        App.navigate("plan", {}, { replace: true });
      }
    });
  }

  function confirmDuplicate(plan, data) {
    App.confirmSheet({
      title: "Duplicar " + plan.nombre,
      body: "Se creará una copia independiente en borrador. Los cambios que hagas en la copia no afectan a este plan.",
      confirmLabel: "Duplicar",
      onConfirm: function () {
        var copy = JSON.parse(JSON.stringify(plan));
        copy.id = "plan-copia-" + Date.now();
        copy.nombre = plan.nombre + " (copia)";
        copy.estado = "borrador";
        copy.semanaActual = 0;
        copy.constanciaSemanas = 0;
        data.PLANS.push(copy);
        App.toast("Copia creada: " + copy.nombre);
        App.navigate("plan", {}, { replace: true });
      }
    });
  }

  function openRenameSheet(plan, data) {
    App.openSheet({
      title: "Renombrar plan",
      render: function (body) {
        var field = App.el("div", "field");
        var label = App.el("label", "field__label", "Nombre del plan");
        label.setAttribute("for", "renamePlanInput");
        field.appendChild(label);
        var input = document.createElement("input");
        input.type = "text";
        input.id = "renamePlanInput";
        input.value = plan.nombre;
        field.appendChild(input);
        body.appendChild(field);

        var confirmBtn = App.el("button", "btn btn--primary btn--block", "Guardar nombre");
        confirmBtn.type = "button";
        confirmBtn.addEventListener("click", function () {
          if (!input.value.trim()) { App.toast("Escribe un nombre."); return; }
          plan.nombre = input.value.trim();
          App.closeSheet();
          App.toast("Nombre actualizado.");
          App.navigate("plan", {}, { replace: true });
        });
        body.appendChild(confirmBtn);

        var cancelBtn = App.el("button", "btn btn--ghost btn--block", "Cancelar");
        cancelBtn.type = "button";
        cancelBtn.addEventListener("click", function () { App.closeSheet(); });
        body.appendChild(cancelBtn);
      }
    });
  }

  App.registerView("plan", { title: "Tu plan", render: render });
})();
