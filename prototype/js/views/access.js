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

  var PROFILE_STEPS = [
    {
      key: "objetivo", label: "Objetivo",
      options: ["Ganar músculo", "Mejorar resistencia", "Mantener forma", "Rendimiento combinado"]
    },
    {
      key: "experiencia", label: "Experiencia",
      options: ["Principiante", "Intermedia", "Avanzada"]
    },
    {
      key: "diasDisponibles", label: "Días disponibles por semana",
      options: ["3", "4", "5", "6"]
    },
    {
      key: "duracionHabitual", label: "Duración habitual de sesión",
      options: ["20 min", "40 min", "60 min", "90+ min"]
    },
    {
      key: "entorno", label: "Entorno habitual",
      options: ["Gimnasio completo", "Gimnasio básico", "Casa", "Exterior"]
    }
  ];

  function freshFormState() {
    return {
      step: "auth",              // auth | recover | privacy | profile
      mode: "login",             // login | signup
      email: "", password: "",
      emailError: null, passwordError: null, authError: null,
      recoverEmail: "", recoverSent: false,
      profileIndex: 0,
      profile: { objetivo: null, experiencia: null, diasDisponibles: null, duracionHabitual: null, entorno: null }
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
  }

  /* ---- Paso 1: crear cuenta / iniciar sesión --------------------------- */

  function renderAuth(mount, ctx) {
    var form = ctx.form;

    var wrap = App.el("section", "access");
    wrap.appendChild(App.el("p", "kicker", "Tu camino"));
    var h1 = App.el("h1", "view-title", form.mode === "login" ? "Inicia sesión" : "Crea tu cuenta");
    wrap.appendChild(h1);
    wrap.appendChild(App.el("p", "lede", "Prototipo: no hay servidor real. La cuenta " + DEMO_EMAIL + " con la contraseña " + DEMO_PASSWORD + " simula un acceso válido."));

    var modeSwitch = App.el("div", "modeswitch");
    modeSwitch.setAttribute("role", "group");
    modeSwitch.setAttribute("aria-label", "Modo de acceso");
    var loginBtn = App.el("button", "modeswitch__btn" + (form.mode === "login" ? " is-active" : ""), "Iniciar sesión");
    loginBtn.type = "button";
    loginBtn.setAttribute("aria-pressed", String(form.mode === "login"));
    loginBtn.addEventListener("click", function () { form.mode = "login"; form.authError = null; renderStep(mount, ctx); });
    var signupBtn = App.el("button", "modeswitch__btn" + (form.mode === "signup" ? " is-active" : ""), "Crear cuenta");
    signupBtn.type = "button";
    signupBtn.setAttribute("aria-pressed", String(form.mode === "signup"));
    signupBtn.addEventListener("click", function () { form.mode = "signup"; form.authError = null; renderStep(mount, ctx); });
    modeSwitch.appendChild(loginBtn);
    modeSwitch.appendChild(signupBtn);
    wrap.appendChild(modeSwitch);

    if (form.authError) {
      var err = App.el("p", "notice notice--warn", form.authError);
      err.setAttribute("role", "alert");
      wrap.appendChild(err);
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

    var submit = App.el("button", "btn btn--primary btn--block", form.mode === "login" ? "Entrar" : "Crear cuenta");
    submit.type = "submit";
    formEl.appendChild(submit);

    if (form.mode === "login") {
      var recoverBtn = App.el("button", "btn btn--quiet", "¿Olvidaste tu contraseña?");
      recoverBtn.type = "button";
      recoverBtn.addEventListener("click", function () { form.step = "recover"; renderStep(mount, ctx); });
      formEl.appendChild(recoverBtn);
    }

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

    if (form.mode === "login") {
      if (form.email.trim().toLowerCase() !== DEMO_EMAIL || form.password !== DEMO_PASSWORD) {
        form.authError = "Correo o contraseña incorrectos. Vuelve a intentarlo o recupera tu contraseña.";
        renderStep(mount, ctx);
        return;
      }
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

    wrap.appendChild(App.el("p", "lede small", "Nada de RPE ni inventario de máquinas: solo lo esencial para proponerte una primera semana."));

    var picker = App.el("div", "picker picker--wide");
    picker.setAttribute("role", "group");
    picker.setAttribute("aria-labelledby", "profileStepLabel");
    var current = form.profile[stepDef.key];
    stepDef.options.forEach(function (opt) {
      var btn = App.el("button", "picker__btn", opt);
      btn.type = "button";
      var pressed = current === opt;
      btn.setAttribute("aria-pressed", String(pressed));
      btn.addEventListener("click", function () {
        form.profile[stepDef.key] = opt;
        renderStep(mount, ctx);
      });
      picker.appendChild(btn);
    });
    wrap.appendChild(picker);

    var nextBtn = App.el("button", "btn btn--primary btn--block",
      form.profileIndex === total - 1 ? "Terminar" : "Siguiente");
    nextBtn.type = "button";
    nextBtn.addEventListener("click", function () {
      if (!form.profile[stepDef.key]) { App.toast("Elige una opción para continuar."); return; }
      if (form.profileIndex < total - 1) {
        form.profileIndex++;
        renderStep(mount, ctx);
      } else {
        finishOnboarding(ctx);
      }
    });
    wrap.appendChild(nextBtn);

    mount.appendChild(wrap);
  }

  function finishOnboarding(ctx) {
    var profile = ctx.form.profile;
    var user = App.data.user;
    user.objetivo = profile.objetivo;
    user.experiencia = profile.experiencia;
    user.diasDisponibles = parseInt(profile.diasDisponibles, 10) || null;
    user.duracionHabitual = profile.duracionHabitual;
    user.entorno = profile.entorno;

    App.data.auth.estado = "autenticado";
    App.data.auth.primerUso = false;
    App.persist();

    App.viewContext("access").form = freshFormState();

    if (App.data.plan && App.data.plan.estado === "activo") {
      App.navigate("home", {}, { replace: true });
      App.toast("Cuenta creada. Bienvenido a tu camino.");
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
