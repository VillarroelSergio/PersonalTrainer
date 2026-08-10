/* =====================================================================
 * Vista: Recuperación (LOTE 3)
 * Nota 17. Movilidad suave, cardio suave o descanso, sin lenguaje de
 * fracaso. Se llega desde el check-in o por decisión manual desde Inicio.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  function freshState() {
    return { stage: "choose", kind: null, running: false, esfuerzo: null };
  }

  function render(mount) {
    var ctx = App.viewContext("recovery");
    if (!ctx.state) ctx.state = freshState();
    var data = App.data;

    if (ctx.state.stage === "detail") drawDetail(mount, data, ctx);
    else drawChoose(mount, data, ctx);
  }

  function drawChoose(mount, data, ctx) {
    var s = ctx.state;
    var wrap = App.el("section", "view-recovery");
    wrap.appendChild(App.el("p", "kicker", "Alternativa de hoy"));
    wrap.appendChild(App.el("h1", "view-title", "Recuperación"));
    wrap.appendChild(App.el("p", "lede small",
      "No es un fallo: es una forma distinta de sumar hoy. Elige lo que mejor encaje con cómo llegas."));

    // ---- prioridad-hibrida-006: resumen de bienestar general (3 estados),
    // nunca diagnóstico, basado solo en HISTORY/check-ins ya registrados.
    var readiness = data.readinessSummary();
    wrap.appendChild(App.el("p", "notice notice--info", readiness.texto));

    var group = App.el("div", "optgroup");

    // Alternativas dependientes del entorno declarado (nota 17 ampliada):
    // movilidad siempre disponible (vale en casa o donde sea), caminata si
    // hay exterior, cinta si el entorno incluye cinta/bici estática (típico
    // día de lluvia), cardio suave siempre como comodín, descanso siempre al
    // final. ---- onboarding-guiado-010: ENTORNOS_ONBOARDING ya no tiene
    // "Parque" (fusionado en "Exterior") ni "Cinta" a secas (ahora
    // "Cinta/bici estática").
    var envs = (data.user && data.user.entornos) || [];
    var keys = ["movilidad"];
    if (envs.indexOf("Exterior") > -1) keys.push("caminata");
    if (envs.indexOf("Cinta/bici estática") > -1) keys.push("cinta");
    keys.push("cardio");

    keys.forEach(function (key) {
      var block = data.RECOVERY_BLOCKS[key];
      if (!block) return;
      group.appendChild(buildOption(block.nombre, block.duracion + " · " + block.esfuerzoEsperado, function () {
        s.kind = key; s.stage = "detail"; s.running = false;
        redraw();
      }));
    });

    group.appendChild(buildOption("Descanso", "Registra la decisión, sin cargar nada más hoy.", function () {
      openRestConfirm(data, mount, ctx);
    }));

    wrap.appendChild(group);

    var planBtn = App.el("button", "btn btn--ghost btn--block", "Volver al plan para recolocar la sesión prevista");
    planBtn.type = "button";
    planBtn.addEventListener("click", function () { App.navigate("plan"); });
    wrap.appendChild(planBtn);

    mount.appendChild(wrap);

    function redraw() { App.navigate("recovery", {}, { replace: true }); }
  }

  function buildOption(title, meta, onClick) {
    var btn = App.el("button", "opt");
    btn.type = "button";
    btn.appendChild(App.el("span", "opt__name", title));
    btn.appendChild(App.el("span", "opt__meta", meta));
    btn.addEventListener("click", onClick);
    return btn;
  }

  function openRestConfirm(data, mount, ctx) {
    App.confirmSheet({
      title: "Registrar descanso",
      body: "Se anota que hoy elegiste descansar. Tu día se actualiza sin penalización; el descanso no cuenta como una sesión completada.",
      confirmLabel: "Registrar descanso",
      cancelLabel: "Cancelar",
      onConfirm: function () {
        App.toast("Descanso registrado. Tu día se actualiza sin penalización.");
        ctx.state = freshState();
        App.navigate("home", {}, { replace: true });
      }
    });
  }

  function drawDetail(mount, data, ctx) {
    var s = ctx.state;
    var block = data.RECOVERY_BLOCKS[s.kind];

    var wrap = App.el("section", "view-recovery");
    var backBtn = App.el("button", "back-btn", "←");
    backBtn.type = "button";
    backBtn.setAttribute("aria-label", "Volver a las opciones de recuperación");
    backBtn.addEventListener("click", function () { s.stage = "choose"; App.navigate("recovery", {}, { replace: true }); });
    var header = App.el("div", "view-header");
    header.appendChild(backBtn);
    var headerBody = document.createElement("div");
    headerBody.appendChild(App.el("p", "kicker", block.duracion + " · " + block.esfuerzoEsperado));
    headerBody.appendChild(App.el("h1", "view-title", block.nombre));
    header.appendChild(headerBody);
    wrap.appendChild(header);

    wrap.appendChild(App.el("p", "field__label", "Guía"));
    var cues = App.el("ul", "cues");
    block.guia.forEach(function (c) { cues.appendChild(App.el("li", null, c)); });
    wrap.appendChild(cues);

    if (!s.running) {
      var startBtn = App.el("button", "btn btn--primary btn--block", "Iniciar");
      startBtn.type = "button";
      startBtn.addEventListener("click", function () {
        s.running = true;
        App.toast(block.nombre + " iniciada.");
        App.navigate("recovery", {}, { replace: true });
      });
      wrap.appendChild(startBtn);
    } else {
      wrap.appendChild(App.el("p", "notice notice--info", "En marcha. Cuando termines, cierra para registrar el bloque."));

      wrap.appendChild(App.el("p", "field__label", "Esfuerzo global (opcional)"));
      var group = App.el("div", "picker");
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", "Esfuerzo global");
      ["Muy bajo", "Bajo", "Moderado"].forEach(function (opt) {
        var b = App.el("button", "picker__btn", opt);
        b.type = "button";
        b.setAttribute("aria-pressed", String(s.esfuerzo === opt));
        b.addEventListener("click", function () {
          s.esfuerzo = s.esfuerzo === opt ? null : opt;
          App.navigate("recovery", {}, { replace: true });
        });
        group.appendChild(b);
      });
      wrap.appendChild(group);

      var closeBtn = App.el("button", "btn btn--primary btn--block", "Cerrar recuperación");
      closeBtn.type = "button";
      closeBtn.addEventListener("click", function () {
        var minutos = s.kind === "movilidad" ? 12 : 18;
        data.completeRecovery(s.kind, { minutos: minutos, esfuerzo: s.esfuerzo });
        App.persist();
        App.toast(block.nombre + " registrada. Tu día se actualiza sin penalización.");
        ctx.state = freshState();
        App.navigate("home", {}, { replace: true });
      });
      wrap.appendChild(closeBtn);
    }

    mount.appendChild(wrap);
  }

  App.registerView("recovery", { title: "Recuperación", render: render });
})();
