/* =====================================================================
 * Vista: Sesión de fuerza — lista, tarjeta de ejercicio y cierre (LOTE 3)
 * Notas 05, 19, 20. Registrado 100% en App.data (data.SESSION_PROGRESS,
 * los propios objetos de ejercicio): "Entrenar" recupera la sesión en
 * curso donde se quedó, sin depender de variables locales de la vista.
 * El temporizador de descanso SÍ vive en variables de módulo: es un reloj
 * en ejecución, no un dato que deba sobrevivir a una recarga de página.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  var ESFUERZO_OPCIONES = ["Muy fácil", "Fácil", "Adecuado", "Duro", "Muy duro"];
  var MOLESTIA_CIERRE_OPCIONES = ["Ninguna", "Leve", "Moderada", "Importante"];

  var SAFETY_TEXT = "Molestia importante: esto no es un diagnóstico. Si la molestia persiste o es intensa, " +
    "considera detener o adaptar la sesión y consultar a un profesional de salud.";

  // ---- Temporizador de descanso: estado de ejecución, no de datos --------
  var restTimerHandle = null;
  var restTimerRemaining = 0;
  var restTimerExerciseId = null;

  // ---- Barra persistente de sesión (LOTE 3 mejoras-ux-ui-004): vive fuera
  // de las tarjetas de ejercicio para sobrevivir al cambiar de ejercicio o
  // volver a la lista. Se reconstruye en cada render de "train" (drawList/
  // drawExercise) y se refresca a mano tras cualquier acción que cambie el
  // progreso o el descanso, sin depender de una renavegación completa.
  var sessionBarEl = null;
  var sessionBarCtx = null; // { session, data, ex, mount }

  // ---- registro-un-toque: última acción reversible dentro de la tarjeta
  // de ejercicio abierta (repetir serie, añadir serie, cambiar variante).
  // ponytail: un único slot por ejercicio (igual que data.lastAction para
  // el calendario), no una pila; basta para deshacer la última acción.
  var lastExerciseAction = null;

  /* ---- Entrada de la vista ------------------------------------------------ */

  function render(mount, params) {
    var data = App.data;
    var session = resolveSession(data, params);

    if (!session) {
      var wrap0 = App.el("section", "view-strength");
      wrap0.appendChild(App.el("h1", "view-title", "Entrenar"));
      App.states.empty(wrap0, {
        title: "No hay ninguna sesión de fuerza para hoy",
        body: "Revisa tu plan para ver qué toca esta semana.",
        actionLabel: "Ver plan",
        onAction: function () { App.navigate("plan"); }
      });
      mount.appendChild(wrap0);
      return;
    }

    // ---- LOTE 5: "Entrenar" es el punto de entrada único (nota 21); una
    // sesión de resistencia se ejecuta en su propia vista, no aquí. Único
    // punto tocado de strength.js para este lote: antes mostraba un estado
    // vacío ("llega en un lote posterior"), ahora enruta de verdad.
    if (session.tipo !== "fuerza") {
      App.navigate("endurance", { sessionId: session.id }, { replace: true });
      return;
    }

    // Al abrir una sesión planificada, pasa a en_curso (nota 13/29): ocurra
    // desde el hero de inicio, el plan o el check-in, el estado es el mismo.
    if (session.estado === "planificada") {
      data.setSessionState(session.id, "en_curso");
    }

    var progress = data.sessionProgress(session.id);
    if (progress.openExerciseId) {
      var openEx = findOpenExercise(data, session, progress);
      if (openEx) { drawExercise(mount, data, session, openEx); return; }
      progress.openExerciseId = null;
    }
    drawList(mount, data, session);
  }

  function resolveSession(data, params) {
    if (params && params.sessionId) {
      var s = data.findSession(params.sessionId);
      if (s) return s;
    }
    // Nota 13: sin sessionId explícito, recupera la sesión en_curso si hay una.
    var enCurso = data.SESSIONS.filter(function (s) { return s.estado === "en_curso"; })[0];
    if (enCurso) return enCurso;
    return data.sessionOnDay(data.hoy);
  }

  function findOpenExercise(data, session, progress) {
    var list = data.exercisesForSession(session.id) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === progress.openExerciseId) return list[i];
    }
    return null;
  }

  /* ---- Lista de ejercicios ------------------------------------------------- */

  function drawList(mount, data, session) {
    var list = data.exercisesForSession(session.id) || [];
    var stats = data.sessionStats(session.id);

    var wrap = App.el("section", "view-strength");
    wrap.appendChild(App.el("p", "kicker", session.nombre + (session.esAdaptada ? " · versión adaptada" : "")));
    wrap.appendChild(App.el("h1", "view-title", session.nombre));

    var badges = App.el("div", "badge-row");
    if (session.esAdaptada) badges.appendChild(App.el("span", "state state--adaptada", "Sesión adaptada"));
    wrap.appendChild(badges);

    var pct = stats.setsTotal ? Math.round((stats.setsDone / stats.setsTotal) * 100) : 0;
    var meterWrap = App.el("div", "session-meter");
    var meter = App.el("div", "meter");
    meter.setAttribute("role", "img");
    meter.setAttribute("aria-label", "Progreso de la sesión: " + pct + " por ciento de las series registradas");
    var fill = App.el("div", "meter__fill");
    fill.style.width = pct + "%";
    meter.appendChild(fill);
    meterWrap.appendChild(meter);
    meterWrap.appendChild(App.el("p", "meter__text",
      stats.exDone + " de " + stats.exTotal + " ejercicios · " + stats.setsDone + " de " + stats.setsTotal + " series"));
    wrap.appendChild(meterWrap);

    var ol = App.el("ol", "exlist");
    list.forEach(function (ex, i) {
      ol.appendChild(buildExerciseRow(ex, i, list, session, data, mount));
    });
    wrap.appendChild(ol);

    // C1: región viva para anunciar el resultado de reordenar (el foco vuelve
    // al botón ↑/↓ del ejercicio movido; esto solo añade el anuncio sonoro).
    var reorderLive = App.el("p", "sr-only", "");
    reorderLive.id = "exReorderAnnounce";
    reorderLive.setAttribute("aria-live", "polite");
    reorderLive.setAttribute("aria-atomic", "true");
    wrap.appendChild(reorderLive);

    var addBtn = App.el("button", "btn btn--ghost btn--block", "+ Añadir ejercicio");
    addBtn.type = "button";
    addBtn.addEventListener("click", function () { openAddExerciseSheet(session, data, mount); });
    wrap.appendChild(addBtn);

    var finishBtn = App.el("button", "btn btn--primary btn--block", "Terminar sesión");
    finishBtn.type = "button";
    finishBtn.addEventListener("click", function () { handleFinishClick(session, data, mount); });
    wrap.appendChild(finishBtn);

    mount.appendChild(wrap);
    mountSessionBar(mount, session, data, null);
  }

  function buildExerciseRow(ex, index, list, session, data, mount) {
    var li = App.el("li", ex.omitido ? "is-omitted" : null);
    var setsDone = ex.sets.filter(function (s) { return s.estado === "hecha"; }).length;
    var allDone = ex.sets.length > 0 && setsDone === ex.sets.length && !ex.omitido;

    var btn = App.el("button", "exrow" + (allDone ? " is-done" : "") + (ex.omitido ? " is-omitido" : ""));
    btn.type = "button";
    btn.appendChild(App.el("span", "exrow__index", allDone ? "✓" : String(index + 1)));

    var body = App.el("span", "exrow__body");
    body.appendChild(App.el("span", "exrow__name", ex.nombre + (ex.omitido ? " · omitido" : "")));
    body.appendChild(App.el("span", "exrow__meta", ex.variante + " · " + setsDone + "/" + ex.sets.length + " series · " + ex.objetivo));
    btn.appendChild(body);

    var pips = App.el("span", "exrow__sets");
    ex.sets.forEach(function (s) { pips.appendChild(App.el("span", "exrow__pip" + (s.estado === "hecha" ? " is-done" : ""))); });
    btn.appendChild(pips);

    btn.setAttribute("aria-label", ex.nombre + ", " + setsDone + " de " + ex.sets.length + " series registradas" + (ex.omitido ? ", omitido" : ""));
    btn.addEventListener("click", function () {
      var progress = data.sessionProgress(session.id);
      progress.openExerciseId = ex.id;
      progress.mode = progress.mode || "confirm";
      App.navigate("train", { sessionId: session.id }, { replace: true });
    });
    li.appendChild(btn);

    var actions = App.el("div", "dayrow__actions");
    var upBtn = App.el("button", "chip", "↑ Subir");
    upBtn.type = "button";
    upBtn.id = "exUp-" + ex.id;
    upBtn.setAttribute("aria-label", "Subir " + ex.nombre + " en el orden de la sesión");
    if (index === 0) upBtn.disabled = true;
    upBtn.addEventListener("click", function () {
      list.splice(index - 1, 0, list.splice(index, 1)[0]);
      App.navigate("train", { sessionId: session.id }, { replace: true });
      finishReorder(ex, index - 1, list.length, "up");
    });
    actions.appendChild(upBtn);

    var downBtn = App.el("button", "chip", "↓ Bajar");
    downBtn.type = "button";
    downBtn.id = "exDown-" + ex.id;
    downBtn.setAttribute("aria-label", "Bajar " + ex.nombre + " en el orden de la sesión");
    if (index === list.length - 1) downBtn.disabled = true;
    downBtn.addEventListener("click", function () {
      list.splice(index + 1, 0, list.splice(index, 1)[0]);
      App.navigate("train", { sessionId: session.id }, { replace: true });
      finishReorder(ex, index + 1, list.length, "down");
    });
    actions.appendChild(downBtn);

    var skipBtn = App.el("button", "chip", ex.omitido ? "Incluir de nuevo" : "Omitir");
    skipBtn.type = "button";
    skipBtn.addEventListener("click", function () {
      ex.omitido = !ex.omitido;
      App.toast(ex.omitido ? ex.nombre + " se marcó como omitido. La sesión sigue abierta." : ex.nombre + " vuelve a la sesión.");
      App.navigate("train", { sessionId: session.id }, { replace: true });
    });
    actions.appendChild(skipBtn);

    li.appendChild(actions);
    return li;
  }

  // C1: tras reordenar, App.navigate({replace:true}) repinta la lista entera y
  // manda el foco al <h1> (comportamiento normal de navegación). Aquí, DESPUÉS
  // de esa repintada síncrona, devolvemos el foco al botón ↑/↓ del ejercicio
  // movido (con fallback al otro botón si el que se pulsó quedó deshabilitado
  // en el extremo de la lista) y anunciamos la nueva posición.
  function finishReorder(ex, newIndex, total, dir) {
    var live = App.$("exReorderAnnounce");
    if (live) live.textContent = ex.nombre + " ahora en la posición " + (newIndex + 1) + " de " + total + ".";
    var primary = App.$((dir === "up" ? "exUp-" : "exDown-") + ex.id);
    var fallback = App.$((dir === "up" ? "exDown-" : "exUp-") + ex.id);
    var target = (primary && !primary.disabled) ? primary : (fallback && !fallback.disabled ? fallback : null);
    if (target) target.focus();
  }

  /* ---- Añadir ejercicio: catálogo breve + propio (punto de entrada, nota 20) */

  function openAddExerciseSheet(session, data, mount) {
    App.openSheet({
      title: "Añadir ejercicio a " + session.nombre,
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          "Se añade solo a la sesión de hoy: tu plantilla del plan no cambia salvo que lo confirmes tú mismo desde el plan."));

        body.appendChild(App.el("p", "field__label", "Catálogo breve (el catálogo completo llega en el próximo lote)"));
        var group = App.el("div", "optgroup");
        data.CATALOG_QUICK_ADD.forEach(function (item) {
          var opt = App.el("button", "opt");
          opt.type = "button";
          opt.appendChild(App.el("span", "opt__name", item.nombre));
          opt.appendChild(App.el("span", "opt__meta", item.patron));
          opt.addEventListener("click", function () {
            addExerciseToSession(session, data, { nombre: item.nombre, patron: item.patron, objetivo: item.objetivo });
            App.closeSheet();
            App.toast(item.nombre + " se añadió a la sesión de hoy.");
            App.navigate("train", { sessionId: session.id }, { replace: true });
          });
          group.appendChild(opt);
        });
        body.appendChild(group);

        body.appendChild(App.el("p", "field__label", "O crea uno propio"));
        var nameField = App.el("div", "field");
        var label = App.el("label", "field__label", "Nombre del ejercicio");
        label.setAttribute("for", "customExName");
        nameField.appendChild(label);
        var input = document.createElement("input");
        input.type = "text";
        input.id = "customExName";
        nameField.appendChild(input);
        body.appendChild(nameField);

        var createBtn = App.el("button", "btn btn--ghost btn--block", "Crear y añadir");
        createBtn.type = "button";
        createBtn.addEventListener("click", function () {
          var name = input.value.trim();
          if (!name) {
            input.setAttribute("aria-invalid", "true");
            App.toast("Escribe un nombre para tu ejercicio propio.");
            input.focus();
            return;
          }
          addExerciseToSession(session, data, { nombre: name, patron: "Personalizado", objetivo: "3 × 10-12 reps" });
          App.closeSheet();
          App.toast(name + " se añadió a la sesión de hoy.");
          App.navigate("train", { sessionId: session.id }, { replace: true });
        });
        body.appendChild(createBtn);
      }
    });
  }

  function addExerciseToSession(session, data, def) {
    var list = data.exercisesForSession(session.id);
    var id = "custom-" + Date.now();
    list.push({
      id: id, nombre: def.nombre, variante: "Estándar",
      patron: def.patron, icon: "custom",
      objetivo: def.objetivo, ultimoTexto: "Sin historial previo",
      restSeconds: 75, difficulty: null, included: true, omitido: false,
      sets: [
        { peso: 0, reps: 0, estado: "pendiente" },
        { peso: 0, reps: 0, estado: "pendiente" },
        { peso: 0, reps: 0, estado: "pendiente" }
      ],
      variantes: { favoritas: [], recientes: [], mismoPatron: [], catalogo: [] },
      guide: { cues: ["Ejercicio añadido por ti: revisa la técnica con una fuente fiable o un profesional."], muscles: [] },
      video: "https://www.youtube.com/results?search_query=" + encodeURIComponent(def.nombre + " técnica")
    });
  }

  /* ---- Tarjeta de ejercicio ------------------------------------------------- */

  function drawExercise(mount, data, session, ex) {
    var progress = data.sessionProgress(session.id);

    var wrap = App.el("section", "view-strength view-exercise");
    var backBtn = App.el("button", "back-btn", "←");
    backBtn.type = "button";
    backBtn.setAttribute("aria-label", "Volver a la lista de " + session.nombre);
    backBtn.addEventListener("click", function () {
      // El descanso ahora vive en la barra persistente (visible en la lista
      // y en cualquier tarjeta de la misma sesión), así que salir de la
      // tarjeta ya no lo cancela: no hace falta avisar ni detenerlo.
      progress.openExerciseId = null;
      App.navigate("train", { sessionId: session.id }, { replace: true });
    });

    var header = App.el("div", "view-header");
    header.appendChild(backBtn);
    var headerBody = document.createElement("div");
    headerBody.appendChild(App.el("p", "kicker", ex.patron));
    var h1 = App.el("h1", "view-title", ex.nombre);
    headerBody.appendChild(h1);
    header.appendChild(headerBody);
    wrap.appendChild(header);

    var exhead = App.el("div", "exhead");
    var thumb = App.el("div", "exhead__thumb");
    thumb.innerHTML = icon(ex.icon);
    thumb.setAttribute("aria-hidden", "true");
    exhead.appendChild(thumb);
    var exBody = App.el("div", "exhead__body");
    exBody.appendChild(App.el("p", "exhead__variant", ex.variante));
    exBody.appendChild(App.el("p", "exhead__line", "Objetivo: " + ex.objetivo));
    exBody.appendChild(App.el("p", "exhead__line", "Último resultado con esta variante: " + ex.ultimoTexto));
    exhead.appendChild(exBody);
    wrap.appendChild(exhead);

    var chiprow = App.el("div", "chiprow");

    // ---- registro-un-toque: repetir la última serie (rellena y confirma la
    // siguiente serie pendiente en un solo toque) y añadir serie (una serie
    // más, precargada con el último peso/reps) sin abrir ningún diálogo.
    var repeatBtn = App.el("button", "chip chip--compact", "Repetir");
    repeatBtn.type = "button";
    repeatBtn.setAttribute("aria-label", "Repetir serie anterior");
    repeatBtn.addEventListener("click", function () { repeatLastSet(ex, data, session, mount); });
    chiprow.appendChild(repeatBtn);

    var addSetBtn = App.el("button", "chip chip--compact", "+ Serie");
    addSetBtn.type = "button";
    addSetBtn.setAttribute("aria-label", "Añadir una serie");
    addSetBtn.addEventListener("click", function () { addSetToExercise(ex, data, session, mount); });
    chiprow.appendChild(addSetBtn);

    var undoBtn = App.el("button", "chip chip--compact", "Deshacer");
    undoBtn.type = "button";
    var canUndo = !!lastExerciseAction && lastExerciseAction.exId === ex.id;
    if (!canUndo) undoBtn.setAttribute("aria-disabled", "true");
    undoBtn.addEventListener("click", function () {
      if (!lastExerciseAction || lastExerciseAction.exId !== ex.id) {
        App.toast("No hay ninguna acción reciente que deshacer en este ejercicio.");
        return;
      }
      undoLastExerciseAction(ex, data, session, mount);
    });
    chiprow.appendChild(undoBtn);

    var optionsBtn = App.el("button", "chip chip--compact", "Opciones");
    optionsBtn.type = "button";
    optionsBtn.addEventListener("click", function () { openExerciseOptionsSheet(session, data, ex, mount); });
    chiprow.appendChild(optionsBtn);
    wrap.appendChild(chiprow);

    wrap.appendChild(buildProgressionBlock(ex, data, session));

    var lanesHead = App.el("div", "lanes-head");
    lanesHead.appendChild(App.el("p", "section-title", "Series"));
    var modeswitch = App.el("div", "modeswitch");
    modeswitch.setAttribute("role", "group");
    modeswitch.setAttribute("aria-label", "Modo de registro");
    var confirmModeBtn = App.el("button", "modeswitch__btn" + (progress.mode === "confirm" ? " is-active" : ""), "Serie a serie");
    confirmModeBtn.type = "button";
    confirmModeBtn.setAttribute("aria-pressed", String(progress.mode === "confirm"));
    confirmModeBtn.addEventListener("click", function () {
      progress.mode = "confirm";
      App.navigate("train", { sessionId: session.id }, { replace: true });
    });
    modeswitch.appendChild(confirmModeBtn);
    var editModeBtn = App.el("button", "modeswitch__btn" + (progress.mode === "editAll" ? " is-active" : ""), "Editar todas");
    editModeBtn.type = "button";
    editModeBtn.setAttribute("aria-pressed", String(progress.mode === "editAll"));
    editModeBtn.addEventListener("click", function () {
      progress.mode = "editAll";
      App.navigate("train", { sessionId: session.id }, { replace: true });
    });
    modeswitch.appendChild(editModeBtn);
    lanesHead.appendChild(modeswitch);
    wrap.appendChild(lanesHead);

    var lanesHost = App.el("div", "lanes-host");
    wrap.appendChild(lanesHost);
    renderLanes(lanesHost, data, session, ex, progress);

    mount.appendChild(wrap);
    mountSessionBar(mount, session, data, ex);
  }

  /* ---- progresion-explicita: decisión visible antes de cada ejercicio
   * (nota MVP §8). data.progressionSuggestion deriva la sugerencia; al abrir
   * la tarjeta por primera vez se aplica sola (precarga), y la persona puede
   * cambiarla en un toque en cualquier momento — el resultado real que
   * registre siempre prevalece sobre la carga precargada. --------------------- */

  var PROGRESSION_LABELS = { bajar: "Bajar", mantener: "Mantener", subir: "Subir poco" };

  function openExerciseOptionsSheet(session, data, ex, mount) {
    App.openSheet({
      title: "Opciones de " + ex.nombre,
      render: function (body) {
        var variantBtn = App.el("button", "opt", "Cambiar variante");
        variantBtn.type = "button";
        variantBtn.addEventListener("click", function () {
          App.closeSheet();
          openVariantSheet(session, data, ex, mount);
        });
        body.appendChild(variantBtn);

        var guideBtn = App.el("button", "opt", "Ver guía");
        guideBtn.type = "button";
        guideBtn.addEventListener("click", function () {
          App.closeSheet();
          openGuideSheet(ex);
        });
        body.appendChild(guideBtn);

        var videoLink = document.createElement("a");
        videoLink.className = "btn btn--ghost btn--block";
        videoLink.href = ex.video;
        videoLink.target = "_blank";
        videoLink.rel = "noopener";
        videoLink.textContent = "Vídeo en YouTube ↗";
        body.appendChild(videoLink);

        body.appendChild(App.el("p", "field__label", "¿Cómo resultó la última vez? (opcional)"));
        var diffGroup = App.el("div", "picker");
        diffGroup.setAttribute("role", "group");
        diffGroup.setAttribute("aria-label", "Facilidad percibida");
        [["facil", "Fácil"], ["adecuada", "Adecuada"], ["dura", "Demasiado dura"]].forEach(function (pair) {
          var b = App.el("button", "picker__btn", pair[1]);
          b.type = "button";
          b.setAttribute("aria-pressed", String(ex.difficulty === pair[0]));
          b.addEventListener("click", function () {
            ex.difficulty = ex.difficulty === pair[0] ? null : pair[0];
            App.closeSheet();
            App.navigate("train", { sessionId: session.id }, { replace: true });
          });
          diffGroup.appendChild(b);
        });
        body.appendChild(diffGroup);
      }
    });
  }

  function buildProgressionBlock(ex, data, session) {
    var suggestion = data.progressionSuggestion(ex);
    if (ex.progressionDecision === undefined) data.applyProgressionDecision(ex, suggestion.decision);

    var wrap = App.el("div", "progression");
    wrap.appendChild(App.el("p", "field__label", "Antes de empezar: carga sugerida"));

    var motivo = ex.progressionDecision === suggestion.decision
      ? suggestion.motivo
      : "Cambiado manualmente (sugerencia: \"" + PROGRESSION_LABELS[suggestion.decision] + "\" — " + suggestion.motivo + ")";
    wrap.appendChild(App.el("p", "small progression__motivo", "Motivo: " + motivo));

    var group = App.el("div", "picker picker--wide");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Confirmar o cambiar la decisión de progresión para " + ex.nombre);
    ["bajar", "mantener", "subir"].forEach(function (key) {
      var b = App.el("button", "picker__btn", PROGRESSION_LABELS[key]);
      b.type = "button";
      b.setAttribute("aria-pressed", String(ex.progressionDecision === key));
      b.addEventListener("click", function () {
        data.applyProgressionDecision(ex, key);
        App.navigate("train", { sessionId: session.id }, { replace: true });
      });
      group.appendChild(b);
    });
    wrap.appendChild(group);
    return wrap;
  }

  /* ---- registro-un-toque: repetir la última serie, añadir serie y
   * deshacer (nota nueva del lote de mejoras). Cada una es una sola
   * interacción: sin sheet, sin confirmación adicional. -------------------- */

  function repeatLastSet(ex, data, session, mount) {
    var idx = -1;
    for (var i = 0; i < ex.sets.length; i++) {
      if (ex.sets[i].estado !== "hecha") { idx = i; break; }
    }
    if (idx < 0) { App.toast("Todas las series de " + ex.nombre + " ya están registradas."); return; }

    var done = ex.sets.filter(function (s) { return s.estado === "hecha"; });
    var source = done.length ? done[done.length - 1] : ex.sets[idx];
    lastExerciseAction = {
      type: "set", exId: ex.id, index: idx,
      before: { peso: ex.sets[idx].peso, reps: ex.sets[idx].reps, estado: ex.sets[idx].estado }
    };
    ex.sets[idx].peso = source.peso;
    ex.sets[idx].reps = source.reps;
    ex.sets[idx].estado = "hecha";
    restTimerExerciseId = ex.id;
    if (!restTimerHandle) restTimerRemaining = ex.restSeconds;
    App.toast("Serie " + (idx + 1) + " registrada igual que la anterior.");
    App.navigate("train", { sessionId: session.id }, { replace: true });
  }

  function addSetToExercise(ex, data, session, mount) {
    var last = ex.sets[ex.sets.length - 1] || { peso: 0, reps: 0 };
    ex.sets.push({ peso: last.peso, reps: last.reps, estado: "pendiente" });
    lastExerciseAction = { type: "addSet", exId: ex.id };
    App.toast("Serie añadida a " + ex.nombre + ".");
    App.navigate("train", { sessionId: session.id }, { replace: true });
  }

  function undoLastExerciseAction(ex, data, session, mount) {
    var action = lastExerciseAction;
    if (action.type === "set") {
      ex.sets[action.index].peso = action.before.peso;
      ex.sets[action.index].reps = action.before.reps;
      ex.sets[action.index].estado = action.before.estado;
    } else if (action.type === "addSet") {
      ex.sets.pop();
    } else if (action.type === "variant") {
      ex.variante = action.before.variante;
      ex.ultimoTexto = action.before.ultimoTexto;
    }
    lastExerciseAction = null;
    App.toast("Deshecho.");
    App.navigate("train", { sessionId: session.id }, { replace: true });
  }

  /* ---- Barra persistente de sesión: progreso, ejercicio actual, cierre y
   * descanso en curso (nota nueva del lote de mejoras). Se reconstruye por
   * completo en cada render de la vista y se refresca a mano (refreshSessionBar)
   * cada vez que cambia el progreso o el estado del descanso sin pasar por
   * App.navigate, para no perder la posición de scroll del usuario. --------- */

  function mountSessionBar(mount, session, data, ex) {
    sessionBarCtx = { session: session, data: data, ex: ex, mount: mount };
    sessionBarEl = App.el("div", "sessionbar");
    sessionBarEl.setAttribute("role", "region");
    sessionBarEl.setAttribute("aria-label", "Progreso de la sesión de fuerza");
    mount.appendChild(sessionBarEl);
    refreshSessionBar();
  }

  function refreshSessionBar() {
    if (!sessionBarEl || !sessionBarCtx) return;
    var session = sessionBarCtx.session, data = sessionBarCtx.data, ex = sessionBarCtx.ex, mount = sessionBarCtx.mount;
    sessionBarEl.innerHTML = "";

    var stats = data.sessionStats(session.id);
    var top = App.el("div", "sessionbar__top");
    var meta = App.el("div", "sessionbar__meta");
    meta.appendChild(App.el("p", "sessionbar__progress", stats.setsDone + " de " + stats.setsTotal + " series"));
    meta.appendChild(App.el("p", "sessionbar__current", ex ? "Ahora: " + ex.nombre : "Elige un ejercicio de la lista"));
    top.appendChild(meta);

    var finishBtn = App.el("button", "btn btn--primary btn--sm", "Terminar sesión");
    finishBtn.type = "button";
    finishBtn.addEventListener("click", function () { handleFinishClick(session, data, mount); });
    top.appendChild(finishBtn);
    sessionBarEl.appendChild(top);

    var restEx = restExerciseFor(session, data);
    if (restEx) sessionBarEl.appendChild(buildRestWidget(restEx));
  }

  function restExerciseFor(session, data) {
    if (!restTimerExerciseId || restTimerRemaining <= 0) return null;
    var list = data.exercisesForSession(session.id) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === restTimerExerciseId) return list[i];
    }
    return null;
  }

  function renderLanes(host, data, session, ex, progress) {
    host.innerHTML = "";
    var list = App.el("ul", "lanes");
    var errors = host._pendingErrors || {};

    ex.sets.forEach(function (set, index) {
      var done = set.estado === "hecha";
      var li = App.el("li", "lane" + (done ? " is-done" : ""));
      li.appendChild(App.el("span", "lane__num", String(index + 1)));
      li.appendChild(buildLaneField(set, index, "peso", "kg", ex, done, progress, errors));
      li.appendChild(buildLaneField(set, index, "reps", "reps", ex, done, progress, errors));

      var state = App.el("span", "lane__state");
      if (progress.mode === "confirm") {
        var btn = App.el("button", "setbtn" + (done ? " is-done" : ""), done ? "Hecha ✓" : "Confirmar");
        btn.type = "button";
        btn.setAttribute("aria-label", (done ? "Deshacer serie " : "Confirmar serie ") + (index + 1) + " de " + ex.nombre);
        btn.addEventListener("click", function () {
          set.estado = done ? "pendiente" : "hecha";
          if (!done) {
            restTimerExerciseId = ex.id;
            if (!restTimerHandle) restTimerRemaining = ex.restSeconds;
          }
          renderLanes(host, data, session, ex, progress);
          refreshSessionBar();
        });
        state.appendChild(btn);
      } else {
        state.appendChild(App.el("span", "lane__flag", done ? "Hecha ✓" : "Pendiente"));
      }
      li.appendChild(state);
      list.appendChild(li);

      if (errors[index]) {
        var errLi = App.el("li", "lane__error-row");
        var err = App.el("p", "field__error", errors[index].text);
        err.id = "err-" + ex.id + "-" + index;
        err.setAttribute("role", "alert");
        errLi.appendChild(err);
        list.appendChild(errLi);
      }
    });

    host.appendChild(list);

    var footer = App.el("div", "laneFooter");
    if (progress.mode === "editAll") {
      var allBtn = App.el("button", "btn btn--primary btn--block", "Confirmar todas las series");
      allBtn.type = "button";
      allBtn.addEventListener("click", function () {
        var newErrors = validateAllSets(ex);
        if (Object.keys(newErrors).length) {
          host._pendingErrors = newErrors;
          renderLanes(host, data, session, ex, progress);
          var firstIdx = Object.keys(newErrors)[0];
          var firstField = newErrors[firstIdx].field;
          var firstInput = host.querySelector('input[data-idx="' + firstField + "-" + firstIdx + '"]');
          if (firstInput) firstInput.focus();
          return;
        }
        host._pendingErrors = {};
        ex.sets.forEach(function (s) { s.estado = "hecha"; });
        restTimerExerciseId = ex.id;
        if (!restTimerHandle) restTimerRemaining = ex.restSeconds;
        renderLanes(host, data, session, ex, progress);
        refreshSessionBar();
        App.toast("Series de " + ex.nombre + " confirmadas.");
      });
      footer.appendChild(allBtn);
    }
    host.appendChild(footer);
  }

  function validateAllSets(ex) {
    var errors = {};
    ex.sets.forEach(function (set, index) {
      if (isNaN(set.peso) || set.peso < 0) errors[index] = { field: "peso", text: "Serie " + (index + 1) + ": el peso debe ser 0 o un número mayor." };
      else if (isNaN(set.reps) || set.reps <= 0) errors[index] = { field: "reps", text: "Serie " + (index + 1) + ": las repeticiones deben ser mayores que 0." };
    });
    return errors;
  }

  function buildLaneField(set, index, prop, unit, ex, done, progress, errors) {
    var wrap = App.el("span", "lane__field");
    var input = document.createElement("input");
    input.type = "number";
    input.step = prop === "peso" ? "0.5" : "1";
    input.min = "0";
    input.value = set[prop];
    input.setAttribute("data-idx", prop + "-" + index);
    input.setAttribute("aria-label", (prop === "peso" ? "Peso en kilos, serie " : "Repeticiones, serie ") + (index + 1) + " de " + ex.nombre);
    input.disabled = done && progress.mode === "confirm";
    if (errors[index] && errors[index].field === prop) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "err-" + ex.id + "-" + index);
    }
    input.addEventListener("input", function () {
      var value = prop === "peso" ? parseFloat(input.value) : parseInt(input.value, 10);
      set[prop] = isNaN(value) ? input.value === "" ? NaN : value : value;
      if (!isNaN(value)) delete errors[index];
    });
    wrap.appendChild(input);
    wrap.appendChild(App.el("span", "lane__unit", unit));
    return wrap;
  }

  /* ---- Descanso: solo arranca por acción explícita (nota 19). Vive en la
   * barra persistente (no en la tarjeta) para seguir visible y contando al
   * cambiar de ejercicio o volver a la lista de la misma sesión. ------------ */

  function buildRestWidget(ex) {
    var running = !!restTimerHandle && restTimerExerciseId === ex.id;
    var paused = !running && restTimerRemaining < ex.restSeconds;
    var wrap = App.el("div", "sessionbar__rest");

    var clock = App.el("span", "sessionbar__clock", formatTime(restTimerRemaining));
    clock.id = "restClock";
    clock.setAttribute("aria-live", "polite");
    wrap.appendChild(clock);

    var labelText = running ? "Descansando · " + ex.nombre
      : paused ? "Descanso en pausa · " + ex.nombre
      : "Descanso recomendado · " + ex.nombre;
    wrap.appendChild(App.el("span", "sessionbar__restlabel", labelText));

    var edit = App.el("span", "sessionbar__restedit");
    var input = document.createElement("input");
    input.type = "number";
    input.id = "restSeconds";
    input.min = "15";
    input.max = "300";
    input.step = "5";
    input.value = ex.restSeconds;
    input.disabled = running;
    input.setAttribute("aria-label", "Segundos de descanso recomendado para " + ex.nombre);
    input.addEventListener("input", function () {
      var v = parseInt(input.value, 10);
      if (isNaN(v)) return;
      ex.restSeconds = v;
      if (!restTimerHandle) {
        restTimerRemaining = v;
        var c = App.$("restClock");
        if (c) c.textContent = formatTime(v);
      }
    });
    edit.appendChild(input);
    edit.appendChild(App.el("span", null, "s"));
    wrap.appendChild(edit);

    var actionBtn = App.el("button", "btn btn--ghost btn--sm", running ? "Pausar" : (paused ? "Reanudar" : "Iniciar"));
    actionBtn.type = "button";
    actionBtn.addEventListener("click", function () {
      if (running) stopRestTimer();
      else startRestTimer(ex);
      refreshSessionBar();
    });
    wrap.appendChild(actionBtn);

    return wrap;
  }

  function formatTime(totalSeconds) {
    var s = Math.max(Math.round(totalSeconds), 0);
    var m = Math.floor(s / 60);
    var rest = s % 60;
    return m + ":" + (rest < 10 ? "0" : "") + rest;
  }

  // El temporizador SOLO arranca por esta acción explícita del usuario.
  function startRestTimer(ex) {
    if (restTimerHandle) return;
    restTimerExerciseId = ex.id;
    if (!restTimerRemaining || restTimerRemaining <= 0) restTimerRemaining = parseInt(ex.restSeconds, 10) || 0;
    if (restTimerRemaining <= 0) return;
    restTimerHandle = window.setInterval(function () {
      restTimerRemaining--;
      var clock = App.$("restClock");
      if (clock) clock.textContent = formatTime(restTimerRemaining);
      if (restTimerRemaining <= 0) {
        stopRestTimer();
        restTimerRemaining = ex.restSeconds;
        refreshSessionBar();
        App.toast("Descanso terminado.");
      }
    }, 1000);
  }

  function stopRestTimer() {
    if (restTimerHandle) {
      window.clearInterval(restTimerHandle);
      restTimerHandle = null;
    }
  }

  /* ---- Cambiar variante (nota 20: guarda la variante realmente usada) ------ */

  function openVariantSheet(session, data, ex, mount) {
    App.openSheet({
      title: "Cambiar variante de " + ex.nombre,
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          "El registro que hagas a partir de ahora se guarda con la variante realmente usada."));
        var groups = [
          { title: "Favoritas", items: ex.variantes.favoritas },
          { title: "Usadas recientemente", items: ex.variantes.recientes },
          { title: "Mismo patrón — " + ex.patron, items: ex.variantes.mismoPatron },
          { title: "Catálogo general", items: ex.variantes.catalogo }
        ];
        groups.forEach(function (group) {
          if (!group.items.length) return;
          var g = App.el("div", "optgroup");
          g.appendChild(App.el("p", "optgroup__title", group.title));
          group.items.forEach(function (item) {
            var btn = App.el("button", "opt" + (item.nombre === ex.variante ? " is-current" : ""));
            btn.type = "button";
            btn.appendChild(App.el("span", "opt__name", item.nombre));
            btn.appendChild(App.el("span", "opt__meta", item.meta));
            btn.addEventListener("click", function () {
              lastExerciseAction = { type: "variant", exId: ex.id, before: { variante: ex.variante, ultimoTexto: ex.ultimoTexto } };
              ex.variante = item.nombre;
              ex.ultimoTexto = item.meta.indexOf("·") >= 0
                ? item.meta.split("·").pop().trim() + " (con esta variante)"
                : "sin historial previo con esta variante";
              App.closeSheet();
              App.toast("Variante actualizada a " + item.nombre + ". Se registrará con este nombre.");
              App.navigate("train", { sessionId: session.id }, { replace: true });
            });
            g.appendChild(btn);
          });
          body.appendChild(g);
        });
      }
    });
  }

  // Usa el componente único de ficha de ejercicio (App.exerciseSheet,
  // definido en library.js) para que "Ver guía" desde la sesión muestre el
  // mismo marcado y la misma imagen que la ficha de Biblioteca. `catalogId`
  // enlaza explícitamente con el catálogo cuando existe (hoy solo "jalon" →
  // "jalon-polea", ver data.js); si no existe, mediaId cae al id de sesión y
  // el componente muestra "Ilustración próximamente".
  function openGuideSheet(ex) {
    App.exerciseSheet({
      title: ex.nombre,
      mediaId: ex.catalogId || ex.id,
      patron: ex.patron,
      objetivo: ex.objetivo,
      guide: ex.guide,
      video: ex.video
    });
  }

  /* ---- Cierre de sesión: completa, adaptada o parcial (nota 05/29) --------- */

  function handleFinishClick(session, data, mount) {
    var stats = data.sessionStats(session.id);
    if (stats.setsTotal > 0 && stats.setsDone === stats.setsTotal) {
      openCloseSheet(session, data, mount, true);
      return;
    }
    App.openSheet({
      title: "Sesión sin terminar",
      render: function (body) {
        body.appendChild(App.el("p", "lede",
          "Llevas " + stats.setsDone + " de " + stats.setsTotal + " series y " + stats.exDone + " de " + stats.exTotal +
          " ejercicios. Si guardas ahora se registrará como sesión parcial, no como completada."));
        var keep = App.el("button", "btn btn--primary btn--block", "Continuar registrando");
        keep.type = "button";
        keep.addEventListener("click", function () { App.closeSheet(); });
        body.appendChild(keep);
        var partial = App.el("button", "btn btn--ghost btn--block", "Guardar como parcial");
        partial.type = "button";
        partial.addEventListener("click", function () {
          App.closeSheet();
          openCloseSheet(session, data, mount, false);
        });
        body.appendChild(partial);
      }
    });
  }

  function openCloseSheet(session, data, mount, completa) {
    var stats = data.sessionStats(session.id);
    var esfuerzo = null;
    var molestiaCierre = "Ninguna";
    var comentario = "";

    App.openSheet({
      title: completa ? "Terminar sesión" : "Guardar como parcial",
      render: function (body) {
        var summary = App.el("div", "closesummary" + (completa ? "" : " closesummary--partial"));
        summary.appendChild(App.el("p", "closesummary__head", completa ? "Sesión completada" : "Se guardará como parcial"));
        summary.appendChild(App.el("p", "closesummary__meta",
          stats.exDone + " de " + stats.exTotal + " ejercicios · " + stats.setsDone + " de " + stats.setsTotal + " series" +
          (session.esAdaptada ? " · versión adaptada" : "")));
        body.appendChild(summary);

        body.appendChild(App.el("p", "field__label", "Esfuerzo global"));
        var effortGroup = App.el("div", "picker picker--wide");
        effortGroup.setAttribute("role", "group");
        effortGroup.setAttribute("aria-label", "Esfuerzo global");
        ESFUERZO_OPCIONES.forEach(function (opt) {
          var b = App.el("button", "picker__btn", opt);
          b.type = "button";
          b.setAttribute("aria-pressed", "false");
          b.addEventListener("click", function () {
            var was = esfuerzo === opt;
            esfuerzo = was ? null : opt;
            Array.prototype.forEach.call(effortGroup.children, function (c) { c.setAttribute("aria-pressed", "false"); });
            if (!was) b.setAttribute("aria-pressed", "true");
          });
          effortGroup.appendChild(b);
        });
        body.appendChild(effortGroup);

        body.appendChild(App.el("p", "field__label", "Molestias al cerrar (opcional)"));
        var painNotice = App.el("p", "notice notice--warn", SAFETY_TEXT);
        painNotice.hidden = true;
        var painGroup = App.el("div", "picker");
        painGroup.setAttribute("role", "group");
        painGroup.setAttribute("aria-label", "Molestias al cerrar");
        MOLESTIA_CIERRE_OPCIONES.forEach(function (opt) {
          var b = App.el("button", "picker__btn", opt);
          b.type = "button";
          b.setAttribute("aria-pressed", String(opt === "Ninguna"));
          b.addEventListener("click", function () {
            molestiaCierre = opt;
            Array.prototype.forEach.call(painGroup.children, function (c) { c.setAttribute("aria-pressed", "false"); });
            b.setAttribute("aria-pressed", "true");
            painNotice.hidden = opt !== "Importante";
          });
          painGroup.appendChild(b);
        });
        body.appendChild(painGroup);
        body.appendChild(painNotice);

        body.appendChild(App.el("p", "field__label", "Comentario (opcional)"));
        var textarea = document.createElement("textarea");
        textarea.setAttribute("aria-label", "Comentario sobre la sesión");
        textarea.addEventListener("input", function () { comentario = textarea.value; });
        body.appendChild(textarea);

        var saveBtn = App.el("button", "btn btn--primary btn--block", "Guardar sesión");
        saveBtn.type = "button";
        saveBtn.addEventListener("click", function () {
          // El esfuerzo global es opcional (igual que molestias y comentario):
          // nada de lo que se pide al cerrar debe bloquear el guardado.
          App.closeSheet();
          stopRestTimer();
          restTimerExerciseId = null;
          var result = data.closeStrengthSession(session, { completa: completa, esfuerzo: esfuerzo, molestia: molestiaCierre, comentario: comentario });
          data.sessionProgress(session.id).openExerciseId = null;
          App.persist();
          App.toast(completa ? "Sesión guardada como " + labelForEstado(result.estado) + "." : "Sesión guardada como parcial: cuenta lo registrado, " + result.minutos + " min.");
          App.navigate("home", {}, { replace: true });
        });
        body.appendChild(saveBtn);
      }
    });
  }

  function labelForEstado(estado) {
    return estado === "adaptada" ? "adaptada" : "completada";
  }

  /* ---- Miniaturas ilustradas (SVG inline, sin recursos remotos) ------------ */

  function icon(kind) {
    var icons = {
      pull: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M6 21h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      row: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12h6m0 0l3-3m-3 3l3 3M21 12h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      facepull: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M6 20c1-4 3-6 6-6s5 2 6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      pullover: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 8c3 6 13 6 16 0M6 16c2-2 10-2 12 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      curl: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 18l4-9 5 3 5-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      press: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12h16M6 8v8m12-8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      shoulderpress: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 21V9m0 0l-5 4m5-4l5 4M7 5h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      dip: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 8h6m4 0h6M9 8v10m5-10v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      lateral: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h5m6 0h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      squat: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="2" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v5m-4 7v-5l4-2 4 2v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      legpress: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12h8m0 0l4-4m-4 4l4 4M21 6v12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      hamcurl: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 6h9m0 0l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      calf: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M8 20V8a4 4 0 018 0v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6 20h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      custom: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
    };
    return icons[kind] || icons.custom;
  }

  App.registerView("train", { title: "Entrenar", render: render });
})();
