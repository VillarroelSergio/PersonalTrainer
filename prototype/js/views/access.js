/* =====================================================================
 * Vista: Acceso y onboarding (LOTE 1)
 * Simulado por completo: sin autenticación real, sin red.
 * Pasos internos (no usan App.navigate, viven dentro de la misma vista para
 * conservar lo escrito): auth -> recover | privacy -> profile -> salida.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  // Cuenta de demostración: es la única combinación que "inicia sesión" con
  // éxito. Cualquier otra combinación en modo "iniciar sesión" simula un
  // error de credenciales. ponytail: credenciales fijas, no hay backend.
  var DEMO_EMAIL = "demo@trainer.app";
  var DEMO_PASSWORD = "demo1234";

  // ---- prioridad-hibrida-006: onboarding mínimo (deporte → objetivo →
  // días+duración → entornos). Se quita el paso de "experiencia" (queda un
  // campo interno con valor por defecto, ver App.dataDefaults) y se sustituye
  // el entorno único por multi-selección de 6 entornos. Constantes de deporte
  // y entorno viven en data.js (DEPORTES/ENTORNOS_ONBOARDING) para no
  // duplicarlas con plan-builder.js.
  var OBJETIVOS = ["Ganar músculo", "Perder grasa", "Mejorar resistencia", "Mantener forma", "Rendimiento combinado"];
  var DIAS_OPCIONES = ["3", "4", "5", "6"];
  var DURACIONES = ["20 min", "40 min", "60 min", "90+ min"];

  var PROFILE_STEPS = [
    { key: "deporte", label: "Tu deporte principal" },
    { key: "objetivo", label: "Objetivo" },
    { key: "diasDuracion", label: "Días y duración" },
    { key: "entornos", label: "Entornos habituales" }
  ];

  function freshFormState() {
    return {
      step: "auth",              // auth | recover | privacy | profile | summary
      mode: "login",             // login | request (solicitar acceso, no crea cuenta)
      email: "", password: "",
      emailError: null, passwordError: null, authError: null,
      recoverEmail: "", recoverSent: false,
      profileIndex: 0,
      profile: { deporte: null, objetivo: null, diasDisponibles: null, duracionHabitual: null, entornos: [] },
      proposal: null
    };
  }

  function render(mount) {
    var ctx = App.viewContext("access");
    if (!ctx.form) ctx.form = freshFormState();
    renderStep(mount, ctx);
  }

  function renderStep(mount, ctx) {
    mount.innerHTML = "";
    if (ctx.form.step === "auth") renderAuth(mount, ctx);
    else if (ctx.form.step === "recover") renderRecover(mount, ctx);
    else if (ctx.form.step === "privacy") renderPrivacy(mount, ctx);
    else if (ctx.form.step === "profile") renderProfile(mount, ctx);
    else if (ctx.form.step === "summary") renderSummary(mount, ctx);
  }

  /* ---- Paso 1: crear cuenta / iniciar sesión --------------------------- */

  function renderAuth(mount, ctx) {
    var form = ctx.form;

    var wrap = App.el("section", "access");
    wrap.appendChild(App.el("p", "kicker", "Tu camino"));
    var h1 = App.el("h1", "view-title", form.mode === "login" ? "Inicia sesión" : "Solicitar acceso (demo)");
    wrap.appendChild(h1);
    wrap.appendChild(App.el("p", "lede", "Prototipo: no hay servidor real. La cuenta " + DEMO_EMAIL + " con la contraseña " + DEMO_PASSWORD + " simula un acceso válido."));

    var modeSwitch = App.el("div", "modeswitch");
    modeSwitch.setAttribute("role", "group");
    modeSwitch.setAttribute("aria-label", "Modo de acceso");
    var loginBtn = App.el("button", "modeswitch__btn" + (form.mode === "login" ? " is-active" : ""), "Iniciar sesión");
    loginBtn.type = "button";
    loginBtn.setAttribute("aria-pressed", String(form.mode === "login"));
    loginBtn.addEventListener("click", function () { form.mode = "login"; form.authError = null; renderStep(mount, ctx); });
    var requestBtn = App.el("button", "modeswitch__btn" + (form.mode === "request" ? " is-active" : ""), "Solicitar acceso (demo)");
    requestBtn.type = "button";
    requestBtn.setAttribute("aria-pressed", String(form.mode === "request"));
    requestBtn.addEventListener("click", function () { form.mode = "request"; form.authError = null; renderStep(mount, ctx); });
    modeSwitch.appendChild(loginBtn);
    modeSwitch.appendChild(requestBtn);
    wrap.appendChild(modeSwitch);

    if (form.authError) {
      var err = App.el("p", "notice notice--warn", form.authError);
      err.setAttribute("role", "alert");
      wrap.appendChild(err);
    }

    // "Solicitar acceso (demo)" NO es un alta de cuenta: en el MVP las cuentas
    // se aprovisionan manualmente (MVP-DEFINITION.md §13) y este prototipo no
    // registra públicamente a nadie ni envía correos reales. Solo explica el
    // procedimiento real y ofrece las credenciales de demostración.
    if (form.mode === "request") {
      wrap.appendChild(App.el("p", "lede",
        "Las cuentas de esta app se crean manualmente por el equipo; no hay registro público ni un formulario de alta real aquí."));
      wrap.appendChild(App.el("p", "lede small",
        "Este prototipo no envía ninguna solicitud ni correo real. Para explorar la app, usa las credenciales de demostración disponibles:"));

      var demoBox = App.el("div", "notice notice--info");
      demoBox.appendChild(App.el("p", "lede small", "Correo: " + DEMO_EMAIL));
      demoBox.appendChild(App.el("p", "lede small", "Contraseña: " + DEMO_PASSWORD));
      wrap.appendChild(demoBox);

      var useDemo = App.el("button", "btn btn--primary btn--block", "Usar credenciales de demostración");
      useDemo.type = "button";
      useDemo.addEventListener("click", function () {
        form.mode = "login";
        form.email = DEMO_EMAIL;
        form.password = DEMO_PASSWORD;
        form.emailError = null; form.passwordError = null; form.authError = null;
        renderStep(mount, ctx);
        App.toast("Credenciales de demostración rellenadas.");
      });
      wrap.appendChild(useDemo);

      mount.appendChild(wrap);
      return;
    }

    var formEl = document.createElement("form");
    formEl.noValidate = true;

    var emailField = buildField({
      id: "accessEmail", label: "Correo", type: "email",
      value: form.email, error: form.emailError,
      onInput: function (v) { form.email = v; }
    });
    formEl.appendChild(emailField);

    var passField = buildField({
      id: "accessPassword", label: "Contraseña", type: "password",
      value: form.password, error: form.passwordError,
      onInput: function (v) { form.password = v; }
    });
    formEl.appendChild(passField);

    var submit = App.el("button", "btn btn--primary btn--block", "Entrar");
    submit.type = "submit";
    formEl.appendChild(submit);

    var recoverBtn = App.el("button", "btn btn--quiet", "¿Olvidaste tu contraseña?");
    recoverBtn.type = "button";
    recoverBtn.addEventListener("click", function () { form.step = "recover"; renderStep(mount, ctx); });
    formEl.appendChild(recoverBtn);

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      validateAndSubmitAuth(mount, ctx);
    });

    wrap.appendChild(formEl);
    mount.appendChild(wrap);
  }

  function validateAndSubmitAuth(mount, ctx) {
    var form = ctx.form;
    form.emailError = null;
    form.passwordError = null;
    form.authError = null;

    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
    if (!form.email.trim()) form.emailError = "Escribe tu correo.";
    else if (!emailOk) form.emailError = "Ese correo no parece válido.";

    if (!form.password) form.passwordError = "Escribe tu contraseña.";
    else if (form.password.length < 4) form.passwordError = "La contraseña necesita al menos 4 caracteres.";

    if (form.emailError || form.passwordError) { renderStep(mount, ctx); return; }

    // Único camino de acceso: credenciales de demostración aprovisionadas
    // manualmente. No existe alta pública que pueda saltarse esta comprobación.
    if (form.email.trim().toLowerCase() !== DEMO_EMAIL || form.password !== DEMO_PASSWORD) {
      form.authError = "Correo o contraseña incorrectos. Vuelve a intentarlo o recupera tu contraseña.";
      renderStep(mount, ctx);
      return;
    }

    App.data.user.email = form.email.trim();
    form.step = "privacy";
    renderStep(mount, ctx);
  }

  /* ---- Recuperar contraseña (simulado) --------------------------------- */

  function renderRecover(mount, ctx) {
    var form = ctx.form;
    var wrap = App.el("section", "access");
    var back = App.el("button", "back-btn", "←");
    back.type = "button";
    back.setAttribute("aria-label", "Volver a acceso");
    back.addEventListener("click", function () { form.step = "auth"; form.recoverSent = false; renderStep(mount, ctx); });
    wrap.appendChild(back);

    wrap.appendChild(App.el("h1", "view-title", "Recuperar contraseña"));

    if (!form.recoverSent) {
      wrap.appendChild(App.el("p", "lede", "Introduce tu correo. Simulado: no se envía ningún correo real en este prototipo."));
      var formEl = document.createElement("form");
      formEl.noValidate = true;
      var field = buildField({
        id: "recoverEmail", label: "Correo", type: "email",
        value: form.recoverEmail, error: null,
        onInput: function (v) { form.recoverEmail = v; }
      });
      formEl.appendChild(field);
      var submit = App.el("button", "btn btn--primary btn--block", "Enviar enlace (simulado)");
      submit.type = "submit";
      formEl.appendChild(submit);
      formEl.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!form.recoverEmail.trim()) { App.toast("Escribe tu correo antes de continuar."); return; }
        form.recoverSent = true;
        renderStep(mount, ctx);
      });
      wrap.appendChild(formEl);
    } else {
      wrap.appendChild(App.el("p", "notice notice--info",
        "Si " + form.recoverEmail + " tiene una cuenta, te enviaríamos un correo con instrucciones (simulado)."));
      var backToAccess = App.el("button", "btn btn--primary btn--block", "Volver a acceso");
      backToAccess.type = "button";
      backToAccess.addEventListener("click", function () { form.step = "auth"; form.recoverSent = false; renderStep(mount, ctx); });
      wrap.appendChild(backToAccess);
    }

    mount.appendChild(wrap);
  }

  /* ---- Privacidad y consentimiento -------------------------------------- */

  function renderPrivacy(mount, ctx) {
    var form = ctx.form;
    var wrap = App.el("section", "access");
    wrap.appendChild(App.el("p", "kicker", "Antes de empezar"));
    wrap.appendChild(App.el("h1", "view-title", "Privacidad y consentimiento"));
    wrap.appendChild(App.el("p", "lede",
      "En este prototipo, tu plan, tus series y tu check-in se guardan en este dispositivo. Si hubiera cuenta real, también se sincronizarían con el servidor para que puedas recuperarlos en otro dispositivo."));

    var detailBtn = App.el("button", "btn btn--quiet", "Ver detalle de qué se guarda");
    detailBtn.type = "button";
    detailBtn.addEventListener("click", function () {
      App.openSheet({
        title: "Qué se guarda y qué se sincronizaría",
        render: function (body) {
          body.appendChild(App.el("p", "lede small", "En este dispositivo (local): tu perfil, tu plan activo, tus sesiones registradas y tu estado de check-in."));
          body.appendChild(App.el("p", "lede small", "Se sincronizaría (simulado, sin red real aquí): lo mismo, para que puedas recuperarlo si cambias de dispositivo."));
          body.appendChild(App.el("p", "lede small", "No se comparte con terceros ni se usa con fines distintos a mostrarte tu propio entrenamiento."));
        }
      });
    });
    wrap.appendChild(detailBtn);

    var formEl = document.createElement("form");
    formEl.noValidate = true;

    var label = document.createElement("label");
    label.className = "checkrow";
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "consentCheck";
    checkbox.checked = !!ctx.consentAccepted;
    checkbox.addEventListener("change", function () { ctx.consentAccepted = checkbox.checked; });
    label.appendChild(checkbox);
    label.appendChild(App.el("span", null, "Acepto que se guarden estos datos en el dispositivo y, si hubiera cuenta real, se sincronicen para mi propio uso."));
    formEl.appendChild(label);

    var submit = App.el("button", "btn btn--primary btn--block", "Continuar");
    submit.type = "submit";
    formEl.appendChild(submit);

    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!ctx.consentAccepted) { App.toast("Acepta el uso de datos para continuar."); return; }
      App.data.user.consentimiento = { aceptado: true, fecha: "8 de agosto de 2026" };
      form.step = "profile";
      form.profileIndex = 0;
      renderStep(mount, ctx);
    });

    wrap.appendChild(formEl);
    mount.appendChild(wrap);
  }

  /* ---- Perfil inicial (selectores rápidos, sin RPE ni máquinas) --------- */

  function renderProfile(mount, ctx) {
    var form = ctx.form;
    var stepDef = PROFILE_STEPS[form.profileIndex];
    var total = PROFILE_STEPS.length;

    var wrap = App.el("section", "access");

    var header = App.el("div", "view-header");
    var back = App.el("button", "back-btn", "←");
    back.type = "button";
    back.setAttribute("aria-label", "Volver");
    back.addEventListener("click", function () {
      if (form.profileIndex === 0) { form.step = "privacy"; }
      else { form.profileIndex--; }
      renderStep(mount, ctx);
    });
    header.appendChild(back);
    var headBody = document.createElement("div");
    headBody.appendChild(App.el("p", "kicker", "Perfil inicial · paso " + (form.profileIndex + 1) + " de " + total));
    headBody.appendChild(App.el("h1", "view-title", stepDef.label));
    header.appendChild(headBody);
    wrap.appendChild(header);

    var progress = App.el("div", "blockprog");
    var track = App.el("div", "blockprog__track");
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", "Paso " + (form.profileIndex + 1) + " de " + total);
    var fill = App.el("div", "blockprog__fill");
    fill.style.width = Math.round(((form.profileIndex + 1) / total) * 100) + "%";
    track.appendChild(fill);
    progress.appendChild(track);
    wrap.appendChild(progress);

    wrap.appendChild(App.el("p", "lede small", "Nada de peso, FC, zonas, ritmo, desnivel ni inventario de máquinas: solo lo esencial para proponerte una primera semana."));

    var enabled;
    if (stepDef.key === "deporte") {
      enabled = buildSinglePicker(wrap, mount, ctx, App.data.DEPORTES, form.profile.deporte, "Deporte principal", function (opt) { form.profile.deporte = opt; });
    } else if (stepDef.key === "objetivo") {
      enabled = buildSinglePicker(wrap, mount, ctx, OBJETIVOS, form.profile.objetivo, "Objetivo", function (opt) { form.profile.objetivo = opt; });
    } else if (stepDef.key === "diasDuracion") {
      wrap.appendChild(App.el("p", "field__label", "Días disponibles por semana"));
      buildSinglePicker(wrap, mount, ctx, DIAS_OPCIONES, form.profile.diasDisponibles, "Días disponibles", function (opt) { form.profile.diasDisponibles = opt; });
      wrap.appendChild(App.el("p", "field__label", "Duración habitual de sesión"));
      buildSinglePicker(wrap, mount, ctx, DURACIONES, form.profile.duracionHabitual, "Duración habitual", function (opt) { form.profile.duracionHabitual = opt; });
      enabled = !!(form.profile.diasDisponibles && form.profile.duracionHabitual);
    } else if (stepDef.key === "entornos") {
      wrap.appendChild(App.el("p", "lede small", "Elige uno o varios. Solo para priorizar alternativas compatibles, no un inventario exacto."));
      enabled = buildMultiPicker(wrap, mount, ctx, App.data.ENTORNOS_ONBOARDING, form.profile.entornos, "Entornos habituales");
    }

    var nextBtn = App.el("button", "btn btn--primary btn--block",
      form.profileIndex === total - 1 ? "Ver mi semana propuesta" : "Siguiente");
    nextBtn.type = "button";
    nextBtn.addEventListener("click", function () {
      if (!enabled) { App.toast("Elige una opción para continuar."); return; }
      if (form.profileIndex < total - 1) {
        form.profileIndex++;
        renderStep(mount, ctx);
      } else {
        buildOnboardingProposal(ctx);
        form.step = "summary";
        renderStep(mount, ctx);
      }
    });
    wrap.appendChild(nextBtn);

    mount.appendChild(wrap);
  }

  function buildSinglePicker(wrap, mount, ctx, options, current, ariaLabel, onSelect) {
    var picker = App.el("div", "picker picker--wide");
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", ariaLabel);
    options.forEach(function (opt) {
      var btn = App.el("button", "picker__btn", opt);
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(current === opt));
      btn.addEventListener("click", function () { onSelect(opt); renderStep(mount, ctx); });
      picker.appendChild(btn);
    });
    wrap.appendChild(picker);
    return !!current;
  }

  // Multi-selección real (toggle): a diferencia de buildSinglePicker, cada
  // botón conmuta su propia presencia en el array `selected` sin recomponer
  // el resto de opciones elegidas.
  function buildMultiPicker(wrap, mount, ctx, options, selected, ariaLabel) {
    var picker = App.el("div", "picker picker--wide");
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", ariaLabel);
    options.forEach(function (opt) {
      var btn = App.el("button", "picker__btn", opt);
      btn.type = "button";
      var pressed = selected.indexOf(opt) > -1;
      btn.setAttribute("aria-pressed", String(pressed));
      btn.addEventListener("click", function () {
        var idx = selected.indexOf(opt);
        if (idx > -1) selected.splice(idx, 1); else selected.push(opt);
        renderStep(mount, ctx);
      });
      picker.appendChild(btn);
    });
    wrap.appendChild(picker);
    return selected.length > 0;
  }

  /* ---- Resumen visual: cómo se formó la semana propuesta ---------------- */

  // Genera la propuesta con el MISMO generador que usa el creador guiado
  // (data.generatePlanWeek): no se reimplementa nada. Si la combinación
  // elegida deja 0 días para fuerza (posible con Trail/Senderismo y pocos
  // días), se reintenta una vez con la frecuencia de resistencia sugerida en
  // vez de dejar el onboarding en un callejón sin salida.
  function buildOnboardingProposal(ctx) {
    var profile = ctx.form.profile;
    var map = App.data.DEPORTE_CARDIO_MAP[profile.deporte] || App.data.DEPORTE_CARDIO_MAP.Fuerza;
    var opts = {
      modo: "plantilla", plantilla: map.plantilla,
      diasDisponibles: profile.diasDisponibles, duracionHabitual: profile.duracionHabitual,
      cardioActividad: map.cardioActividad, cardioFrecuencia: map.cardioFrecuencia
    };
    var proposal = App.data.generatePlanWeek(opts);
    if (proposal.infeasible && proposal.suggestReduceFreq !== undefined) {
      opts.cardioFrecuencia = String(proposal.suggestReduceFreq);
      proposal = App.data.generatePlanWeek(opts);
      proposal.adjustedFreq = true;
    }
    ctx.form.proposal = proposal;
    ctx.form.proposalMeta = { plantilla: map.plantilla, cardioActividad: map.cardioActividad };
  }

  function renderSummary(mount, ctx) {
    var data = App.data;
    var form = ctx.form;
    var proposal = form.proposal;

    var wrap = App.el("section", "access");
    var header = App.el("div", "view-header");
    var back = App.el("button", "back-btn", "←");
    back.type = "button";
    back.setAttribute("aria-label", "Volver a entornos habituales");
    back.addEventListener("click", function () { form.step = "profile"; form.profileIndex = PROFILE_STEPS.length - 1; renderStep(mount, ctx); });
    header.appendChild(back);
    var headBody = document.createElement("div");
    headBody.appendChild(App.el("p", "kicker", "Tu semana, explicada"));
    headBody.appendChild(App.el("h1", "view-title", "Así formamos tu primera semana"));
    header.appendChild(headBody);
    wrap.appendChild(header);

    wrap.appendChild(App.el("p", "lede", proposal.explanation ||
      "No pudimos generar una propuesta con esta combinación. Vuelve atrás y ajusta tus días o tu deporte."));
    if (proposal.adjustedFreq) {
      wrap.appendChild(App.el("p", "notice notice--info",
        "Ajustamos automáticamente la frecuencia de resistencia para dejar sitio a tu sesión de fuerza. Podrás cambiarlo después desde el calendario."));
    }

    if (proposal.sessions && proposal.sessions.length) {
      var list = App.el("ol", "daylist");
      data.DAYS.forEach(function (day) {
        var session = null;
        proposal.sessions.forEach(function (s) { if (s.day === day.key) session = s; });
        var cls = "dayrow" + (session ? (session.tipo === "resistencia" ? " dayrow--cardio dayrow--planificada" : " dayrow--planificada") : " dayrow--descanso");
        var row = App.el("li", cls);
        var top = App.el("div", "dayrow__top");
        var body = document.createElement("div");
        body.appendChild(App.el("p", "dayrow__day", day.nombre));
        if (session) {
          body.appendChild(App.el("p", "dayrow__title", session.nombre));
          body.appendChild(App.el("p", "dayrow__meta", session.proposito + " · " + session.duracionPrevista + " min"));
        } else {
          body.appendChild(App.el("p", "dayrow__title", "Descanso"));
        }
        top.appendChild(body);
        row.appendChild(top);
        list.appendChild(row);
      });
      wrap.appendChild(list);
    }

    var confirmBtn = App.el("button", "btn btn--primary btn--block", "Confirmar y continuar");
    confirmBtn.type = "button";
    confirmBtn.disabled = !(proposal.sessions && proposal.sessions.length);
    confirmBtn.addEventListener("click", function () { finishOnboarding(ctx); });
    wrap.appendChild(confirmBtn);

    var editBtn = App.el("button", "btn btn--ghost btn--block", "Cambiar mis respuestas");
    editBtn.type = "button";
    editBtn.addEventListener("click", function () { form.step = "profile"; form.profileIndex = 0; renderStep(mount, ctx); });
    wrap.appendChild(editBtn);

    mount.appendChild(wrap);
  }

  function finishOnboarding(ctx) {
    var profile = ctx.form.profile;
    var proposal = ctx.form.proposal;
    var user = App.data.user;
    user.deporte = profile.deporte;
    user.objetivo = profile.objetivo;
    user.diasDisponibles = parseInt(profile.diasDisponibles, 10) || null;
    user.duracionHabitual = profile.duracionHabitual;
    user.entornos = profile.entornos.slice();
    user.entorno = profile.entornos[0] || null; // compat: creador guiado/Perfil siguen leyendo el singular

    if (proposal && proposal.sessions && proposal.sessions.length) {
      App.data.SESSIONS.length = 0;
      Array.prototype.push.apply(App.data.SESSIONS, proposal.sessions);
      App.data.plan.fases = App.data.buildFasesFromTemplate(1);
      App.data.plan.semanaActual = 1;
      App.data.lastAction = null;
    }

    App.data.auth.estado = "autenticado";
    App.data.auth.primerUso = false;
    App.persist();

    App.viewContext("access").form = freshFormState();

    if (App.data.plan && App.data.plan.estado === "activo") {
      App.navigate("home", {}, { replace: true });
      App.toast("Perfil completado. Bienvenido a tu camino.");
    } else {
      App.navigate("access", {}, { replace: true }); // no debería ocurrir con los datos de demo
    }
  }

  /* ---- Campo de formulario con error asociado por aria-describedby ------ */

  function buildField(opts) {
    var wrap = App.el("div", "field");
    var label = App.el("label", "field__label", opts.label);
    label.setAttribute("for", opts.id);
    wrap.appendChild(label);

    var input = document.createElement("input");
    input.type = opts.type || "text";
    input.id = opts.id;
    input.value = opts.value || "";
    input.autocomplete = opts.type === "password" ? "current-password" : "email";
    var errorId = opts.id + "Error";
    if (opts.error) {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", errorId);
    }
    input.addEventListener("input", function () { opts.onInput(input.value); });
    wrap.appendChild(input);

    if (opts.error) {
      var err = App.el("p", "field__error", opts.error);
      err.id = errorId;
      err.setAttribute("role", "alert");
      wrap.appendChild(err);
    }
    return wrap;
  }

  App.registerView("access", { title: "Acceso", chrome: "bare", render: render });
})();
