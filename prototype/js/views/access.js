/* =====================================================================
 * Vista: Acceso y onboarding (onboarding-guiado-010)
 * Simulado por completo: sin autenticación real, sin red.
 * Pasos internos (no usan App.navigate, viven dentro de la misma vista para
 * conservar lo escrito): auth -> recover | privacy -> onboarding ->
 * transition | (a otra vista) -> proposal.
 *
 * Onboarding guiado (reemplaza el flujo breve de 4 pasos de
 * prioridad-hibrida-006): modo, objetivos (multi-selección), experiencia,
 * fecha de nacimiento, altura y peso (tres pantallas de rueda, corrección
 * posterior a la versión inicial de un solo paso "físico" con campos de
 * texto), días de fuerza, actividades exteriores, duración, entornos,
 * equipamiento por entorno (N sub-pasos) y foco muscular opcional. Las
 * constantes de cada paso viven en data.js (OBJETIVOS_ONBOARDING,
 * EXPERIENCIAS_ONBOARDING, DIAS_FUERZA_ONBOARDING,
 * ACTIVIDADES_EXTERIORES_ONBOARDING, DURACIONES_SESION, ENTORNOS_ONBOARDING,
 * EQUIPAMIENTO_POR_ENTORNO) para poder reutilizarlas desde Perfil sin
 * duplicarlas.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  // Cuenta de demostración: es la única combinación que "inicia sesión" con
  // éxito. Cualquier otra combinación en modo "iniciar sesión" simula un
  // error de credenciales. ponytail: credenciales fijas, no hay backend.
  var DEMO_EMAIL = "demo@trainer.app";
  var DEMO_PASSWORD = "demo1234";

  // ---- onboarding-guiado-010: 9 grupos musculares con ilustración real,
  // copiados (no importados) de GROUP_DEFS en library.js sin sus funciones
  // `match` (esas son específicas del catálogo de ejercicios y no aplican
  // aquí). No se toca library.js.
  var MUSCLE_GROUPS_ONBOARDING = [
    { key: "pecho", label: "Pecho", image: "pecho-card-v1.webp" },
    { key: "espalda", label: "Espalda", image: "espalda-card-v1.webp" },
    { key: "hombros", label: "Hombros", image: "hombros-card-v1.webp" },
    { key: "biceps", label: "Bíceps", image: "biceps-card-v1.webp" },
    { key: "triceps", label: "Tríceps", image: "triceps-card-v1.webp" },
    { key: "cuadriceps", label: "Cuádriceps", image: "cuadriceps-card-v1.webp" },
    { key: "isquios-gluteos", label: "Isquios y glúteos", image: "isquios-gluteos-card-v1.webp" },
    { key: "gemelos", label: "Gemelos", image: "gemelos-card-v1.webp" },
    { key: "core", label: "Core", image: "core-card-v1.webp" }
  ];

  var STEP_TITLES = {
    modo: "¿Cómo quieres empezar?",
    objetivo: "Tus objetivos",
    experiencia: "Tu experiencia",
    nacimiento: "¿Cuál es tu fecha de nacimiento?",
    altura: "¿Cuánto mides?",
    peso: "¿Cuánto pesas?",
    diasFuerza: "Días disponibles para fuerza",
    actividadesExteriores: "Actividades exteriores",
    duracion: "Duración habitual por sesión",
    entornos: "Entornos habituales",
    foco: "Foco muscular (opcional)"
  };

  var MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function range(a, b) {
    var out = [];
    for (var i = a; i <= b; i++) out.push(i);
    return out;
  }

  function freshFormState() {
    return {
      step: "auth",              // auth | recover | privacy | onboarding | transition | proposal
      mode: "login",             // login | request (solicitar acceso, no crea cuenta)
      email: "", password: "",
      emailError: null, passwordError: null, authError: null,
      recoverEmail: "", recoverSent: false,

      onbStepIndex: 0,
      modoOnboarding: null,       // "guiada" | "propia"
      goals: [],                  // orden = orden de selección; goals[0] = prioridad
      experiencia: null,
      birthDate: { day: null, month: null, year: null },
      alturaCm: null,
      pesoKg: null,
      diasFuerza: null,
      actividadesExteriores: [],  // [{ actividad, frecuencia }]
      duracionHabitual: null,
      entornos: [],
      equipoPorEntorno: {},       // { "<entorno>": [...] }
      focoMuscular: [],

      proposal: null,
      proposalMeta: null
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
    else if (ctx.form.step === "onboarding") renderOnboarding(mount, ctx);
    else if (ctx.form.step === "transition") renderTransition(mount, ctx);
    else if (ctx.form.step === "proposal") renderProposal(mount, ctx);
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
      form.step = "onboarding";
      form.onbStepIndex = 0;
      renderStep(mount, ctx);
    });

    wrap.appendChild(formEl);
    mount.appendChild(wrap);
  }

  /* ---- Onboarding guiado: 10 decisiones (más equipamiento por entorno) --- */

  // Lista ordenada de claves de paso, recalculada en cada render a partir de
  // los entornos ya elegidos (paso 8): un sub-paso "equipo:<entorno>" por
  // cada entorno, en el orden en que se eligieron.
  function stepList(form) {
    var list = ["modo", "objetivo", "experiencia", "nacimiento", "altura", "peso", "diasFuerza", "actividadesExteriores", "duracion", "entornos"];
    form.entornos.forEach(function (env) { list.push("equipo:" + env); });
    list.push("foco");
    return list;
  }

  function titleFor(key) {
    if (key.indexOf("equipo:") === 0) return "Equipamiento · " + key.slice(7);
    return STEP_TITLES[key] || "";
  }

  function renderOnboarding(mount, ctx) {
    var form = ctx.form;
    var list = stepList(form);
    if (form.onbStepIndex >= list.length) form.onbStepIndex = list.length - 1;
    var key = list[form.onbStepIndex];
    var total = list.length;

    var wrap = App.el("section", "access");

    var header = App.el("div", "view-header");
    var back = App.el("button", "back-btn", "←");
    back.type = "button";
    back.setAttribute("aria-label", "Volver");
    back.addEventListener("click", function () {
      if (form.onbStepIndex === 0) { form.step = "privacy"; }
      else { form.onbStepIndex--; }
      renderStep(mount, ctx);
    });
    header.appendChild(back);
    var headBody = document.createElement("div");
    headBody.appendChild(App.el("p", "kicker", "Antes de tu primer plan · paso " + (form.onbStepIndex + 1) + " de " + total));
    headBody.appendChild(App.el("h1", "view-title", titleFor(key)));
    header.appendChild(headBody);
    wrap.appendChild(header);

    var progress = App.el("div", "blockprog");
    var track = App.el("div", "blockprog__track");
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", "Paso " + (form.onbStepIndex + 1) + " de " + total);
    var fill = App.el("div", "blockprog__fill");
    fill.style.width = Math.round(((form.onbStepIndex + 1) / total) * 100) + "%";
    track.appendChild(fill);
    progress.appendChild(track);
    wrap.appendChild(progress);

    var enabled = false;
    if (key === "modo") {
      var modoCurrent = form.modoOnboarding === "guiada" ? "Quiero una propuesta de plan" :
        form.modoOnboarding === "propia" ? "Quiero crear mi propia rutina" : null;
      enabled = buildSinglePicker(wrap, mount, ctx,
        ["Quiero una propuesta de plan", "Quiero crear mi propia rutina"], modoCurrent, "Cómo quieres empezar",
        function (opt) { form.modoOnboarding = opt === "Quiero una propuesta de plan" ? "guiada" : "propia"; });
    } else if (key === "objetivo") {
      wrap.appendChild(App.el("p", "lede small", "Puedes elegir varios. El primero marcará la prioridad inicial del plan."));
      enabled = renderObjetivos(wrap, mount, ctx);
    } else if (key === "experiencia") {
      enabled = buildSinglePicker(wrap, mount, ctx, App.data.EXPERIENCIAS_ONBOARDING, form.experiencia, "Experiencia",
        function (opt) { form.experiencia = opt; });
    } else if (key === "nacimiento") {
      enabled = renderNacimiento(wrap, mount, ctx);
    } else if (key === "altura") {
      enabled = renderAltura(wrap, mount, ctx);
    } else if (key === "peso") {
      enabled = renderPeso(wrap, mount, ctx);
    } else if (key === "diasFuerza") {
      enabled = buildSinglePicker(wrap, mount, ctx, App.data.DIAS_FUERZA_ONBOARDING, form.diasFuerza, "Días disponibles para fuerza",
        function (opt) { form.diasFuerza = opt; });
    } else if (key === "actividadesExteriores") {
      renderActividadesExteriores(wrap, mount, ctx);
      enabled = actividadesEnabled(form);
    } else if (key === "duracion") {
      enabled = renderDuracion(wrap, mount, ctx);
    } else if (key === "entornos") {
      wrap.appendChild(App.el("p", "lede small", "Elige uno o varios. Solo para priorizar alternativas compatibles, no un inventario exacto. Cada entorno tendrá su propia pantalla de equipamiento."));
      enabled = buildMultiPicker(wrap, mount, ctx, App.data.ENTORNOS_ONBOARDING, form.entornos, "Entornos habituales");
    } else if (key.indexOf("equipo:") === 0) {
      enabled = renderEquipo(wrap, mount, ctx, key.slice(7));
    } else if (key === "foco") {
      enabled = renderFoco(wrap, mount, ctx);
    }

    var isLast = form.onbStepIndex === total - 1;
    var nextLabel = isLast ? (form.modoOnboarding === "propia" ? "Ir al creador de rutina" : "Generar mi plan") :
      (key === "nacimiento" || key === "altura" || key === "peso") ? "Continuar" : "Siguiente";
    var nextBtn = App.el("button", "btn btn--primary btn--block", nextLabel);
    nextBtn.type = "button";
    // Corrección onboarding-guiado-010 (ronda 2, y de nuevo en esta
    // corrección): el CTA queda deshabilitado de verdad hasta que la
    // decisión sea válida. Los tres pasos de rueda (nacimiento/altura/peso)
    // ya no necesitan una excepción: cada rueda solo ofrece valores dentro
    // del rango válido y siempre tiene un valor centrado por defecto, así
    // que `enabled` es `true` en cuanto se monta el paso (a diferencia del
    // formulario de texto libre anterior, que podía quedar vacío o fuera de
    // rango).
    nextBtn.disabled = !enabled;
    nextBtn.addEventListener("click", function () {
      if (!enabled) {
        App.toast("Elige una opción para continuar.");
        return;
      }

      if (!isLast) {
        form.onbStepIndex++;
        renderStep(mount, ctx);
        return;
      }

      if (form.modoOnboarding === "propia") {
        finishOwnRoutine(ctx);
      } else {
        form.step = "transition";
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

  /* ---- Paso 2: objetivos (chips multi-selección, orden = prioridad) ----- */

  // A diferencia de buildMultiPicker (genérico, orden irrelevante), aquí el
  // orden de `form.goals` SÍ es semántico: goals[0] es la prioridad
  // explicada al final. El array ya se comporta así (push al añadir, splice
  // al quitar), solo se añade una marca visual "prioridad" sobre el primero.
  function renderObjetivos(wrap, mount, ctx) {
    var form = ctx.form;
    var picker = App.el("div", "picker picker--wide");
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "Objetivos, elige uno o varios");
    App.data.OBJETIVOS_ONBOARDING.forEach(function (opt) {
      var idx = form.goals.indexOf(opt);
      var label = idx === 0 ? opt + " · prioridad" : opt;
      var btn = App.el("button", "picker__btn", label);
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(idx > -1));
      btn.addEventListener("click", function () {
        var i = form.goals.indexOf(opt);
        if (i > -1) form.goals.splice(i, 1); else form.goals.push(opt);
        renderStep(mount, ctx);
      });
      picker.appendChild(btn);
    });
    wrap.appendChild(picker);
    return form.goals.length > 0;
  }

  function goalsSummaryText(form) {
    if (!form.goals.length) return "";
    if (form.goals.length === 1) return form.goals[0];
    return form.goals[0] + " (prioridad) + " + form.goals.slice(1).join(" + ");
  }

  /* ---- Selector tipo rueda: accesible por scroll/táctil y por teclado --- */

  var WHEEL_ITEM_H = 56;

  // values: array de valores; formatLabel(v) -> texto mostrado; selected: el
  // valor inicial (siempre uno, no hay estado "vacío": igual que una rueda
  // de referencia, arranca centrada en un valor válido); onChange(v) se
  // llama en cada cambio de selección, sin forzar un re-render completo del
  // paso (evitaría perder la posición de scroll).
  var wheelInstanceCounter = 0;

  function buildWheel(values, formatLabel, selected, ariaLabel, onChange) {
    var instanceId = "wheel" + (++wheelInstanceCounter);
    var wheel = App.el("div", "wheel");
    wheel.setAttribute("role", "listbox");
    wheel.setAttribute("aria-label", ariaLabel);
    wheel.tabIndex = 0;
    wheel.appendChild(App.el("div", "wheel__pad"));
    var itemEls = values.map(function (v, i) {
      var el = App.el("div", "wheel__item", formatLabel(v));
      el.setAttribute("role", "option");
      el.id = instanceId + "-opt" + i;
      wheel.appendChild(el);
      return el;
    });
    wheel.appendChild(App.el("div", "wheel__pad"));

    var currentIdx = values.indexOf(selected);
    if (currentIdx < 0) currentIdx = 0;

    // Corrección (revisión independiente, hallazgo "importante"): el listbox
    // mantiene el foco del contenedor (roving focus virtual), así que sin
    // aria-activedescendant un lector de pantalla no anuncia el valor
    // seleccionado al navegar con flechas, aunque el valor sí cambie.
    function markSelected(idx) {
      currentIdx = idx;
      itemEls.forEach(function (el, i) {
        var isSel = i === idx;
        el.classList.toggle("is-center", isSel);
        el.setAttribute("aria-selected", String(isSel));
      });
      wheel.setAttribute("aria-activedescendant", itemEls[idx].id);
      onChange(values[idx]);
    }

    // El alto real de los ítems solo se conoce tras montar en el DOM;
    // requestAnimationFrame asegura layout listo antes de fijar scrollTop.
    requestAnimationFrame(function () {
      wheel.scrollTop = currentIdx * WHEEL_ITEM_H;
      markSelected(currentIdx);
    });

    var scrollTimer = null;
    wheel.addEventListener("scroll", function () {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var idx = Math.round(wheel.scrollTop / WHEEL_ITEM_H);
        idx = Math.max(0, Math.min(values.length - 1, idx));
        markSelected(idx);
      }, 80);
    });

    // Alternativa de teclado, requisito explícito: la rueda no puede
    // depender solo de arrastrar/deslizar.
    wheel.addEventListener("keydown", function (e) {
      var idx = currentIdx;
      if (e.key === "ArrowDown") idx = Math.min(values.length - 1, idx + 1);
      else if (e.key === "ArrowUp") idx = Math.max(0, idx - 1);
      else return;
      e.preventDefault();
      wheel.scrollTop = idx * WHEEL_ITEM_H;
      markSelected(idx);
    });

    return wheel;
  }

  function wheelColumn(labelText, values, formatLabel, selected, ariaLabel, onChange) {
    var col = App.el("div", "wheelcol");
    col.appendChild(App.el("p", "wheelcol__label", labelText));
    col.appendChild(App.el("div", "wheelcol__band"));
    col.appendChild(buildWheel(values, formatLabel, selected, ariaLabel, onChange));
    return col;
  }

  function privacyNote() {
    return App.el("p", "lede small privacy-note", "Tus datos son privados y están protegidos.");
  }

  /* ---- Paso 4: fecha de nacimiento (rueda día/mes/año) ------------------ */

  function renderNacimiento(wrap, mount, ctx) {
    var form = ctx.form;
    var bd = form.birthDate;
    if (!bd.year) {
      bd.day = 1; bd.month = 1;
      bd.year = new Date().getFullYear() - 30; // valor inicial razonable, editable de inmediato
    }

    wrap.appendChild(App.el("p", "lede small", "Los usamos para ajustar tu punto de partida; puedes cambiarlos después en Perfil."));

    var row = App.el("div", "wheelrow");
    row.appendChild(wheelColumn("Día", range(1, 31), function (v) { return String(v); }, bd.day, "Día de nacimiento",
      function (v) { bd.day = v; }));
    row.appendChild(wheelColumn("Mes", range(1, 12), function (v) { return MONTHS_ES[v - 1]; }, bd.month, "Mes de nacimiento",
      function (v) { bd.month = v; }));
    var minYear = new Date().getFullYear() - 100, maxYear = new Date().getFullYear() - 12;
    row.appendChild(wheelColumn("Año", range(minYear, maxYear), function (v) { return String(v); }, bd.year, "Año de nacimiento",
      function (v) { bd.year = v; }));
    wrap.appendChild(row);

    wrap.appendChild(privacyNote());
    return true; // la rueda siempre tiene un valor válido dentro de rango
  }

  /* ---- Paso 5: altura (rueda única, cm enteros) -------------------------- */

  function renderAltura(wrap, mount, ctx) {
    var form = ctx.form;
    if (!form.alturaCm) form.alturaCm = 170;

    wrap.appendChild(App.el("p", "lede small", "Los usamos para ajustar tu punto de partida; puedes cambiarlos después en Perfil."));
    var row = App.el("div", "wheelrow wheelrow--single");
    row.appendChild(wheelColumn("cm", range(100, 250), function (v) { return v + " cm"; }, form.alturaCm, "Altura en centímetros",
      function (v) { form.alturaCm = v; }));
    wrap.appendChild(row);

    wrap.appendChild(privacyNote());
    return true;
  }

  /* ---- Paso 6: peso (dos ruedas: kg enteros + décimas) ------------------- */

  function renderPeso(wrap, mount, ctx) {
    var form = ctx.form;
    if (form.pesoKg === null) form.pesoKg = 70.0;
    var entero = Math.floor(form.pesoKg);
    var decimal = Math.round((form.pesoKg - entero) * 10);

    wrap.appendChild(App.el("p", "lede small", "Los usamos para ajustar tu punto de partida; puedes cambiarlos después en Perfil."));

    function sync() { form.pesoKg = Math.round((entero + decimal / 10) * 10) / 10; }

    var row = App.el("div", "wheelrow wheelrow--peso");
    row.appendChild(wheelColumn("kg", range(30, 300), function (v) { return String(v); }, entero, "Peso, kilogramos enteros",
      function (v) { entero = v; sync(); }));
    row.appendChild(App.el("span", "wheelrow__sep", ","));
    row.appendChild(wheelColumn("décimas", range(0, 9), function (v) { return String(v); }, decimal, "Peso, décimas de kilogramo",
      function (v) { decimal = v; sync(); }));
    row.appendChild(App.el("span", "wheelrow__unit", "kg"));
    wrap.appendChild(row);

    wrap.appendChild(privacyNote());
    return true;
  }

  /* ---- Paso 6: actividades exteriores (multi + frecuencia por actividad) */

  function findActividad(form, actividad) {
    var found = null;
    form.actividadesExteriores.forEach(function (e) { if (e.actividad === actividad) found = e; });
    return found;
  }

  function toggleActividad(form, actividad) {
    if (actividad === "Ninguna") {
      form.actividadesExteriores = findActividad(form, "Ninguna") ? [] : [{ actividad: "Ninguna", frecuencia: null }];
      return;
    }
    // Elegir cualquier otra actividad quita "Ninguna" (excluyente en ambos
    // sentidos, ver contrato).
    form.actividadesExteriores = form.actividadesExteriores.filter(function (e) { return e.actividad !== "Ninguna"; });
    if (findActividad(form, actividad)) {
      form.actividadesExteriores = form.actividadesExteriores.filter(function (e) { return e.actividad !== actividad; });
    } else {
      form.actividadesExteriores.push({ actividad: actividad, frecuencia: null });
    }
  }

  function actividadesEnabled(form) {
    if (!form.actividadesExteriores.length) return false;
    return form.actividadesExteriores.every(function (e) { return e.actividad === "Ninguna" || !!e.frecuencia; });
  }

  function renderActividadesExteriores(wrap, mount, ctx) {
    var form = ctx.form;
    wrap.appendChild(App.el("p", "lede small", "Elige las que practiques habitualmente. \"Ninguna\" si no haces actividad exterior regular."));
    var picker = App.el("div", "picker picker--wide");
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-label", "Actividades exteriores");
    App.data.ACTIVIDADES_EXTERIORES_ONBOARDING.forEach(function (opt) {
      var btn = App.el("button", "picker__btn", opt);
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(!!findActividad(form, opt)));
      btn.addEventListener("click", function () { toggleActividad(form, opt); renderStep(mount, ctx); });
      picker.appendChild(btn);
    });
    wrap.appendChild(picker);

    form.actividadesExteriores.forEach(function (entry) {
      if (entry.actividad === "Ninguna") return;
      wrap.appendChild(App.el("p", "field__label", "Frecuencia semanal · " + entry.actividad));
      var freqPicker = App.el("div", "picker");
      freqPicker.setAttribute("role", "group");
      freqPicker.setAttribute("aria-label", "Frecuencia de " + entry.actividad);
      ["1", "2", "3", "4+"].forEach(function (f) {
        var b = App.el("button", "picker__btn", f);
        b.type = "button";
        b.setAttribute("aria-pressed", String(entry.frecuencia === f));
        b.addEventListener("click", function () { entry.frecuencia = f; renderStep(mount, ctx); });
        freqPicker.appendChild(b);
      });
      wrap.appendChild(freqPicker);
    });
  }

  /* ---- Paso 7: duración habitual, con sugerencia no vinculante ---------- */

  function suggestDuracion(form) {
    if (form.experiencia === "Empezando") return "30-40 min";
    var freqAlta = form.actividadesExteriores.some(function (e) {
      return e.actividad !== "Ninguna" && (e.frecuencia === "3" || e.frecuencia === "4+");
    });
    if (form.goals.indexOf("Mejorar rendimiento exterior") > -1 && freqAlta) return "60-75 min";
    return null;
  }

  function renderDuracion(wrap, mount, ctx) {
    var form = ctx.form;
    var suggestion = suggestDuracion(form);
    if (suggestion) {
      wrap.appendChild(App.el("p", "lede small", "Con lo que nos cuentas, mucha gente elige ~" + suggestion + "."));
    }
    return buildSinglePicker(wrap, mount, ctx, App.data.DURACIONES_SESION, form.duracionHabitual, "Duración habitual",
      function (opt) { form.duracionHabitual = opt; });
  }

  /* ---- Paso 9: equipamiento por entorno (un sub-paso por entorno) ------- */

  // Corrección (equipamiento): parte de todo marcado (selección completa) y
  // el usuario solo desmarca lo que no tiene. `form.equipoPorEntorno[entorno]`
  // guarda los ítems DESMARCADOS, nunca los disponibles (ver data.js). El
  // CTA siempre está habilitado: un array vacío ya es un estado válido y
  // completo ("todo disponible"), no hace falta ninguna acción mínima.
  function renderEquipo(wrap, mount, ctx, entorno) {
    var form = ctx.form;
    if (!form.equipoPorEntorno[entorno]) form.equipoPorEntorno[entorno] = [];
    var deseleccionado = form.equipoPorEntorno[entorno];

    wrap.appendChild(App.el("p", "lede small", "Partimos de una selección completa. Quita solo lo que no tengas disponible."));
    wrap.appendChild(App.el("p", "lede small", "Podrás ajustarlo después en Perfil."));

    var grupoKeys = App.data.EQUIPAMIENTO_GRUPOS_POR_ENTORNO[entorno] || [];
    grupoKeys.forEach(function (key) {
      var grupo = App.data.EQUIPAMIENTO_GRUPOS.filter(function (g) { return g.key === key; })[0];
      if (!grupo) return;
      wrap.appendChild(App.el("h2", "equipgroup__title", grupo.label));
      var list = App.el("div", "equipgroup__list");
      grupo.items.forEach(function (item) {
        list.appendChild(equipRow(item, deseleccionado));
      });
      wrap.appendChild(list);
    });

    return true;
  }

  // Fila completa pulsable: <label> nativo envuelve el checkbox + el
  // nombre, así toda la fila alterna el control sin JS adicional. El
  // checkbox empieza marcado salvo que el ítem ya esté en `deseleccionado`.
  function equipRow(item, deseleccionado) {
    var row = App.el("label", "equiprow");
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = deseleccionado.indexOf(item) === -1;
    checkbox.addEventListener("change", function () {
      var idx = deseleccionado.indexOf(item);
      if (checkbox.checked) {
        if (idx > -1) deseleccionado.splice(idx, 1);
      } else if (idx === -1) {
        deseleccionado.push(item);
      }
    });
    row.appendChild(checkbox);
    row.appendChild(App.el("span", "equiprow__name", item));
    return row;
  }

  /* ---- Paso 10: foco muscular opcional (máx. 2 + "Sin preferencia") ----- */

  function muscleCard(key, label, image, form, mount, ctx) {
    var btn = App.el("button", "opt musclecard" + (key === null ? " musclecard--empty" : ""));
    btn.type = "button";
    var selected = key === null ? form.focoMuscular.length === 0 : form.focoMuscular.indexOf(key) > -1;
    btn.setAttribute("aria-pressed", String(selected));
    btn.setAttribute("aria-label", label);

    if (image) {
      var media = App.el("span", "musclecard__media");
      var img = document.createElement("img");
      img.className = "musclecard__img";
      img.src = "assets/library/groups/" + image;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.loading = "lazy";
      img.decoding = "async";
      media.appendChild(img);
      btn.appendChild(media);
    }

    var body = App.el("span", "musclecard__body");
    body.appendChild(App.el("span", "musclecard__name", label));
    btn.appendChild(body);

    btn.addEventListener("click", function () {
      if (key === null) { form.focoMuscular = []; renderStep(mount, ctx); return; }
      var idx = form.focoMuscular.indexOf(key);
      if (idx > -1) { form.focoMuscular.splice(idx, 1); renderStep(mount, ctx); return; }
      if (form.focoMuscular.length >= 2) { App.toast("Elige como máximo dos focos."); return; }
      form.focoMuscular.push(key);
      renderStep(mount, ctx);
    });
    return btn;
  }

  function renderFoco(wrap, mount, ctx) {
    var form = ctx.form;
    wrap.appendChild(App.el("p", "lede small", "Opcional: hasta dos grupos si quieres darles algo más de énfasis. Puedes seguir sin elegir ninguno."));
    var grid = App.el("div", "musclegrid");
    grid.appendChild(muscleCard(null, "Sin preferencia", null, form, mount, ctx));
    MUSCLE_GROUPS_ONBOARDING.forEach(function (g) {
      grid.appendChild(muscleCard(g.key, g.label, g.image, form, mount, ctx));
    });
    wrap.appendChild(grid);
    return true; // el foco muscular nunca bloquea avanzar
  }

  /* ---- Transición 0→99% antes de "Tu plan inicial" ----------------------
   * Pantalla inmersiva de generación (corrección prioritaria): un único
   * círculo de progreso, sin tarjetas ni barra horizontal ni controles.
   * El porcentaje se deriva del tiempo transcurrido (no de pasos fijos) para
   * que 0→99% dure GEN_DURATION_MS exactos con un solo requestAnimationFrame,
   * en vez de encadenar varios setTimeout/setInterval. ------------------ */

  var GEN_DURATION_MS = 5000;
  var GEN_MAX_PERCENT = 99;
  var GEN_PHASES = [
    { upTo: 34, text: "Ordenamos tu semana" },
    { upTo: 69, text: "Equilibramos fuerza y actividad exterior" },
    { upTo: 99, text: "Preparamos alternativas compatibles" }
  ];

  function genPhaseForPercent(pct) {
    for (var i = 0; i < GEN_PHASES.length; i++) {
      if (pct <= GEN_PHASES[i].upTo) return GEN_PHASES[i];
    }
    return GEN_PHASES[GEN_PHASES.length - 1];
  }

  // Expuesto para pruebas Node (sin DOM): calcula el % 0-99 a partir del
  // tiempo transcurrido, saturando en el máximo hasta que finalice.
  function genPercentForElapsed(elapsedMs, durationMs) {
    var pct = Math.floor((elapsedMs / durationMs) * (GEN_MAX_PERCENT + 1));
    return Math.max(0, Math.min(GEN_MAX_PERCENT, pct));
  }
  App._genPercentForElapsed = genPercentForElapsed;
  App._genPhaseForPercent = genPhaseForPercent;
  App._GEN_DURATION_MS = GEN_DURATION_MS;
  App._GEN_PHASES = GEN_PHASES;

  function renderTransition(mount, ctx) {
    var wrap = App.el("section", "access genloader");
    wrap.appendChild(App.el("p", "genloader__kicker", "Estamos preparando tu plan"));
    wrap.appendChild(App.el("h1", "view-title genloader__title", "Tu plan personalizado"));

    var circle = App.el("div", "genloader__circle");
    circle.setAttribute("role", "progressbar");
    circle.setAttribute("aria-valuemin", "0");
    circle.setAttribute("aria-valuemax", String(GEN_MAX_PERCENT));
    circle.setAttribute("aria-valuenow", "0");
    circle.setAttribute("aria-label", "Generando tu plan");

    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 220 220");
    svg.setAttribute("class", "genloader__ring");
    svg.setAttribute("aria-hidden", "true");
    var track = document.createElementNS(svgNS, "circle");
    track.setAttribute("class", "genloader__ring-track");
    track.setAttribute("cx", "110"); track.setAttribute("cy", "110"); track.setAttribute("r", "98");
    var fillRing = document.createElementNS(svgNS, "circle");
    fillRing.setAttribute("class", "genloader__ring-fill");
    fillRing.setAttribute("cx", "110"); fillRing.setAttribute("cy", "110"); fillRing.setAttribute("r", "98");
    var circumference = 2 * Math.PI * 98;
    fillRing.style.strokeDasharray = String(circumference);
    fillRing.style.strokeDashoffset = String(circumference);
    svg.appendChild(track);
    svg.appendChild(fillRing);
    circle.appendChild(svg);

    var percentEl = App.el("p", "genloader__percent", "0%");
    circle.appendChild(percentEl);
    wrap.appendChild(circle);

    var phraseEl = App.el("p", "genloader__phrase", GEN_PHASES[0].text);
    wrap.appendChild(phraseEl);

    var live = App.el("p", "sr-only");
    live.setAttribute("aria-live", "polite");
    wrap.appendChild(live);

    mount.appendChild(wrap);

    function paint(pct) {
      percentEl.textContent = pct + "%";
      circle.setAttribute("aria-valuenow", String(pct));
      fillRing.style.strokeDashoffset = String(circumference * (1 - pct / (GEN_MAX_PERCENT + 1)));
    }

    function setPhase(phase, announce) {
      if (phraseEl.textContent !== phase.text) {
        phraseEl.textContent = phase.text;
        if (announce) live.textContent = phase.text;
      }
    }

    function finishTransition() {
      buildGuidedProposal(ctx);
      ctx.form.step = "proposal";
      renderStep(mount, ctx);
    }

    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      // ponytail: sin animación ornamental del círculo, pero se conserva la
      // pantalla y su duración aproximada (respeta prefers-reduced-motion).
      paint(GEN_MAX_PERCENT);
      setPhase(GEN_PHASES[GEN_PHASES.length - 1], true);
      setTimeout(finishTransition, GEN_DURATION_MS);
      return;
    }

    var start = null;
    function step(now) {
      // Se detiene solo si el nodo ya no está en el documento (navegación,
      // retroceso o reinicio de la demo limpiaron mount.innerHTML): mismo
      // criterio de "¿sigue vivo?" que usa el temporizador de descanso en
      // strength.js con App.$(id).
      if (!document.body.contains(circle)) return;
      if (start === null) start = now;
      var elapsed = now - start;
      var pct = genPercentForElapsed(elapsed, GEN_DURATION_MS);
      paint(pct);
      setPhase(genPhaseForPercent(pct), true);
      if (elapsed < GEN_DURATION_MS) {
        requestAnimationFrame(step);
      } else {
        setTimeout(finishTransition, 250);
      }
    }
    requestAnimationFrame(step);
  }

  /* ---- Generación de la propuesta guiada (ruta "propuesta guiada") ------ */

  // Deriva actividad/frecuencia cardio para generatePlanWeek a partir de las
  // actividades exteriores elegidas (paso 6): actividad principal = la de
  // mayor frecuencia (empate → Correr > Bicicleta > Caminar/senderismo).
  // Simplificación conocida y documentada en el contrato: el motor solo
  // modela UNA actividad exterior "principal" a la vez; el resto queda
  // guardado en el perfil (user.actividadesExteriores) sin reflejarse
  // todavía en el calendario generado.
  var ACTIVIDAD_A_CARDIO = { "Correr": "Correr", "Bicicleta": "Bici", "Caminar/senderismo": "Andar" };
  var ACTIVIDAD_PRIORIDAD = ["Correr", "Bicicleta", "Caminar/senderismo"];

  function freqNum(f) { return f === "4+" ? 4 : (parseInt(f, 10) || 0); }

  function deriveCardio(actividadesExteriores) {
    var list = actividadesExteriores.filter(function (a) { return a.actividad !== "Ninguna"; });
    if (!list.length) return { cardioActividad: "Ninguna", cardioFrecuencia: "0" };
    var best = list[0];
    list.forEach(function (a) {
      var fa = freqNum(a.frecuencia), fb = freqNum(best.frecuencia);
      if (fa > fb || (fa === fb && ACTIVIDAD_PRIORIDAD.indexOf(a.actividad) < ACTIVIDAD_PRIORIDAD.indexOf(best.actividad))) {
        best = a;
      }
    });
    var totalFreq = list.reduce(function (sum, a) { return sum + freqNum(a.frecuencia); }, 0);
    // Cap a 3: máximo que ya soporta el motor (mismo criterio que
    // CARDIO_FRECUENCIAS de plan-builder.js).
    totalFreq = Math.max(1, Math.min(3, totalFreq));
    return { cardioActividad: ACTIVIDAD_A_CARDIO[best.actividad] || "Correr", cardioFrecuencia: String(totalFreq) };
  }

  function diasFuerzaNum(diasFuerza) { return diasFuerza === "5+" ? 5 : (parseInt(diasFuerza, 10) || 3); }

  function buildGuidedProposal(ctx) {
    var form = ctx.form;
    var cardio = deriveCardio(form.actividadesExteriores);
    var totalDias = Math.min(6, Math.max(1, diasFuerzaNum(form.diasFuerza) + parseInt(cardio.cardioFrecuencia, 10)));
    var plantilla = cardio.cardioActividad === "Ninguna" ? "ppl" : "hibrido";
    var opts = {
      modo: "plantilla", plantilla: plantilla,
      diasDisponibles: String(totalDias), duracionHabitual: form.duracionHabitual,
      cardioActividad: cardio.cardioActividad, cardioFrecuencia: cardio.cardioFrecuencia
    };
    var proposal = App.data.generatePlanWeek(opts);
    if (proposal.infeasible && proposal.suggestReduceFreq !== undefined) {
      opts.cardioFrecuencia = String(proposal.suggestReduceFreq);
      proposal = App.data.generatePlanWeek(opts);
      proposal.adjustedFreq = true;
    }
    ctx.form.proposal = proposal;
    ctx.form.proposalMeta = {
      plantilla: plantilla, cardioActividad: cardio.cardioActividad,
      cardioFrecuencia: parseInt(opts.cardioFrecuencia, 10), totalDias: totalDias
    };
  }

  function renderProposal(mount, ctx) {
    var data = App.data;
    var form = ctx.form;
    var proposal = form.proposal;
    var meta = form.proposalMeta;

    var wrap = App.el("section", "access");
    var header = App.el("div", "view-header");
    var back = App.el("button", "back-btn", "←");
    back.type = "button";
    back.setAttribute("aria-label", "Volver a cambiar tus respuestas");
    back.addEventListener("click", function () {
      var list = stepList(form);
      form.step = "onboarding";
      form.onbStepIndex = list.length - 1;
      renderStep(mount, ctx);
    });
    header.appendChild(back);
    var headBody = document.createElement("div");
    // Corrección onboarding-guiado-010 (ronda 2): el encargo pide literalmente
    // Título: "Tu plan inicial" para el <h1>; el texto descriptivo pasa a kicker.
    headBody.appendChild(App.el("p", "kicker", "Así queda tu primera semana"));
    headBody.appendChild(App.el("h1", "view-title", "Tu plan inicial"));
    header.appendChild(headBody);
    wrap.appendChild(header);

    wrap.appendChild(App.el("p", "lede small",
      goalsSummaryText(form) + " · " + (form.experiencia || "") + " · " + form.entornos.join(", ") +
      " · " + meta.totalDias + (meta.totalDias === 1 ? " día por semana" : " días por semana")));
    wrap.appendChild(App.el("p", "lede small", "Bloque de 8 semanas, con revisión y ajuste en cada check-in."));

    wrap.appendChild(App.el("p", "lede", proposal.explanation ||
      "No pudimos generar una propuesta con esta combinación. Vuelve atrás y ajusta tus días o tus actividades exteriores."));
    if (proposal.adjustedFreq) {
      wrap.appendChild(App.el("p", "notice notice--info",
        "Ajustamos automáticamente la frecuencia de actividad exterior para dejar sitio a tu sesión de fuerza. Podrás cambiarlo después desde el calendario."));
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
          var conflict = data.findConflict(proposal.sessions, day.key, session);
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
    }

    wrap.appendChild(App.el("p", "notice notice--info",
      "La app propondrá ajustes cuando detecte un cambio de carga, disponibilidad o check-in, pero nunca aplicará cambios sin tu confirmación."));

    var hasResistencia = !!(proposal.sessions && proposal.sessions.some(function (s) { return s.tipo === "resistencia"; }));
    if (hasResistencia) {
      wrap.appendChild(App.el("p", "lede small",
        "Prepararás la sesión en tu reloj o aplicación y después podrás importar FIT, TCX o GPX."));
    }

    var hasSessions = !!(proposal.sessions && proposal.sessions.length);

    var useBtn = App.el("button", "btn btn--primary btn--block", "Usar este plan");
    useBtn.type = "button";
    useBtn.disabled = !hasSessions;
    useBtn.addEventListener("click", function () { activateGuidedPlan(ctx); });
    wrap.appendChild(useBtn);

    var editBtn = App.el("button", "btn btn--ghost btn--block", "Editar antes de activar");
    editBtn.type = "button";
    editBtn.disabled = !hasSessions;
    editBtn.addEventListener("click", function () { draftGuidedPlan(ctx); });
    wrap.appendChild(editBtn);

    mount.appendChild(wrap);
  }

  function proposalPlanName(form) {
    return "Plan inicial: " + (form.goals[0] || "tu objetivo");
  }

  function activateGuidedPlan(ctx) {
    var form = ctx.form;
    saveCommonUserFields(form);
    var data = App.data;
    var sessions = form.proposal.sessions;
    if (data.plan && data.plan.estado === "activo") data.plan.estado = "pausado";
    var plan = {
      id: "plan-" + Date.now(),
      nombre: proposalPlanName(form),
      estado: "activo",
      semanaActual: 1,
      semanasTotales: 8,
      constanciaSemanas: 0,
      fases: data.buildFasesFromTemplate(1),
      plantilla: form.proposalMeta.plantilla
    };
    data.PLANS.push(plan);
    data.plan = plan;
    data.SESSIONS.length = 0;
    Array.prototype.push.apply(data.SESSIONS, sessions);
    data.lastAction = null;

    data.auth.estado = "autenticado";
    data.auth.primerUso = false;
    App.persist();

    App.viewContext("access").form = freshFormState();
    App.toast(plan.nombre + " está activo.");
    App.navigate("home", {}, { replace: true });
  }

  function draftGuidedPlan(ctx) {
    var form = ctx.form;
    saveCommonUserFields(form);
    var data = App.data;
    var sessions = form.proposal.sessions;
    var plan = {
      id: "plan-" + Date.now(),
      nombre: proposalPlanName(form),
      estado: "borrador",
      semanaActual: 0,
      semanasTotales: 8,
      constanciaSemanas: 0,
      fases: data.buildFasesFromTemplate(1),
      plantilla: form.proposalMeta.plantilla,
      sessions: sessions
    };
    data.PLANS.push(plan);

    data.auth.estado = "autenticado";
    data.auth.primerUso = false;
    App.persist();

    App.viewContext("access").form = freshFormState();
    App.toast("Guardado como borrador: " + plan.nombre + ". Actívalo desde “Tus planes” para verlo en el calendario.");
    App.viewContext("plan").tab = "gestion";
    App.navigate("plan", {}, { replace: true });
  }

  /* ---- Ruta "rutina propia": entrega al creador guiado ------------------ */

  // Mapeos de vocabulario onboarding -> plan-builder.js. plan-builder.js NO
  // se toca (ver decisión documentada: sus etiquetas de duración/objetivo
  // son propias y distintas; el contrato pide mapear "a la más cercana", lo
  // que solo tiene sentido si son vocabularios separados).
  function mapExperienciaToBuilder(exp) {
    return { "Empezando": "Principiante", "Con base": "Intermedia", "Avanzado": "Avanzada" }[exp] || null;
  }

  // Corrección onboarding-guiado-010 (ronda 2): "Ganar fuerza" quedaba sin
  // mapear (null, sin preselección). De los 5 valores de OBJETIVOS en
  // plan-builder.js, "Rendimiento combinado" es el más cercano semánticamente
  // (equilibra fuerza y resistencia, sin forzar la equivalencia engañosa de
  // "Ganar músculo" = hipertrofia que ya se descartó para este caso).
  function mapObjetivoToBuilder(obj) {
    var map = {
      "Ganar músculo": "Ganar músculo",
      "Ganar fuerza": "Rendimiento combinado",
      "Quemar grasa": "Perder grasa",
      "Mejorar rendimiento exterior": "Mejorar resistencia",
      "Mantenerme activo": "Mantener forma"
    };
    return map[obj] || null;
  }

  // Clamp al valor más cercano dentro de DIAS_OPCIONES de plan-builder
  // (["3","4","5","6"]): diasFuerza "1"/"2" no tienen equivalente exacto.
  function mapDiasFuerzaToBuilder(diasFuerza) {
    var n = diasFuerzaNum(diasFuerza);
    var opts = [3, 4, 5, 6];
    var best = opts[0];
    opts.forEach(function (o) { if (Math.abs(o - n) < Math.abs(best - n)) best = o; });
    return String(best);
  }

  // Duración por minutos aproximados (35/50/65/80) al valor más cercano de
  // plan-builder (20/40/60/90 min).
  function mapDuracionToBuilder(dur) {
    var map = {
      "30-40 min": "40 min",
      "45-60 min": "60 min",
      "60-75 min": "60 min",
      "más de 75 min": "90+ min"
    };
    return map[dur] || "40 min";
  }

  function saveCommonUserFields(form) {
    var user = App.data.user;
    // Corrección onboarding-guiado-010: goals/primaryGoal son la fuente real
    // (multi-selección); `objetivo` se mantiene en espejo con primaryGoal
    // para Perfil y plan-builder.js, que solo entienden un objetivo único.
    user.goals = form.goals.slice();
    user.primaryGoal = form.goals[0] || null;
    user.objetivo = user.primaryGoal;
    user.experiencia = form.experiencia;
    var bd = form.birthDate;
    user.birthDate = bd.year + "-" + (bd.month < 10 ? "0" + bd.month : bd.month) + "-" + (bd.day < 10 ? "0" + bd.day : bd.day);
    user.edad = App.data.ageFromBirthDate(user.birthDate);
    user.alturaCm = form.alturaCm;
    user.unidadesAltura = "cm"; // fijo en el MVP; el toggle ft/in solo existe en Perfil, fuera de esta corrección
    user.pesoKg = form.pesoKg;
    user.unidades = "kg"; // fijo en el MVP; el toggle lb solo existe en Perfil, fuera de esta corrección
    user.diasFuerza = form.diasFuerza;
    user.actividadesExteriores = form.actividadesExteriores.map(function (e) { return { actividad: e.actividad, frecuencia: e.frecuencia }; });
    user.duracionHabitual = form.duracionHabitual;
    user.entornos = form.entornos.slice();
    user.entorno = form.entornos[0] || null; // compat: creador guiado/Perfil siguen leyendo el singular
    user.equipoPorEntorno = {};
    Object.keys(form.equipoPorEntorno).forEach(function (env) { user.equipoPorEntorno[env] = form.equipoPorEntorno[env].slice(); });
    user.focoMuscular = form.focoMuscular.slice();
    // Compat: diasDisponibles antiguo (numérico, solo fuerza) para vistas
    // que aún puedan leerlo; no incluye la actividad exterior.
    user.diasDisponibles = diasFuerzaNum(form.diasFuerza);
    user.recommendationMode = "proactive_confirmed";
    user.externalRecordingMode = "manual_watch_import";
  }

  function finishOwnRoutine(ctx) {
    var form = ctx.form;
    saveCommonUserFields(form);
    App.data.auth.estado = "autenticado";
    App.data.auth.primerUso = false;
    App.persist();

    var cardio = deriveCardio(form.actividadesExteriores);
    var diasBuilder = mapDiasFuerzaToBuilder(form.diasFuerza);
    var wizard = {
      step: 0,
      modo: null, plantilla: null,
      primeraSesionNombre: "", primeraSesionTipo: "fuerza",
      objetivo: mapObjetivoToBuilder(form.goals[0]),
      experiencia: mapExperienciaToBuilder(form.experiencia),
      // Corrección onboarding-guiado-010 (ronda 2): antes quedaba `null` y
      // bloqueaba el paso 3 (carga habitual) al saltar directo al 6. El
      // onboarding no pregunta carga habitual y no hay equivalente real que
      // mapear, así que se fija un valor por defecto razonable ("Moderada")
      // editable si el usuario retrocede manualmente a ese paso.
      cargaHabitual: "Moderada",
      diasDisponibles: diasBuilder,
      duracionHabitual: mapDuracionToBuilder(form.duracionHabitual),
      entorno: form.entornos[0] || null,
      cardioActividad: cardio.cardioActividad,
      cardioFrecuencia: cardio.cardioFrecuencia,
      proposal: null, signature: null,
      // Corrección onboarding-guiado-010 (ronda 2): marca que este wizard
      // viene prellenado desde el onboarding, para que plan-builder.js salte
      // directo del paso 0 al paso 6 (propuesta) en vez de repetir 5
      // pantallas ya respondidas. Se consume una sola vez en el primer
      // "Siguiente" del paso 0 (ver appendNext en plan-builder.js).
      prefilled: true
    };
    App.viewContext("planBuilder").wizard = wizard;
    App.viewContext("access").form = freshFormState();
    App.navigate("planBuilder", {}, { replace: true });

    var diasOriginal = diasFuerzaNum(form.diasFuerza);
    if (parseInt(diasBuilder, 10) !== diasOriginal) {
      App.toast("Ajustamos tus días de fuerza (" + diasOriginal + " → " + diasBuilder +
        ") al mínimo que soporta el creador guiado. Perfil guardado, sigamos con tu rutina.");
    } else {
      App.toast("Perfil guardado. Sigamos con tu rutina.");
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
