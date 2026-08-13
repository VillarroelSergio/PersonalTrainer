/* =====================================================================
 * Vista: Check-in, mapa corporal y adaptación (LOTE 3)
 * Notas 04 y 16. Todo el estado vive en App.viewContext("checkin") para
 * poder volver a editar el check-in desde la propuesta sin perder lo
 * respondido (nota 04: "Editar" vuelve a paso 1 con las respuestas intactas).
 * El mapa corporal NO se añade al DOM hasta que la persona declara una
 * molestia: no es solo `hidden`, el nodo no existe hasta entonces.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  var SAFETY_TEXT = "Molestia importante: esto no es un diagnóstico. Si la molestia persiste o es intensa, " +
    "considera detener o adaptar la sesión y consultar a un profesional de salud.";

  var GENERAL_WELLNESS_TEXT = "Información orientativa de bienestar, no un diagnóstico: no identifica lesiones ni garantiza la recuperación. " +
    "Sirve para explicar el ajuste de la sesión de hoy.";

  var BODY_MAP_IMG = "assets/body-map/body-map-front-back-v1.webp";
  var BODY_MAP_ALT = "Mapa corporal frontal y trasero con zonas amplias para registrar una molestia.";

  function freshCheckin() {
    return {
      stage: "form", // form | proposal
      energia: null, motivacion: null, tiempo: null, molestia: null,
      zona: null, lado: null, zonaTexto: null, intensidadZona: null, tipoMolestia: null, notaZona: "",
      bodySide: "frontal",
      reuseId: null,
      proposal: null
    };
  }

  function render(mount, params) {
    var ctx = App.viewContext("checkin");
    if (!ctx.state) ctx.state = freshCheckin();
    var data = App.data;
    var sessionId = (params && params.sessionId) || (ctx.state.sessionId);
    ctx.state.sessionId = sessionId;
    var session = sessionId ? data.findSession(sessionId) : data.sessionOnDay(data.hoy);

    if (!session) {
      var wrap0 = App.el("section", "view-checkin");
      wrap0.appendChild(App.el("h1", "view-title", "Check-in"));
      App.states.empty(wrap0, {
        title: "No hay sesión prevista para ajustar hoy",
        body: "Vuelve al plan para elegir un día.",
        actionLabel: "Ver plan",
        onAction: function () { App.navigate("plan"); }
      });
      mount.appendChild(wrap0);
      return;
    }

    if (ctx.state.stage === "proposal" && ctx.state.proposal) {
      drawProposal(mount, data, session, ctx);
    } else {
      drawForm(mount, data, session, ctx);
    }
  }

  /* ---- Paso 1: energía, motivación, tiempo, molestia ---------------------- */

  function drawForm(mount, data, session, ctx) {
    var s = ctx.state;
    var wrap = App.el("section", "view-checkin");
    wrap.appendChild(App.el("p", "kicker", session.nombre + " · hoy"));
    wrap.appendChild(App.el("h1", "view-title", "¿Cómo llegas hoy?"));
    wrap.appendChild(App.el("p", "lede small",
      "Todo es opcional y rápido. Con tus respuestas te proponemos alternativas explicadas: tú decides si las aplicas."));

    wrap.appendChild(buildPickerField("Energía", "energia", ["baja", "normal", "alta"], s, redraw));
    wrap.appendChild(buildPickerField("Motivación", "motivacion", ["baja", "normal", "alta"], s, redraw));
    wrap.appendChild(buildPickerField("Tiempo disponible", "tiempo", ["20 min", "40 min", "60 min", "90+ min"], s, redraw));
    wrap.appendChild(buildPickerField("Molestias", "molestia", ["ninguna", "leve", "moderada", "importante"], s, function () {
      if (s.molestia === "ninguna" || !s.molestia) { s.zona = null; s.lado = null; s.zonaTexto = null; }
      else if (!s.intensidadZona) s.intensidadZona = s.molestia === "leve" || s.molestia === "moderada" || s.molestia === "importante" ? s.molestia : null;
      redraw();
    }));

    // El mapa corporal solo entra en el DOM si hay molestia declarada.
    if (s.molestia && s.molestia !== "ninguna") {
      wrap.appendChild(buildDiscomfortSection(data, session, s, redraw));
    }

    var reviewBtn = App.el("button", "btn btn--primary btn--block", "Revisar propuesta");
    reviewBtn.type = "button";
    reviewBtn.addEventListener("click", function () {
      if (s.molestia && s.molestia !== "ninguna" && !s.zona) {
        App.toast("Indica en qué zona notas la molestia, o marca “Ninguna” si prefieres no declararla.");
        return;
      }
      s.proposal = buildAdaptationProposal(s, session, data);
      s.stage = "proposal";
      App.navigate("checkin", { sessionId: session.id }, { replace: true });
    });
    wrap.appendChild(reviewBtn);

    var skipBtn = App.el("button", "btn btn--ghost btn--block", "Volver sin ajustar");
    skipBtn.type = "button";
    skipBtn.addEventListener("click", function () { App.navigate("home", {}, { replace: true }); });
    wrap.appendChild(skipBtn);

    mount.appendChild(wrap);

    function redraw() { mount.innerHTML = ""; drawForm(mount, data, session, ctx); }
  }

  function buildPickerField(label, key, options, state, onChange) {
    var field = App.el("div", "field");
    field.appendChild(App.el("p", "field__label", label + " (opcional)"));
    var group = App.el("div", "picker picker--wide");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    options.forEach(function (opt) {
      var btn = App.el("button", "picker__btn", opt.charAt(0).toUpperCase() + opt.slice(1));
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(state[key] === opt));
      btn.addEventListener("click", function () {
        state[key] = state[key] === opt ? null : opt;
        onChange();
      });
      group.appendChild(btn);
    });
    field.appendChild(group);
    return field;
  }

  /* ---- Molestia: aviso activo reutilizable + mapa corporal (nota 16) ------- */

  function buildDiscomfortSection(data, session, s, redraw) {
    var wrap = document.createElement("div");

    var active = data.findActiveDiscomfort();
    if (active && !s.zona && !s.reuseId) {
      var panel = App.el("div", "notice notice--info");
      panel.appendChild(App.el("p", null,
        "Tienes un aviso activo: " + active.zonaTexto + ", intensidad " + active.intensidad + ". Puedes reutilizarlo, editarlo o marcarlo como resuelto."));
      var actions = App.el("div", "dayrow__actions");
      var reuseBtn = App.el("button", "chip", "Reutilizar");
      reuseBtn.type = "button";
      reuseBtn.addEventListener("click", function () {
        s.zona = active.zona; s.lado = active.lado; s.zonaTexto = active.zonaTexto;
        s.intensidadZona = active.intensidad; s.tipoMolestia = active.tipo; s.reuseId = active.id;
        redraw();
      });
      actions.appendChild(reuseBtn);
      var editBtn = App.el("button", "chip", "Editar");
      editBtn.type = "button";
      editBtn.addEventListener("click", function () {
        s.zona = active.zona; s.lado = active.lado; s.zonaTexto = active.zonaTexto;
        s.intensidadZona = active.intensidad; s.tipoMolestia = active.tipo; s.reuseId = active.id;
        s.editingActive = true;
        redraw();
      });
      actions.appendChild(editBtn);
      // La etiqueta describe lo que realmente hace data.closeDiscomfort:
      // pone el aviso en estado "cerrado" para siempre (no reaparece como
      // activo/reutilizable en ninguna sesión futura). No es "ocultar por
      // hoy": por eso el texto es "Marcar como resuelta", no "Cerrar aviso".
      var closeBtn = App.el("button", "chip", "Marcar como resuelta");
      closeBtn.type = "button";
      closeBtn.addEventListener("click", function () {
        data.closeDiscomfort(active.id);
        App.toast("Molestia marcada como resuelta.");
        redraw();
      });
      actions.appendChild(closeBtn);
      panel.appendChild(actions);
      wrap.appendChild(panel);
      return wrap;
    }

    wrap.appendChild(App.el("p", "lede small bodymap__wellness", GENERAL_WELLNESS_TEXT));
    wrap.appendChild(App.el("p", "field__label", "¿En qué zona amplia lo notas?"));

    var tabs = App.el("div", "tabs tabs--small bodymap__tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Vista del cuerpo");
    ["frontal", "trasera"].forEach(function (side, i) {
      var selected = s.bodySide === side;
      var tab = App.el("button", "tab", side === "frontal" ? "Frontal" : "Trasera");
      tab.type = "button";
      tab.id = "bodyTab-" + side;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(selected));
      tab.setAttribute("aria-controls", "bodyPanel-" + side);
      tab.tabIndex = selected ? 0 : -1;
      tab.addEventListener("click", function () { s.bodySide = side; redraw(); });
      tab.addEventListener("keydown", function (e) {
        var order = ["frontal", "trasera"];
        var idx = order.indexOf(side);
        var next = null;
        if (e.key === "ArrowRight") next = (idx + 1) % 2;
        else if (e.key === "ArrowLeft") next = (idx - 1 + 2) % 2;
        if (next === null) return;
        e.preventDefault();
        s.bodySide = order[next];
        redraw();
      });
      tabs.appendChild(tab);
    });
    wrap.appendChild(tabs);

    var dual = App.el("div", "bodymap-dual");
    ["frontal", "trasera"].forEach(function (side) {
      dual.appendChild(buildBodyPane(side, data, s, redraw));
    });
    wrap.appendChild(dual);

    wrap.appendChild(App.el("p", "lede small",
      s.zonaTexto ? "Zona seleccionada: " + s.zonaTexto + "." : "Ninguna zona seleccionada todavía."));

    if (s.zona) {
      var sideField = App.el("div", "field");
      sideField.appendChild(App.el("p", "field__label", "Lado (si aplica)"));
      var sideGroup = App.el("div", "picker");
      sideGroup.setAttribute("role", "group");
      sideGroup.setAttribute("aria-label", "Lado de la molestia");
      [["izquierdo", "Izquierdo"], ["derecho", "Derecho"], ["none", "No aplica"]].forEach(function (pair) {
        var b = App.el("button", "picker__btn", pair[1]);
        b.type = "button";
        b.setAttribute("aria-pressed", String(s.lado === pair[0]));
        b.addEventListener("click", function () { s.lado = pair[0]; redraw(); });
        sideGroup.appendChild(b);
      });
      sideField.appendChild(sideGroup);
      wrap.appendChild(sideField);

      wrap.appendChild(buildPickerField("Intensidad", "intensidadZona", ["leve", "moderada", "importante"], s, redraw));
      wrap.appendChild(buildPickerField("Tipo (opcional)", "tipoMolestia", ["dolor", "rigidez", "fatiga"], s, redraw));

      var noteField = App.el("div", "field");
      var noteLabel = App.el("label", "field__label", "Nota (opcional)");
      noteLabel.htmlFor = "notaZona";
      noteField.appendChild(noteLabel);
      var noteInput = document.createElement("input");
      noteInput.type = "text";
      noteInput.id = "notaZona";
      noteInput.className = "field__input";
      noteInput.maxLength = 140;
      noteInput.value = s.notaZona || "";
      noteInput.placeholder = "Ej. aparece solo al final de la sesión";
      noteInput.addEventListener("input", function () { s.notaZona = noteInput.value; });
      noteField.appendChild(noteInput);
      wrap.appendChild(noteField);

      if (s.intensidadZona === "importante") {
        wrap.appendChild(App.el("p", "notice notice--warn", SAFETY_TEXT));
      }

      var saveBtn = App.el("button", "btn btn--ghost btn--block", s.reuseId ? "Guardar cambios del aviso" : "Guardar aviso");
      saveBtn.type = "button";
      saveBtn.addEventListener("click", function () {
        var saved = data.saveDiscomfort({
          zona: s.zona, lado: s.lado, zonaTexto: s.zonaTexto,
          intensidad: s.intensidadZona || s.molestia, tipo: s.tipoMolestia
        }, s.reuseId);
        if (s.notaZona && s.notaZona.trim()) saved.nota = s.notaZona.trim();
        App.toast("Aviso guardado.");
      });
      wrap.appendChild(saveBtn);
    }

    return wrap;
  }

  /* ---- Panel visual de una vista (frontal/trasera) con imagen real + zonas - */

  function buildBodyPane(side, data, s, redraw) {
    var pane = App.el("div", "bodymap-pane" + (s.bodySide === side ? " is-active" : ""));
    pane.id = "bodyPanel-" + side;
    pane.setAttribute("role", "tabpanel");
    pane.setAttribute("aria-labelledby", "bodyTab-" + side);
    pane.dataset.side = side;

    var crop = App.el("div", "bodymap-crop");
    var img = document.createElement("img");
    img.className = "bodymap-img";
    img.src = BODY_MAP_IMG;
    img.alt = BODY_MAP_ALT;
    img.addEventListener("error", function () { img.classList.add("bodymap-img--broken"); });
    crop.appendChild(img);

    var zones = data.BODY_ZONES[side];
    zones.forEach(function (z) {
      var pressed = s.zona === z.zona && s.lado === z.lado;
      var btn = App.el("button", "zone", z.texto);
      btn.type = "button";
      btn.style.top = z.top;
      btn.style.left = z.left;
      btn.setAttribute("aria-pressed", String(pressed));
      btn.addEventListener("click", function () {
        if (z.zona !== s.zona || z.lado !== s.lado) s.notaZona = "";
        s.bodySide = side;
        s.zona = z.zona; s.lado = z.lado; s.zonaTexto = z.texto;
        if (!s.intensidadZona) s.intensidadZona = s.molestia;
        redraw();
      });
      crop.appendChild(btn);
    });
    pane.appendChild(crop);
    return pane;
  }

  /* ---- Regla de adaptación (caso literal del encargo incluido) ------------- */

  function buildAdaptationProposal(s, session, data) {
    var changes = [];
    var apply = [];
    var list = data.exercisesForSession(session.id) || [];
    var byId = {};
    list.forEach(function (ex) { byId[ex.id] = ex; });

    var isHombro = s.zona === "hombro";
    var hasMolestia = !!s.molestia && s.molestia !== "ninguna";

    if (hasMolestia && isHombro) {
      var ladoTxt = s.lado && s.lado !== "none" ? " " + s.lado : "";
      var primary = byId.jalon || list[0];
      var secondary = byId.facepull || list[1];
      if (primary && primary.sets.length > 2) {
        changes.push("Se reduce una serie de " + primary.nombre.toLowerCase() + " para bajar la carga sobre el hombro" + ladoTxt +
          " que indicaste. No es un diagnóstico: es un ajuste general de la sesión, editable en cualquier momento.");
        apply.push(function () { if (primary.sets.length > 2) primary.sets.pop(); });
      }
      if (secondary) {
        var altVariant = (secondary.variantes.recientes[0] && secondary.variantes.recientes[0].nombre) || (secondary.nombre + " con banda elástica");
        changes.push(secondary.nombre + " cambia a " + altVariant.toLowerCase() + ", una variante menos exigente. Puedes volver a cambiarla cuando quieras.");
        apply.push(function () { secondary.variante = altVariant; });
      }
    } else if (hasMolestia) {
      changes.push("Se reduce ligeramente el volumen general de la sesión porque indicaste una molestia. No es un ajuste dirigido a una zona concreta; puedes editarlo.");
      var first = list[0];
      apply.push(function () { if (first && first.sets.length > 2) first.sets.pop(); });
    }

    if (s.tiempo === "20 min" && list.length > 1) {
      var last = list[list.length - 1];
      changes.push("Se retira " + last.nombre.toLowerCase() + " de la sesión de hoy para ajustarse a 20 minutos disponibles. Solo afecta a hoy, no a tu plantilla.");
      apply.push(function () { last.included = false; });
    }

    if (s.energia === "baja") {
      changes.push("El descanso recomendado entre series sube 15 s para compensar la energía baja.");
      apply.push(function () { list.forEach(function (ex) { ex.restSeconds += 15; }); });
    }

    if (!changes.length) {
      changes.push("No se detectan ajustes necesarios: puedes mantener " + session.nombre + " tal como está prevista.");
    }

    var reasonParts = [];
    if (s.energia) reasonParts.push("energía " + s.energia);
    if (s.motivacion) reasonParts.push("motivación " + s.motivacion);
    if (s.tiempo) reasonParts.push(s.tiempo + " disponibles");
    if (hasMolestia) reasonParts.push("molestia " + s.molestia + (s.zonaTexto ? " en " + s.zonaTexto.toLowerCase().replace(/\.$/, "") : ""));

    return {
      title: session.nombre + " adaptado" + (s.tiempo ? " · " + s.tiempo : ""),
      changes: changes,
      reason: reasonParts.length ? "Motivo: indicaste " + reasonParts.join(", ") + "." : "Sin señales declaradas: no hay motivo que explicar.",
      importantPain: s.molestia === "importante" || s.intensidadZona === "importante",
      // C: si no hay ningún cambio real que aplicar (caso "no se detectan
      // ajustes necesarios"), aplicar la propuesta no debe marcar la sesión
      // como adaptada: al cerrarla se etiquetaría "adaptada" sin que nada
      // se hubiese adaptado de verdad.
      hasChanges: apply.length > 0,
      apply: function () { apply.forEach(function (fn) { fn(); }); }
    };
  }

  /* ---- Paso 2: alternativas explicadas, decisión explícita (nota 04) ------- */

  function drawProposal(mount, data, session, ctx) {
    var s = ctx.state;
    var proposal = s.proposal;

    var wrap = App.el("section", "view-checkin");
    wrap.appendChild(App.el("p", "kicker", "Propuesta para hoy"));
    wrap.appendChild(App.el("h1", "view-title", "Alternativas explicadas"));

    var box = App.el("div", "proposal");
    box.appendChild(App.el("p", "proposal__name", proposal.title));
    var list = App.el("ul", "changes");
    proposal.changes.forEach(function (c) { list.appendChild(App.el("li", null, c)); });
    box.appendChild(list);
    box.appendChild(App.el("p", "proposal__reason", proposal.reason));
    wrap.appendChild(box);

    if (proposal.importantPain) {
      wrap.appendChild(App.el("p", "notice notice--warn", SAFETY_TEXT));
    }

    var applyBtn = App.el("button", "btn btn--primary btn--block", "Aplicar versión adaptada");
    applyBtn.type = "button";
    applyBtn.addEventListener("click", function () {
      proposal.apply();
      if (proposal.hasChanges) session.esAdaptada = true;
      if (s.zona) {
        var savedProposal = data.saveDiscomfort({ zona: s.zona, lado: s.lado, zonaTexto: s.zonaTexto, intensidad: s.intensidadZona || s.molestia, tipo: s.tipoMolestia }, s.reuseId);
        if (s.notaZona && s.notaZona.trim()) savedProposal.nota = s.notaZona.trim();
      }
      App.toast("Versión adaptada aplicada.");
      App.viewContext("checkin").state = freshCheckin();
      App.navigate("train", { sessionId: session.id }, { replace: true });
    });
    wrap.appendChild(applyBtn);

    var keepBtn = App.el("button", "btn btn--ghost btn--block", "Mantener sesión prevista");
    keepBtn.type = "button";
    keepBtn.addEventListener("click", function () {
      App.toast("Mantienes la sesión prevista.");
      App.viewContext("checkin").state = freshCheckin();
      App.navigate("train", { sessionId: session.id }, { replace: true });
    });
    wrap.appendChild(keepBtn);

    var recoveryBtn = App.el("button", "btn btn--ghost btn--block", "Cambiar a recuperación");
    recoveryBtn.type = "button";
    recoveryBtn.addEventListener("click", function () {
      App.viewContext("checkin").state = freshCheckin();
      App.navigate("recovery", {}, { replace: true });
    });
    wrap.appendChild(recoveryBtn);

    var editBtn = App.el("button", "btn btn--quiet", "Editar check-in");
    editBtn.type = "button";
    editBtn.addEventListener("click", function () {
      s.stage = "form";
      App.navigate("checkin", { sessionId: session.id }, { replace: true });
    });
    wrap.appendChild(editBtn);

    mount.appendChild(wrap);
  }

  App.registerView("checkin", { title: "Check-in", render: render });
})();
