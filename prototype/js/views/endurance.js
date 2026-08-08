/* =====================================================================
 * Vista: Resistencia planificada y ejecución por segmentos (LOTE 5)
 * Notas 06, 21 y 29. Sigue el mismo patrón que strength.js: el estado de
 * ejecución vive en el propio objeto de sesión dentro de App.data
 * (session.segmentos, session.pausada), nunca en variables locales de la
 * vista, para que "Entrenar" recupere la sesión en curso al volver.
 * Sin GPS, sin mapa, sin cronómetro dependiente de sensores (nota 99):
 * los tramos se marcan a mano.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  var ESFUERZO_OPCIONES = ["Muy fácil", "Fácil", "Adecuado", "Duro", "Muy duro"];

  var SEGMENT_STATE_LABEL = {
    proximo: "Próximo",
    en_curso: "En curso",
    realizado: "Realizado ✓",
    ajustado: "Ajustado",
    omitido: "Omitido"
  };

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
      var importLink = App.el("button", "btn btn--ghost btn--block", "Importar actividad");
      importLink.type = "button";
      importLink.addEventListener("click", function () { App.navigate("import"); });
      wrap0.appendChild(importLink);
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

    if (session.estado === "planificada") {
      data.setSessionState(session.id, "en_curso");
    }

    drawSession(mount, data, session);
  }

  function resolveSession(data, params) {
    if (params && params.sessionId) {
      var s = data.findSession(params.sessionId);
      if (s) return s;
    }
    var enCurso = data.SESSIONS.filter(function (s) { return s.tipo === "resistencia" && s.estado === "en_curso"; })[0];
    if (enCurso) return enCurso;
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
    var segments = data.sessionSegments(session);

    var wrap = App.el("section", "view-endurance");
    wrap.appendChild(App.el("p", "kicker", "Resistencia · hoy" + (session.esAdaptada ? " · versión adaptada" : "")));
    wrap.appendChild(App.el("h1", "view-title", session.nombre));

    var badges = App.el("div", "badge-row");
    if (session.esAdaptada) badges.appendChild(App.el("span", "state state--adaptada", "Sesión adaptada"));
    if (session.pausada) badges.appendChild(App.el("span", "state state--parcial", "Pausada"));
    badges.appendChild(App.sync.badge(session.sync || "local"));
    wrap.appendChild(badges);

    var loadMsg = data.loadContext();
    if (loadMsg) wrap.appendChild(App.el("p", "notice notice--info", loadMsg));

    // ---- Briefing en lenguaje llano (nota 06) -------------------------------
    if (tmpl) {
      var brief = App.el("div", "endurance-brief");
      brief.appendChild(App.el("p", "endurance-brief__line", "Duración: " + tmpl.duracionTexto));
      brief.appendChild(App.el("p", "endurance-brief__line", "Intensidad: " + tmpl.intensidadTexto));
      brief.appendChild(App.el("p", "endurance-brief__line", "Estructura: " + tmpl.estructuraTexto));
      brief.appendChild(App.el("p", "endurance-brief__line", "Para qué sirve: " + tmpl.proposito));
      wrap.appendChild(brief);
    }

    // ---- Ajuste explicable (nota 06): choque de carga con día adyacente ----
    var conflict = data.findConflict(data.SESSIONS, session.day, session);
    if (conflict && !session.esAdaptada) {
      var adjustNotice = App.el("div", "notice notice--warn");
      adjustNotice.appendChild(App.el("p", null,
        session.nombre + " es una sesión intensa y está junto a " + conflict.nombre.toLowerCase() +
        " (piernas), lo que puede sumar fatiga. Puedes ajustarla o seguir tal como está: tú decides."));
      var altBtn = App.el("button", "btn btn--ghost btn--block", "Ver alternativa explicada");
      altBtn.type = "button";
      altBtn.addEventListener("click", function () { openAdjustProposalSheet(session, conflict, data, mount); });
      adjustNotice.appendChild(altBtn);
      wrap.appendChild(adjustNotice);
    }

    var objLink = App.el("button", "btn btn--quiet", "Ver los seis objetivos de resistencia");
    objLink.type = "button";
    objLink.addEventListener("click", function () { openObjectivesSheet(data); });
    wrap.appendChild(objLink);

    if (segments) {
      wrap.appendChild(buildSegmentList(segments, session, data, mount));
    } else {
      wrap.appendChild(buildContinuousBlock(session, tmpl));
    }

    var controls = App.el("div", "endurance-controls");
    var pauseBtn = App.el("button", "btn btn--ghost btn--block", session.pausada ? "Reanudar" : "Pausar");
    pauseBtn.type = "button";
    pauseBtn.addEventListener("click", function () {
      data.toggleEndurancePause(session);
      App.navigate("endurance", { sessionId: session.id }, { replace: true });
    });
    controls.appendChild(pauseBtn);

    var abandonBtn = App.el("button", "btn btn--ghost btn--block", "Abandonar guardando parcial");
    abandonBtn.type = "button";
    abandonBtn.addEventListener("click", function () { handleAbandon(session, data, mount); });
    controls.appendChild(abandonBtn);
    wrap.appendChild(controls);

    var finishBtn = App.el("button", "btn btn--primary btn--block", "Terminar sesión");
    finishBtn.type = "button";
    finishBtn.addEventListener("click", function () { handleFinishClick(session, data, mount); });
    wrap.appendChild(finishBtn);

    mount.appendChild(wrap);
  }

  function buildContinuousBlock(session, tmpl) {
    var block = App.el("div", "endurance-continuous");
    block.appendChild(App.el("p", "field__label", "Sesión continua: sin tramos"));
    block.appendChild(App.el("p", "lede", tmpl ? tmpl.intensidadTexto : "Mantén un ritmo constante y cómodo."));
    return block;
  }

  /* ---- Lista de tramos, con los cinco estados requeridos (nota 21) --------- */

  function buildSegmentList(segments, session, data, mount) {
    var host = App.el("div", "segment-list-host");
    var currentIdx = data.currentSegmentIndex(session);

    var list = App.el("ol", "segments");
    segments.forEach(function (seg, index) {
      list.appendChild(buildSegmentRow(seg, index, currentIdx, session, data, mount));
    });
    host.appendChild(list);
    return host;
  }

  function displayStateFor(seg, index, currentIdx) {
    if (seg.estado === "realizado" || seg.estado === "ajustado" || seg.estado === "omitido") return seg.estado;
    if (index === currentIdx) return "en_curso";
    return "proximo";
  }

  function buildSegmentRow(seg, index, currentIdx, session, data, mount) {
    var displayState = displayStateFor(seg, index, currentIdx);
    var li = App.el("li", "segment segment--" + displayState);

    var head = App.el("div", "segment__head");
    head.appendChild(App.el("span", "segment__name", seg.nombre));
    head.appendChild(App.el("span", "state state--" + stateClassFor(displayState), SEGMENT_STATE_LABEL[displayState]));
    li.appendChild(head);

    li.appendChild(App.el("p", "segment__meta", seg.duracionTexto + " · " + seg.objetivoTexto));

    if (displayState === "en_curso" && !session.pausada) {
      var actions = App.el("div", "segment__actions");
      var doneBtn = App.el("button", "btn btn--primary btn--sm", "Marcar tramo");
      doneBtn.type = "button";
      doneBtn.addEventListener("click", function () {
        data.markSegmentDone(session, index);
        App.toast(seg.nombre + " marcado como realizado.");
        App.navigate("endurance", { sessionId: session.id }, { replace: true });
      });
      actions.appendChild(doneBtn);

      var adjustBtn = App.el("button", "btn btn--ghost btn--sm", "Ajustar");
      adjustBtn.type = "button";
      adjustBtn.addEventListener("click", function () { openAdjustSegmentSheet(session, index, seg, data, mount); });
      actions.appendChild(adjustBtn);

      li.appendChild(actions);
    } else if (displayState === "en_curso" && session.pausada) {
      li.appendChild(App.el("p", "lede small", "Sesión en pausa: reanuda para marcar este tramo."));
    }

    return li;
  }

  function stateClassFor(displayState) {
    if (displayState === "realizado") return "completada";
    if (displayState === "ajustado") return "adaptada";
    if (displayState === "omitido") return "omitida";
    if (displayState === "en_curso") return "en_curso";
    return "planificada";
  }

  /* ---- Ajustar un tramo: reducir, repetir, pasar a recuperación u omitir --- */

  function openAdjustSegmentSheet(session, index, seg, data, mount) {
    App.openSheet({
      title: "Ajustar " + seg.nombre,
      render: function (body) {
        body.appendChild(App.el("p", "lede small", "Elige qué hacer con este tramo. Pide confirmación antes de aplicarse."));

        var options = [
          { key: "reducir", label: "Reducir el tramo", desc: "Se acorta y se cuenta como ajustado." },
          { key: "repetir", label: "Repetir el tramo", desc: "Se añade una repetición extra a continuación." },
          { key: "recuperacion", label: "Pasar a recuperación", desc: "Este tramo se convierte en recuperación suave." },
          { key: "omitir", label: "Omitir el tramo", desc: "Se marca como omitido y se pasa al siguiente." }
        ];
        options.forEach(function (opt) {
          var btn = App.el("button", "opt");
          btn.type = "button";
          btn.appendChild(App.el("span", "opt__name", opt.label));
          btn.appendChild(App.el("span", "opt__meta", opt.desc));
          btn.addEventListener("click", function () {
            App.closeSheet();
            App.confirmSheet({
              title: "Confirmar: " + opt.label.toLowerCase(),
              body: opt.desc,
              confirmLabel: "Confirmar",
              cancelLabel: "Cancelar",
              onConfirm: function () {
                data.adjustSegment(session, index, opt.key);
                App.toast(seg.nombre + ": " + opt.label.toLowerCase() + ".");
                App.navigate("endurance", { sessionId: session.id }, { replace: true });
              }
            });
          });
          body.appendChild(btn);
        });
      }
    });
  }

  /* ---- Ajuste explicable por choque de carga (nota 06) ---------------------- */

  function openAdjustProposalSheet(session, conflict, data, mount) {
    App.openSheet({
      title: "Alternativa explicada",
      render: function (body) {
        body.appendChild(App.el("p", "notice notice--warn",
          session.nombre + " junto a " + conflict.nombre.toLowerCase() + " puede sumar fatiga a una de las dos sesiones."));

        var reduceBtn = App.el("button", "opt");
        reduceBtn.type = "button";
        reduceBtn.appendChild(App.el("span", "opt__name", "Reducir a versión corta"));
        reduceBtn.appendChild(App.el("span", "opt__meta", "Baja la duración prevista, mismo objetivo."));
        reduceBtn.addEventListener("click", function () {
          App.closeSheet();
          session.duracionPrevista = Math.max(10, Math.round(session.duracionPrevista * 0.6));
          session.esAdaptada = true;
          session.procedencia = "adaptado";
          session.sync = "local";
          App.toast("Versión corta aplicada: " + session.duracionPrevista + " min.");
          App.navigate("endurance", { sessionId: session.id }, { replace: true });
        });
        body.appendChild(reduceBtn);

        var recoveryBtn = App.el("button", "opt");
        recoveryBtn.type = "button";
        recoveryBtn.appendChild(App.el("span", "opt__name", "Cambiar por recuperación"));
        recoveryBtn.appendChild(App.el("span", "opt__meta", "Cambia el objetivo a continua suave, sin tramos."));
        recoveryBtn.addEventListener("click", function () {
          App.closeSheet();
          session.nombre = "Recuperación activa";
          session.objetivo = "continua-suave";
          session.segmentos = null;
          session.duracionPrevista = 20;
          session.intense = false;
          session.esAdaptada = true;
          session.procedencia = "adaptado";
          session.sync = "local";
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

  /* ---- Abandonar guardando parcial ------------------------------------------ */

  function handleAbandon(session, data, mount) {
    App.confirmSheet({
      title: "Abandonar y guardar parcial",
      body: "Los tramos que no hayas realizado quedarán marcados como omitidos. La sesión se guardará como parcial.",
      confirmLabel: "Abandonar y guardar",
      cancelLabel: "Seguir en la sesión",
      onConfirm: function () {
        data.abandonEnduranceSession(session);
        var result = data.closeEnduranceSession(session, { completa: false });
        App.persist();
        App.toast("Sesión guardada como parcial: " + result.minutos + " min.");
        App.navigate("home", {}, { replace: true });
      }
    });
  }

  /* ---- Cierre: completada, adaptada o parcial (nota 21/29) ------------------ */

  function handleFinishClick(session, data, mount) {
    var segments = session.segmentos;
    if (segments && segments.some(function (s) { return s.estado === "pendiente"; })) {
      App.openSheet({
        title: "Aún quedan tramos",
        render: function (body) {
          var pendientes = segments.filter(function (s) { return s.estado === "pendiente"; }).length;
          body.appendChild(App.el("p", "lede",
            "Quedan " + pendientes + " tramos sin marcar. Si guardas ahora se registrará como sesión parcial."));
          var keep = App.el("button", "btn btn--primary btn--block", "Seguir en la sesión");
          keep.type = "button";
          keep.addEventListener("click", function () { App.closeSheet(); });
          body.appendChild(keep);
          var partial = App.el("button", "btn btn--ghost btn--block", "Guardar como parcial");
          partial.type = "button";
          partial.addEventListener("click", function () {
            App.closeSheet();
            data.abandonEnduranceSession(session);
            openCloseSheet(session, data, false);
          });
          body.appendChild(partial);
        }
      });
      return;
    }
    openCloseSheet(session, data, true);
  }

  function openCloseSheet(session, data, completa) {
    var esfuerzo = null;

    App.openSheet({
      title: completa ? "Terminar sesión" : "Guardar como parcial",
      render: function (body) {
        var summary = App.el("div", "closesummary" + (completa ? "" : " closesummary--partial"));
        summary.appendChild(App.el("p", "closesummary__head", completa ? "Sesión completada" : "Se guardará como parcial"));
        summary.appendChild(App.el("p", "closesummary__meta", session.nombre + (session.esAdaptada ? " · versión adaptada" : "")));
        body.appendChild(summary);

        body.appendChild(App.el("p", "field__label", "Esfuerzo global (opcional)"));
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

        var saveBtn = App.el("button", "btn btn--primary btn--block", "Guardar sesión");
        saveBtn.type = "button";
        saveBtn.addEventListener("click", function () {
          App.closeSheet();
          var result = data.closeEnduranceSession(session, { completa: completa, esfuerzo: esfuerzo });
          App.persist();
          App.toast(completa
            ? "Sesión guardada como " + (result.estado === "adaptada" ? "adaptada" : "completada") + "."
            : "Sesión guardada como parcial: " + result.minutos + " min.");
          App.navigate("home", {}, { replace: true });
        });
        body.appendChild(saveBtn);
      }
    });
  }

  App.registerView("endurance", { title: "Resistencia", render: render });
})();
