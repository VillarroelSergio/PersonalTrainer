/* =====================================================================
 * Vista: Creador guiado de plan (LOTE 2)
 * Asistente de 7 pasos (nota 14). Cada control responde de inmediato
 * (aria-pressed) y el paso 7 recompone la propuesta en directo a partir
 * de las respuestas — no hay caché salvo ediciones manuales de sesión,
 * que se invalidan si cambian entradas anteriores (ver getSessionsPreview).
 * Todo vive en App.viewContext("planBuilder") para no perder lo elegido
 * al volver atrás.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  var STEP_TITLES = ["Cómo empezar", "Tu objetivo", "Tu experiencia", "Tu disponibilidad", "Tu entorno", "Tu resistencia", "Tu propuesta"];

  var OBJETIVOS = ["Ganar músculo", "Mejorar resistencia", "Mantener forma", "Rendimiento combinado"];
  var EXPERIENCIAS = ["Principiante", "Intermedia", "Avanzada"];
  var CARGAS = ["Ligera", "Moderada", "Alta"];
  var DIAS_OPCIONES = ["3", "4", "5", "6"];
  var DURACIONES = ["20 min", "40 min", "60 min", "90+ min"];
  var ENTORNOS = ["Gimnasio completo", "Gimnasio básico", "Casa", "Exterior"];
  var CARDIO_ACTIVIDADES = ["Ninguna", "Correr", "Bici", "Andar"];
  var CARDIO_FRECUENCIAS = ["1", "2", "3"];

  var OBJETIVO_EXPLAIN = {
    "Ganar músculo": "Prioriza volumen moderado-alto y progresión constante de carga en tus sesiones de fuerza.",
    "Mejorar resistencia": "Da más peso a las sesiones de resistencia y cuida la recuperación entre sesiones de fuerza.",
    "Mantener forma": "Reparte el esfuerzo de forma sostenible, sin buscar máximos.",
    "Rendimiento combinado": "Equilibra fuerza y resistencia para que ninguna le reste a la otra."
  };

  function freshWizard() {
    return {
      step: 0,
      modo: null, plantilla: null,
      primeraSesionNombre: "", primeraSesionTipo: "fuerza",
      objetivo: null,
      experiencia: null, cargaHabitual: null,
      diasDisponibles: null, duracionHabitual: null,
      entorno: null,
      cardioActividad: null, cardioFrecuencia: null,
      customSessions: null, signature: null
    };
  }

  function render(mount) {
    var ctx = App.viewContext("planBuilder");
    if (!ctx.wizard) ctx.wizard = freshWizard();
    renderStep(mount, ctx);
  }

  function renderStep(mount, ctx) {
    mount.innerHTML = "";
    var w = ctx.wizard;
    var wrap = App.el("section", "view-planbuilder");
    stepHeader(wrap, mount, ctx, STEP_TITLES[w.step]);

    if (w.step === 0) renderModoStep(wrap, mount, ctx);
    else if (w.step === 1) renderObjetivoStep(wrap, mount, ctx);
    else if (w.step === 2) renderExperienciaStep(wrap, mount, ctx);
    else if (w.step === 3) renderDisponibilidadStep(wrap, mount, ctx);
    else if (w.step === 4) renderEntornoStep(wrap, mount, ctx);
    else if (w.step === 5) renderCardioStep(wrap, mount, ctx);
    else renderProposalStep(wrap, mount, ctx);

    mount.appendChild(wrap);
  }

  function stepHeader(wrap, mount, ctx, title) {
    var w = ctx.wizard;
    var header = App.el("div", "view-header");
    var back = App.el("button", "back-btn", "←");
    back.type = "button";
    back.setAttribute("aria-label", "Volver");
    back.addEventListener("click", function () {
      if (w.step === 0) { App.back(); return; }
      w.step--;
      renderStep(mount, ctx);
    });
    header.appendChild(back);

    var headBody = document.createElement("div");
    headBody.appendChild(App.el("p", "kicker", "Crear plan · paso " + (w.step + 1) + " de " + STEP_TITLES.length));
    headBody.appendChild(App.el("h1", "view-title", title));
    header.appendChild(headBody);
    wrap.appendChild(header);

    var progress = App.el("div", "blockprog");
    var track = App.el("div", "blockprog__track");
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", "Paso " + (w.step + 1) + " de " + STEP_TITLES.length);
    var fill = App.el("div", "blockprog__fill");
    fill.style.width = Math.round(((w.step + 1) / STEP_TITLES.length) * 100) + "%";
    track.appendChild(fill);
    progress.appendChild(track);
    wrap.appendChild(progress);
  }

  function buildPicker(options, current, ariaLabel, onSelect) {
    var picker = App.el("div", "picker picker--wide");
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", ariaLabel);
    options.forEach(function (opt) {
      var btn = App.el("button", "picker__btn", opt);
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(current === opt));
      btn.addEventListener("click", function () { onSelect(opt); });
      picker.appendChild(btn);
    });
    return picker;
  }

  function appendNext(wrap, mount, ctx, enabled, label) {
    var btn = App.el("button", "btn btn--primary btn--block", label || "Siguiente");
    btn.type = "button";
    btn.addEventListener("click", function () {
      if (!enabled) { App.toast("Elige una opción para continuar."); return; }
      ctx.wizard.step++;
      renderStep(mount, ctx);
    });
    wrap.appendChild(btn);
  }

  /* ---- Paso 1: modo (plantilla o desde cero) ----------------------------- */

  function renderModoStep(wrap, mount, ctx) {
    var w = ctx.wizard;
    wrap.appendChild(App.el("p", "lede", "Puedes partir de una plantilla conocida o definir tu primera sesión desde cero."));

    wrap.appendChild(buildPicker(["Usar plantilla", "Empezar de cero"],
      w.modo === "plantilla" ? "Usar plantilla" : w.modo === "cero" ? "Empezar de cero" : null,
      "Modo de creación",
      function (opt) { w.modo = opt === "Usar plantilla" ? "plantilla" : "cero"; renderStep(mount, ctx); }));

    if (w.modo === "plantilla") {
      wrap.appendChild(App.el("p", "field__label", "Elige una plantilla"));
      var tmplPicker = App.el("div", "picker picker--wide");
      tmplPicker.setAttribute("role", "group");
      tmplPicker.setAttribute("aria-label", "Plantilla");
      Object.keys(App.data.PLAN_TEMPLATES).forEach(function (key) {
        var t = App.data.PLAN_TEMPLATES[key];
        var btn = App.el("button", "picker__btn", t.nombre);
        btn.type = "button";
        btn.setAttribute("aria-pressed", String(w.plantilla === key));
        btn.addEventListener("click", function () { w.plantilla = key; renderStep(mount, ctx); });
        tmplPicker.appendChild(btn);
      });
      wrap.appendChild(tmplPicker);
    } else if (w.modo === "cero") {
      var field = App.el("div", "field");
      var label = App.el("label", "field__label", "Nombre de tu primera sesión");
      label.setAttribute("for", "primeraSesion");
      field.appendChild(label);
      var input = document.createElement("input");
      input.type = "text";
      input.id = "primeraSesion";
      input.value = w.primeraSesionNombre;
      input.addEventListener("input", function () { w.primeraSesionNombre = input.value; });
      field.appendChild(input);
      wrap.appendChild(field);

      wrap.appendChild(App.el("p", "field__label", "Tipo de sesión"));
      var tipoPicker = App.el("div", "picker");
      tipoPicker.setAttribute("role", "group");
      tipoPicker.setAttribute("aria-label", "Tipo de sesión");
      [["fuerza", "Fuerza"], ["resistencia", "Resistencia"]].forEach(function (pair) {
        var btn = App.el("button", "picker__btn", pair[1]);
        btn.type = "button";
        btn.setAttribute("aria-pressed", String(w.primeraSesionTipo === pair[0]));
        btn.addEventListener("click", function () { w.primeraSesionTipo = pair[0]; renderStep(mount, ctx); });
        tipoPicker.appendChild(btn);
      });
      wrap.appendChild(tipoPicker);
    }

    var enabled = w.modo === "plantilla" ? !!w.plantilla : w.modo === "cero" ? !!w.primeraSesionNombre.trim() : false;
    appendNext(wrap, mount, ctx, enabled);
  }

  /* ---- Paso 2: objetivo --------------------------------------------------- */

  function renderObjetivoStep(wrap, mount, ctx) {
    var w = ctx.wizard;
    wrap.appendChild(App.el("p", "lede small", "Esto cambia cómo te explicamos la propuesta final, no una lista distinta de ejercicios."));
    wrap.appendChild(buildPicker(OBJETIVOS, w.objetivo, "Objetivo actual", function (opt) { w.objetivo = opt; renderStep(mount, ctx); }));
    appendNext(wrap, mount, ctx, !!w.objetivo);
  }

  /* ---- Paso 3: experiencia y carga habitual ------------------------------- */

  function renderExperienciaStep(wrap, mount, ctx) {
    var w = ctx.wizard;
    wrap.appendChild(App.el("p", "field__label", "Experiencia"));
    wrap.appendChild(buildPicker(EXPERIENCIAS, w.experiencia, "Experiencia", function (opt) { w.experiencia = opt; renderStep(mount, ctx); }));
    wrap.appendChild(App.el("p", "field__label", "Carga habitual"));
    wrap.appendChild(buildPicker(CARGAS, w.cargaHabitual, "Carga habitual", function (opt) { w.cargaHabitual = opt; renderStep(mount, ctx); }));
    appendNext(wrap, mount, ctx, !!(w.experiencia && w.cargaHabitual));
  }

  /* ---- Paso 4: días disponibles y duración -------------------------------- */

  function renderDisponibilidadStep(wrap, mount, ctx) {
    var w = ctx.wizard;
    wrap.appendChild(App.el("p", "field__label", "Días disponibles por semana"));
    wrap.appendChild(buildPicker(DIAS_OPCIONES, w.diasDisponibles, "Días disponibles", function (opt) { w.diasDisponibles = opt; renderStep(mount, ctx); }));
    wrap.appendChild(App.el("p", "field__label", "Duración habitual de sesión"));
    wrap.appendChild(buildPicker(DURACIONES, w.duracionHabitual, "Duración habitual", function (opt) { w.duracionHabitual = opt; renderStep(mount, ctx); }));
    appendNext(wrap, mount, ctx, !!(w.diasDisponibles && w.duracionHabitual));
  }

  /* ---- Paso 5: entorno ------------------------------------------------------ */

  function renderEntornoStep(wrap, mount, ctx) {
    var w = ctx.wizard;
    wrap.appendChild(App.el("p", "lede small", "Solo para priorizar variantes compatibles: no pedimos tu inventario exacto de máquinas."));
    wrap.appendChild(buildPicker(ENTORNOS, w.entorno, "Entorno habitual", function (opt) { w.entorno = opt; renderStep(mount, ctx); }));
    appendNext(wrap, mount, ctx, !!w.entorno);
  }

  /* ---- Paso 6: actividades de resistencia --------------------------------- */

  function renderCardioStep(wrap, mount, ctx) {
    var w = ctx.wizard;
    wrap.appendChild(App.el("p", "field__label", "Actividad de resistencia"));
    wrap.appendChild(buildPicker(CARDIO_ACTIVIDADES, w.cardioActividad, "Actividad de resistencia", function (opt) {
      w.cardioActividad = opt;
      if (opt === "Ninguna") w.cardioFrecuencia = "0";
      renderStep(mount, ctx);
    }));
    if (w.cardioActividad && w.cardioActividad !== "Ninguna") {
      wrap.appendChild(App.el("p", "field__label", "Frecuencia por semana"));
      wrap.appendChild(buildPicker(CARDIO_FRECUENCIAS, w.cardioFrecuencia, "Frecuencia", function (opt) { w.cardioFrecuencia = opt; renderStep(mount, ctx); }));
    }
    appendNext(wrap, mount, ctx, !!w.cardioActividad, "Ver propuesta");
  }

  /* ---- Paso 7: propuesta --------------------------------------------------- */

  function getSessionsPreview(ctx) {
    var w = ctx.wizard;
    var sig = JSON.stringify([w.modo, w.plantilla, w.primeraSesionNombre, w.primeraSesionTipo, w.diasDisponibles, w.duracionHabitual, w.cardioActividad, w.cardioFrecuencia]);
    if (!w.customSessions || w.signature !== sig) {
      w.customSessions = App.data.generatePlanWeek({
        modo: w.modo, plantilla: w.plantilla,
        primeraSesionNombre: w.primeraSesionNombre, primeraSesionTipo: w.primeraSesionTipo,
        diasDisponibles: w.diasDisponibles, duracionHabitual: w.duracionHabitual,
        cardioActividad: w.cardioActividad, cardioFrecuencia: w.cardioFrecuencia
      });
      w.signature = sig;
    }
    return w.customSessions;
  }

  function proposalName(w) {
    if (w.modo === "cero") return w.primeraSesionNombre ? "Plan personalizado: " + w.primeraSesionNombre : "Plan personalizado";
    var tmpl = App.data.PLAN_TEMPLATES[w.plantilla];
    return tmpl ? tmpl.nombre : "Nuevo plan";
  }

  function renderProposalStep(wrap, mount, ctx) {
    var data = App.data;
    var w = ctx.wizard;
    var sessions = getSessionsPreview(ctx);

    wrap.appendChild(App.el("p", "lede", OBJETIVO_EXPLAIN[w.objetivo] || "Semana propuesta según tus respuestas."));
    if (w.entorno) {
      wrap.appendChild(App.el("p", "lede small",
        "Entorno " + w.entorno.toLowerCase() + ": se priorizan variantes compatibles con ese entorno, no un inventario exacto."));
    }

    wrap.appendChild(App.el("h2", "section-title", "Tu semana propuesta"));
    var list = App.el("ol", "daylist");
    data.DAYS.forEach(function (day) {
      var session = null;
      sessions.forEach(function (s) { if (s.day === day.key) session = s; });
      var cls = "dayrow" + (session ? (session.tipo === "resistencia" ? " dayrow--cardio dayrow--planificada" : " dayrow--planificada") : " dayrow--descanso");
      var row = App.el("li", cls);
      var top = App.el("div", "dayrow__top");
      var body = document.createElement("div");
      body.appendChild(App.el("p", "dayrow__day", day.nombre));
      if (session) {
        body.appendChild(App.el("p", "dayrow__title", session.nombre));
        body.appendChild(App.el("p", "dayrow__meta", session.proposito + " · " + session.duracionPrevista + " min"));
        var conflict = data.findConflict(sessions, day.key, session);
        if (conflict) {
          body.appendChild(App.el("p", "notice notice--warn",
            "Junto a " + conflict.nombre.toLowerCase() + " puedes llegar con más fatiga a una de las dos. Podrás recolocarla después desde el calendario."));
        }
      } else {
        body.appendChild(App.el("p", "dayrow__title", "Descanso"));
      }
      top.appendChild(body);
      row.appendChild(top);
      list.appendChild(row);
    });
    wrap.appendChild(list);

    wrap.appendChild(App.el("h2", "section-title", "Línea temporal de fases"));
    var fases = data.buildFasesFromTemplate(1);
    var bar = App.el("div", "phasebar");
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", "Fases del plan propuesto");
    fases.forEach(function (f) {
      var seg = App.el("div", "phaseseg" + (f.estado === "actual" ? " phaseseg--current" : ""));
      seg.style.flexGrow = String(f.span);
      seg.style.flexBasis = "0";
      seg.textContent = f.span + " sem";
      bar.appendChild(seg);
    });
    wrap.appendChild(bar);
    var phList = App.el("ul", "phaselist");
    fases.forEach(function (f) {
      var li = App.el("li", f.estado === "actual" ? "is-current" : "");
      var body = document.createElement("div");
      body.appendChild(App.el("p", "phase__name", f.nombre));
      body.appendChild(App.el("p", "lede small", f.proposito));
      li.appendChild(body);
      li.appendChild(App.el("span", "phase__weeks", f.semanas));
      phList.appendChild(li);
    });
    wrap.appendChild(phList);

    var activarBtn = App.el("button", "btn btn--primary btn--block", "Activar plan");
    activarBtn.type = "button";
    activarBtn.addEventListener("click", function () { confirmActivateNewPlan(ctx); });
    wrap.appendChild(activarBtn);

    var editWeekBtn = App.el("button", "btn btn--ghost btn--block", "Guardar como borrador y editar en el calendario");
    editWeekBtn.type = "button";
    editWeekBtn.addEventListener("click", function () { commitAsDraft(ctx); });
    wrap.appendChild(editWeekBtn);

    var editSessionBtn = App.el("button", "btn btn--ghost btn--block", "Editar una sesión de la propuesta");
    editSessionBtn.type = "button";
    editSessionBtn.addEventListener("click", function () { openEditSessionSheet(ctx, mount); });
    wrap.appendChild(editSessionBtn);

    var backBtn = App.el("button", "btn btn--quiet", "Volver a cambiar tus respuestas");
    backBtn.type = "button";
    backBtn.addEventListener("click", function () { ctx.wizard.step = 1; renderStep(mount, ctx); });
    wrap.appendChild(backBtn);
  }

  function openEditSessionSheet(ctx, mount) {
    var sessions = getSessionsPreview(ctx);
    App.openSheet({
      title: "Editar una sesión",
      render: function (body) {
        if (!sessions.length) { body.appendChild(App.el("p", "lede small", "No hay sesiones generadas todavía.")); return; }
        sessions.forEach(function (s) {
          var btn = App.el("button", "opt");
          btn.type = "button";
          btn.appendChild(App.el("span", "opt__name", s.nombre));
          btn.appendChild(App.el("span", "opt__meta", App.data.dayByKey(s.day).nombre));
          btn.addEventListener("click", function () {
            App.closeSheet();
            openEditSingleSessionSheet(s, ctx, mount);
          });
          body.appendChild(btn);
        });
      }
    });
  }

  function openEditSingleSessionSheet(session, ctx, mount) {
    App.openSheet({
      title: "Editar " + session.nombre,
      render: function (body) {
        var nameField = App.el("div", "field");
        var label = App.el("label", "field__label", "Nombre de la sesión");
        label.setAttribute("for", "builderEditName");
        nameField.appendChild(label);
        var input = document.createElement("input");
        input.type = "text";
        input.id = "builderEditName";
        input.value = session.nombre;
        nameField.appendChild(input);
        body.appendChild(nameField);

        var confirmBtn = App.el("button", "btn btn--primary btn--block", "Guardar cambios");
        confirmBtn.type = "button";
        confirmBtn.addEventListener("click", function () {
          if (!input.value.trim()) { App.toast("Escribe un nombre."); return; }
          session.nombre = input.value.trim();
          App.closeSheet();
          App.toast("Sesión actualizada en la propuesta.");
          renderStep(mount, ctx);
        });
        body.appendChild(confirmBtn);

        var cancelBtn = App.el("button", "btn btn--ghost btn--block", "Cancelar");
        cancelBtn.type = "button";
        cancelBtn.addEventListener("click", function () { App.closeSheet(); });
        body.appendChild(cancelBtn);
      }
    });
  }

  function confirmActivateNewPlan(ctx) {
    var w = ctx.wizard;
    App.confirmSheet({
      title: "Activar plan",
      body: "Tu semana se activa ahora mismo. Podrás editar, recolocar u omitir sesiones después desde el calendario.",
      confirmLabel: "Activar plan",
      onConfirm: function () {
        var data = App.data;
        var sessions = getSessionsPreview(ctx);
        if (data.plan && data.plan.estado === "activo") data.plan.estado = "pausado";
        var plan = {
          id: "plan-" + Date.now(),
          nombre: proposalName(w),
          estado: "activo",
          semanaActual: 1,
          semanasTotales: 8,
          constanciaSemanas: 0,
          fases: data.buildFasesFromTemplate(1),
          plantilla: w.plantilla
        };
        data.PLANS.push(plan);
        data.plan = plan;
        data.SESSIONS.length = 0;
        Array.prototype.push.apply(data.SESSIONS, sessions);
        data.lastAction = null;
        App.viewContext("planBuilder").wizard = freshWizard();
        App.toast(plan.nombre + " está activo.");
        App.navigate("home", {}, { replace: true });
      }
    });
  }

  // ponytail: el prototipo solo mantiene un calendario de trabajo (data.SESSIONS)
  // ligado al plan activo. "Editar la semana" guarda la propuesta como borrador
  // con su propia semana (plan.sessions); al activarlo desde "Tus planes" se usa
  // esa semana guardada en vez de regenerar una por defecto. Si hiciera falta
  // editar el calendario de un borrador sin activarlo, habría que dar a cada
  // plan su propio calendario navegable, no solo al activo.
  function commitAsDraft(ctx) {
    var data = App.data;
    var w = ctx.wizard;
    var sessions = getSessionsPreview(ctx);
    var plan = {
      id: "plan-" + Date.now(),
      nombre: proposalName(w),
      estado: "borrador",
      semanaActual: 0,
      semanasTotales: 8,
      constanciaSemanas: 0,
      fases: data.buildFasesFromTemplate(1),
      plantilla: w.plantilla,
      sessions: sessions
    };
    data.PLANS.push(plan);
    App.viewContext("planBuilder").wizard = freshWizard();
    App.toast("Guardado como borrador: " + plan.nombre + ". Actívalo desde “Tus planes” para verlo en el calendario.");
    App.viewContext("plan").tab = "gestion";
    App.navigate("plan", {}, { replace: true });
  }

  App.registerView("planBuilder", { title: "Crear plan", render: render });
})();
