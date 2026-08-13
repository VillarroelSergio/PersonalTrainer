/* =====================================================================
 * Vista: Resistencia planificada (resistencia-reloj-importacion-007)
 * La app DISEÑA la sesión; la persona la CREA MANUALMENTE en su reloj y la
 * REALIZA FUERA de la app. Aquí NUNCA hay ejecución en vivo: sin tramo "en
 * curso", sin pausar/reanudar, sin "marcar tramo", sin cronómetro. El
 * resultado real llega por importación (ver import.js). Reemplaza la
 * ejecución por segmentos de la nota 21 (obsoleta).
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  var ESTADO_LABEL = {
    planificada: "Planificada",
    programada_reloj: "Programada en reloj",
    realizada_pendiente_importar: "Realizada, pendiente de importar",
    importada_asociada: "Importada y asociada",
    asociada_adaptacion: "Asociada con adaptación",
    sin_resultado: "Sin resultado"
  };

  var ENTORNOS = ["Exterior", "Cinta", "Bici estática", "Casa"];

  /* ---- Entrada de la vista ------------------------------------------------ */

  function render(mount, params) {
    var data = App.data;
    var session = resolveSession(data, params);

    if (!session) {
      // Nota core.js: App.states.empty() limpia el contenedor que recibe, así
      // que el <h1> vive en `wrap0` y el estado vacío se dibuja en un `body`
      // aparte (mismo patrón que el fallback de vistas de core.js).
      var wrap0 = App.el("section", "view-endurance");
      wrap0.appendChild(App.el("h1", "view-title", "Resistencia"));
      var body0 = App.el("div");
      App.states.empty(body0, {
        title: "No hay ninguna sesión de resistencia para hoy",
        body: "Puedes explorar los seis objetivos de resistencia o importar una actividad ya realizada.",
        actionLabel: "Ver los seis objetivos",
        onAction: function () { openObjectivesSheet(data); }
      });
      wrap0.appendChild(body0);
      wrap0.appendChild(buildImportEntry(null));
      mount.appendChild(wrap0);
      return;
    }

    if (session.tipo !== "resistencia") {
      var wrap1 = App.el("section", "view-endurance");
      wrap1.appendChild(App.el("h1", "view-title", session.nombre));
      var body1 = App.el("div");
      App.states.empty(body1, {
        title: "Esta sesión es de fuerza",
        body: "Ábrela desde “Entrenar” para registrar sus series.",
        actionLabel: "Ir a Entrenar",
        onAction: function () { App.navigate("train", { sessionId: session.id }); }
      });
      wrap1.appendChild(body1);
      mount.appendChild(wrap1);
      return;
    }

    drawSession(mount, data, session);
  }

  function resolveSession(data, params) {
    if (params && params.sessionId) {
      var s = data.findSession(params.sessionId);
      if (s) return s;
    }
    var today = data.sessionOnDay(data.hoy);
    if (today && today.tipo === "resistencia") return today;
    return null;
  }

  /* ---- Los seis objetivos (nota 06): todos visitables, con briefing ------- */

  function openObjectivesSheet(data) {
    App.openSheet({
      title: "Objetivos de resistencia",
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          "Seis formas de planificar una sesión de correr, bici o caminar. El prototipo no replica un reloj deportivo: explica duración, intensidad y estructura en lenguaje llano."));
        data.ENDURANCE_OBJECTIVES.forEach(function (obj) {
          body.appendChild(buildObjectiveCard(obj));
        });
      }
    });
  }

  function buildObjectiveCard(obj) {
    var card = App.el("div", "objective-card");
    card.appendChild(App.el("p", "objective-card__name", obj.nombre));
    var meta = App.el("p", "objective-card__meta", obj.duracionTexto + " · " + obj.intensidadTexto);
    card.appendChild(meta);
    card.appendChild(App.el("p", "lede small", obj.estructuraTexto));
    card.appendChild(App.el("p", "lede small", "Para qué sirve: " + obj.proposito));
    return card;
  }

  /* ---- Pantalla principal de una sesión concreta --------------------------- */

  function drawSession(mount, data, session) {
    var tmpl = data.enduranceTemplate(session.objetivo);
    var estadoLabel = ESTADO_LABEL[session.estado] || session.estado;
    var pendienteDeResultado = session.estado === "planificada" || session.estado === "programada_reloj" ||
      session.estado === "realizada_pendiente_importar" || session.estado === "sin_resultado";

    var wrap = App.el("section", "view-endurance");
    wrap.appendChild(App.el("p", "kicker", "Resistencia · " + estadoLabel + (session.esAdaptada ? " · versión adaptada" : "")));
    wrap.appendChild(App.el("h1", "view-title", session.nombre));

    var badges = App.el("div", "badge-row");
    badges.appendChild(App.el("span", "state state--" + session.estado, estadoLabel));
    if (session.esAdaptada) badges.appendChild(App.el("span", "state state--adaptada", "Sesión adaptada"));
    wrap.appendChild(badges);

    var loadMsg = data.loadContext();
    if (loadMsg) wrap.appendChild(App.el("p", "notice notice--info", loadMsg));

    // ---- Cabecera en lenguaje llano: propósito, entorno y duración total ---
    if (tmpl) {
      var brief = App.el("div", "endurance-brief");
      brief.appendChild(App.el("p", "endurance-brief__line", "Entorno elegido: " + data.enduranceEnv(session)));
      brief.appendChild(App.el("p", "endurance-brief__line", "Duración total estimada: " + (session.duracionPrevista || "—") + " min"));
      brief.appendChild(App.el("p", "endurance-brief__line", "Intensidad: " + tmpl.intensidadTexto));
      brief.appendChild(App.el("p", "endurance-brief__line", "Para qué sirve: " + tmpl.proposito));
      wrap.appendChild(brief);
    }

    // ---- Ajuste explicable (nota 06): choque de carga con día adyacente,
    // solo mientras la sesión sigue pendiente de realizarse. ------------------
    var conflict = data.findConflict(data.SESSIONS, session.day, session);
    if (conflict && pendienteDeResultado && !session.esAdaptada) {
      var adjustNotice = App.el("div", "notice notice--warn");
      adjustNotice.appendChild(App.el("p", null,
        session.nombre + " es una sesión intensa y está junto a " + conflict.nombre.toLowerCase() +
        " (piernas), lo que puede sumar fatiga. Puedes ajustarla o seguir tal como está: tú decides."));
      var altBtn = App.el("button", "btn btn--ghost btn--block", "Ver alternativa explicada");
      altBtn.type = "button";
      altBtn.addEventListener("click", function () { openAdjustProposalSheet(session, data, conflict); });
      adjustNotice.appendChild(altBtn);
      wrap.appendChild(adjustNotice);
    }

    // ---- Estructura de SOLO LECTURA: calentamiento, trabajo, recuperación,
    // "repite N veces" y vuelta a la calma (nota 31). Nunca interactiva. -----
    var structure = data.enduranceStructure(session);
    if (structure) {
      wrap.appendChild(buildStructureList(structure));
    } else {
      wrap.appendChild(buildContinuousBlock(session, tmpl));
    }

    // ---- prioridad-hibrida-006: capas SECUNDARIAS y NUNCA obligatorias,
    // después de la guía humana de arriba. Colapsadas por defecto. ----------
    wrap.appendChild(buildOptionalLayers(session));
    wrap.appendChild(buildEnvAlternatives());

    var objLink = App.el("button", "btn btn--quiet", "Ver los seis objetivos de resistencia");
    objLink.type = "button";
    objLink.addEventListener("click", function () { openObjectivesSheet(data); });
    wrap.appendChild(objLink);

    // ---- Orden de fases (revisión UX): antes de hacer la actividad, la
    // única acción posible es prepararla ("Preparar en mi reloj" u otro
    // ajuste); importar solo tiene sentido DESPUÉS de haberla hecho, así que
    // buildActions (que incluye "Ya hice la actividad") va primero y el
    // acceso a importar queda como último paso, no como la primera opción
    // que se ve al entrar (nota 07: sigue siempre visible, solo cambia dónde).
    wrap.appendChild(buildActions(session, data, tmpl, pendienteDeResultado));

    wrap.appendChild(buildImportEntry(session.id));

    mount.appendChild(wrap);
  }

  // Botón + explicación reutilizados en el estado vacío y en una sesión real
  // (nota 07/29): admite .FIT/.TCX/.GPX, sin parser real. Si se pasa
  // sessionId, la importación llega con la asociación ya sugerida.
  function buildImportEntry(sessionId) {
    var box = App.el("div", "endurance-import-entry");
    var importLink = App.el("button", "btn btn--ghost btn--block", "Importar actividad");
    importLink.type = "button";
    importLink.addEventListener("click", function () { App.navigate("import", sessionId ? { sessionId: sessionId } : {}); });
    box.appendChild(importLink);
    box.appendChild(App.el("p", "lede small",
      "Admite .FIT, .TCX y .GPX de tu reloj. Este prototipo no procesa archivos reales: sirve para registrar el resultado real de una actividad ya hecha fuera de la app."));
    return box;
  }

  // ---- prioridad-hibrida-006: capas opcionales (duración/distancia/ritmo/
  // RPE/desnivel/superficie/FC-zona). Viven en session.detalleOpcional, texto
  // libre (sin sensores reales), y nunca se validan ni se exigen. -----------
  var OPTIONAL_FIELDS = [
    ["duracionMin", "Duración (min)"], ["distanciaKm", "Distancia (km)"], ["ritmo", "Ritmo"],
    ["rpe", "RPE (1-10)"], ["desnivel", "Desnivel (m)"], ["superficie", "Superficie"], ["fcZona", "Zona de FC"]
  ];

  function buildOptionalLayers(session) {
    session.detalleOpcional = session.detalleOpcional || {};
    var det = document.createElement("details");
    det.className = "endurance-optional";
    var summary = document.createElement("summary");
    summary.textContent = "Datos opcionales (nunca obligatorios)";
    det.appendChild(summary);
    OPTIONAL_FIELDS.forEach(function (f) {
      var field = App.el("div", "field");
      var label = App.el("label", "field__label", f[1]);
      label.setAttribute("for", "opt-" + f[0]);
      field.appendChild(label);
      var input = document.createElement("input");
      input.type = "text";
      input.id = "opt-" + f[0];
      input.value = session.detalleOpcional[f[0]] || "";
      input.addEventListener("input", function () { session.detalleOpcional[f[0]] = input.value; });
      field.appendChild(input);
      det.appendChild(field);
    });
    return det;
  }

  // ---- Alternativas por entorno: texto genérico coherente con cualquier
  // objetivo, no requiere que la sesión declare su propio entorno.
  function buildEnvAlternatives() {
    var box = App.el("div", "endurance-envalts");
    box.appendChild(App.el("p", "field__label", "Alternativas por entorno"));
    var list = App.el("ul", "cues");
    // onboarding-guiado-010 (ronda 2, corrección de bajo riesgo): texto
    // actualizado para ser coherente con los 5 entornos vigentes en
    // App.data.ENTORNOS_ONBOARDING ("Parque"/"Viaje" ya no existen como
    // entornos seleccionables). Solo texto, sin tocar la lógica de la vista.
    [
      "Gimnasio completo: adapta el estímulo a máquinas de cardio si el clima o el terreno no acompañan.",
      "Gimnasio básico: usa la cinta o la bici que tengas disponible como alternativa.",
      "Casa: circuito corto si no puedes salir.",
      "Exterior: ideal si el objetivo pide terreno variable.",
      "Cinta/bici estática: mismo objetivo con velocidad e inclinación en vez de terreno real.",
      "Lluvia: pásate a cinta o bici estática sin perder el estímulo."
    ].forEach(function (a) { list.appendChild(App.el("li", null, a)); });
    box.appendChild(list);
    return box;
  }

  function buildContinuousBlock(session, tmpl) {
    var block = App.el("div", "endurance-continuous");
    block.appendChild(App.el("p", "field__label", "Sesión continua: sin tramos"));
    block.appendChild(App.el("p", "lede", tmpl ? tmpl.intensidadTexto : "Mantén un ritmo constante y cómodo."));
    return block;
  }

  /* ---- Estructura cronológica de solo lectura (nota 31) --------------------- */

  var TIPO_LABEL = {
    calentamiento: "Calentamiento",
    trabajo: "Trabajo",
    recuperacion: "Recuperación",
    vuelta_calma: "Vuelta a la calma"
  };

  function buildStructureList(structure) {
    var host = App.el("div", "segment-list-host");
    var list = App.el("ol", "segments");
    structure.forEach(function (entry) { list.appendChild(buildStructureRow(entry)); });
    host.appendChild(list);
    return host;
  }

  function buildStructureRow(entry) {
    if (entry.tipo === "grupo") {
      var li = App.el("li", "segment segment--grupo");
      li.appendChild(App.el("p", "segment__name", "Repite " + entry.repeticiones + " veces"));
      li.appendChild(App.el("p", "segment__meta", entry.nombre + ": " + entry.duracionTexto + " · " + entry.objetivoTexto));
      li.appendChild(App.el("p", "segment__meta", entry.recNombre + ": " + entry.recDuracionTexto + " · " + entry.recObjetivoTexto));
      return li;
    }
    var row = App.el("li", "segment segment--" + entry.tipo);
    var head = App.el("div", "segment__head");
    head.appendChild(App.el("span", "segment__name", entry.nombre));
    head.appendChild(App.el("span", "tag", TIPO_LABEL[entry.tipo] || entry.tipo));
    row.appendChild(head);
    row.appendChild(App.el("p", "segment__meta", entry.duracionTexto + " · " + entry.objetivoTexto));
    return row;
  }

  /* ---- Acciones: ajustar, preparar en el reloj y confirmar (nota 31) ------- */

  function buildActions(session, data, tmpl, pendienteDeResultado) {
    var box = App.el("div", "endurance-controls");

    if (session.estado === "importada_asociada" || session.estado === "asociada_adaptacion") {
      box.appendChild(App.el("p", "notice notice--info",
        "Esta sesión ya tiene una actividad importada asociada. Consulta el resultado real desde el historial."));
      var histBtn = App.el("button", "btn btn--ghost btn--block", "Ver en historial");
      histBtn.type = "button";
      histBtn.addEventListener("click", function () { App.navigate("history"); });
      box.appendChild(histBtn);
      return box;
    }

    var adjustBtn = App.el("button", "btn btn--ghost btn--block", "Ajustar propuesta");
    adjustBtn.type = "button";
    adjustBtn.addEventListener("click", function () { openAdjustProposalSheet(session, data, null); });
    box.appendChild(adjustBtn);

    // ---- LOTE 4: "Preparar en mi reloj" es la CTA PRINCIPAL mientras la
    // sesión sigue "planificada" (aún no preparada): nunca "empezar" nada,
    // siempre preparar en el dispositivo externo primero. Una vez marcada
    // como creada en el reloj, deja de ser la acción principal (ya se hizo).
    var watchBtn = App.el("button", "btn " + (session.estado === "planificada" ? "btn--primary" : "btn--ghost") + " btn--block", "Preparar en mi reloj");
    watchBtn.type = "button";
    watchBtn.addEventListener("click", function () { openWatchInstructionsSheet(session, data, tmpl); });
    box.appendChild(watchBtn);

    if (session.estado === "planificada") {
      // Acción secundaria de confirmación posterior: se ofrece junto a
      // "Preparar en mi reloj", pero ya no es la CTA principal.
      var scheduledBtn = App.el("button", "btn btn--ghost btn--block", "Ya está creado en mi reloj");
      scheduledBtn.type = "button";
      scheduledBtn.addEventListener("click", function () {
        data.markEnduranceScheduled(session);
        App.persist();
        App.toast("Marcada como creada en tu reloj.");
        App.navigate("endurance", { sessionId: session.id }, { replace: true });
      });
      box.appendChild(scheduledBtn);
    }

    if (session.estado === "programada_reloj") {
      var doneBtn = App.el("button", "btn btn--primary btn--block", "Ya hice la actividad (aún sin importar)");
      doneBtn.type = "button";
      doneBtn.addEventListener("click", function () {
        data.markEnduranceAwaitingImport(session);
        App.persist();
        App.toast("Marcada como realizada. Importa el archivo cuando lo tengas.");
        App.navigate("endurance", { sessionId: session.id }, { replace: true });
      });
      box.appendChild(doneBtn);
    }

    if (session.estado === "programada_reloj" || session.estado === "realizada_pendiente_importar") {
      var noResultBtn = App.el("button", "btn btn--ghost btn--block", "Marcar sin resultado");
      noResultBtn.type = "button";
      noResultBtn.addEventListener("click", function () {
        App.confirmSheet({
          title: "Marcar sin resultado",
          body: "Se registra que esta sesión no llegó a hacerse o no se pudo importar. El plan no cambia por esto: solo queda anotado.",
          confirmLabel: "Marcar sin resultado",
          cancelLabel: "Cancelar",
          onConfirm: function () {
            data.markEnduranceNoResult(session);
            App.persist();
            App.toast("Sesión marcada sin resultado.");
            App.navigate("endurance", { sessionId: session.id }, { replace: true });
          }
        });
      });
      box.appendChild(noResultBtn);
    }

    return box;
  }

  /* ---- Preparar en mi reloj: instrucciones de texto, sin dispositivo real -- */

  function openWatchInstructionsSheet(session, data, tmpl) {
    App.openSheet({
      title: "Preparar en mi reloj",
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          "Crea manualmente estos bloques en tu reloj (Garmin u otro), en este orden. Este prototipo no envía nada al dispositivo: es una guía de texto."));

        var structure = data.enduranceStructure(session);
        var list = App.el("ol", "cues");
        if (structure) {
          structure.forEach(function (entry) {
            if (entry.tipo === "grupo") {
              list.appendChild(App.el("li", null,
                "Repite " + entry.repeticiones + " veces: " + entry.nombre.toLowerCase() + " (" + entry.duracionTexto + ", " + entry.objetivoTexto.toLowerCase() + ") + " +
                entry.recNombre.toLowerCase() + " (" + entry.recDuracionTexto + ", " + entry.recObjetivoTexto.toLowerCase() + ")."));
            } else {
              list.appendChild(App.el("li", null, entry.nombre + ": " + entry.duracionTexto + ", " + entry.objetivoTexto.toLowerCase()));
            }
          });
        } else {
          list.appendChild(App.el("li", null, "Bloque único: " + (tmpl ? tmpl.duracionTexto + ", " + tmpl.intensidadTexto.toLowerCase() : "ritmo constante y cómodo.")));
        }
        body.appendChild(list);

        body.appendChild(App.el("p", "lede small", "Entorno elegido: " + data.enduranceEnv(session) + " · Duración total estimada: " + (session.duracionPrevista || "—") + " min."));
      }
    });
  }

  /* ---- Ajustar propuesta: duración, repeticiones o entorno (nota 31) ------- */

  function openAdjustProposalSheet(session, data, conflict) {
    var tmpl = data.enduranceTemplate(session.objetivo);
    var hasStructure = !!(tmpl && tmpl.segments);

    App.openSheet({
      title: "Ajustar propuesta",
      render: function (body) {
        if (conflict) {
          body.appendChild(App.el("p", "notice notice--warn",
            session.nombre + " junto a " + conflict.nombre.toLowerCase() + " puede sumar fatiga a una de las dos sesiones."));
        } else {
          body.appendChild(App.el("p", "lede small", "Elige qué ajustar. El objetivo de la sesión se mantiene en todas las opciones salvo que cambies por recuperación."));
        }

        var reduceBtn = App.el("button", "opt");
        reduceBtn.type = "button";
        reduceBtn.appendChild(App.el("span", "opt__name", "Reducir duración"));
        reduceBtn.appendChild(App.el("span", "opt__meta", "Baja la duración prevista a ~60%. Se conserva el propósito."));
        reduceBtn.addEventListener("click", function () {
          App.closeSheet();
          session.duracionPrevista = Math.max(10, Math.round((session.duracionPrevista || 30) * 0.6));
          markAdjusted(session);
          App.toast("Duración reducida a " + session.duracionPrevista + " min.");
          App.navigate("endurance", { sessionId: session.id }, { replace: true });
        });
        body.appendChild(reduceBtn);

        if (hasStructure) {
          var repeatBtn = App.el("button", "opt");
          repeatBtn.type = "button";
          repeatBtn.appendChild(App.el("span", "opt__name", "Añadir una repetición más"));
          repeatBtn.appendChild(App.el("span", "opt__meta", "Suma un ciclo de trabajo + recuperación (~5 min más)."));
          repeatBtn.addEventListener("click", function () {
            App.closeSheet();
            session.repeticionesExtra = (session.repeticionesExtra || 0) + 1;
            session.duracionPrevista = (session.duracionPrevista || 30) + 5;
            markAdjusted(session);
            App.toast("Repetición añadida: " + session.duracionPrevista + " min en total.");
            App.navigate("endurance", { sessionId: session.id }, { replace: true });
          });
          body.appendChild(repeatBtn);
        }

        var envBtn = App.el("button", "opt");
        envBtn.type = "button";
        envBtn.appendChild(App.el("span", "opt__name", "Cambiar entorno"));
        envBtn.appendChild(App.el("span", "opt__meta", "Mismo objetivo, distinto sitio: " + ENTORNOS.join(" · ") + "."));
        envBtn.addEventListener("click", function () { App.closeSheet(); openEnvPickerSheet(session, data); });
        body.appendChild(envBtn);

        var recoveryBtn = App.el("button", "opt");
        recoveryBtn.type = "button";
        recoveryBtn.appendChild(App.el("span", "opt__name", "Cambiar por recuperación"));
        recoveryBtn.appendChild(App.el("span", "opt__meta", "Cambia el objetivo a continua suave, sin tramos."));
        recoveryBtn.addEventListener("click", function () {
          App.closeSheet();
          session.nombre = "Recuperación activa";
          session.objetivo = "continua-suave";
          session.repeticionesExtra = 0;
          session.duracionPrevista = 20;
          session.intense = false;
          markAdjusted(session);
          App.toast("Cambiada por una sesión de recuperación.");
          App.navigate("endurance", { sessionId: session.id }, { replace: true });
        });
        body.appendChild(recoveryBtn);

        var moveBtn = App.el("button", "opt");
        moveBtn.type = "button";
        moveBtn.appendChild(App.el("span", "opt__name", "Mover a otro día"));
        moveBtn.appendChild(App.el("span", "opt__meta", "Abre el plan para elegir el día destino."));
        moveBtn.addEventListener("click", function () { App.closeSheet(); App.navigate("plan"); });
        body.appendChild(moveBtn);

        var keepBtn = App.el("button", "btn btn--ghost btn--block", "Mantener sesión prevista");
        keepBtn.type = "button";
        keepBtn.addEventListener("click", function () {
          App.closeSheet();
          App.toast("Mantienes la sesión prevista.");
        });
        body.appendChild(keepBtn);
      }
    });
  }

  function markAdjusted(session) {
    session.esAdaptada = true;
    session.procedencia = "adaptado";
    session.sync = "local";
  }

  function openEnvPickerSheet(session, data) {
    App.openSheet({
      title: "Cambiar entorno",
      render: function (body) {
        body.appendChild(App.el("p", "lede small", "El objetivo se mantiene; solo cambia dónde la haces."));
        ENTORNOS.forEach(function (env) {
          var btn = App.el("button", "opt");
          btn.type = "button";
          btn.appendChild(App.el("span", "opt__name", env));
          btn.addEventListener("click", function () {
            App.closeSheet();
            session.entorno = env;
            markAdjusted(session);
            App.toast("Entorno cambiado a " + env + ".");
            App.navigate("endurance", { sessionId: session.id }, { replace: true });
          });
          body.appendChild(btn);
        });
      }
    });
  }

  App.registerView("endurance", { title: "Resistencia", render: render });
})();
