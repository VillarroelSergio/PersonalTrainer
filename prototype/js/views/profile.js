/* =====================================================================
 * Vista: Perfil — preferencias, cuenta, datos y privacidad, plataforma y
 * panel de demo (LOTE 6). Notas 24, 11, 29.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  function render(mount) {
    var data = App.data;
    var wrap = App.el("section", "view-profile");
    wrap.appendChild(App.el("h1", "view-title", "Perfil"));
    wrap.appendChild(App.el("p", "lede small",
      (data.user.email || "Cuenta de demostración") + " · " + (data.user.objetivo || "Sin objetivo definido")));
    // ---- prioridad-hibrida-006: el pill de la cabecera ya no muestra texto
    // permanente de simulación (criterio 13); el detalle queda aquí.
    wrap.appendChild(App.el("p", "lede small", "Demo local · sin conexión real, todo vive en este dispositivo."));

    wrap.appendChild(App.el("h2", "section-title", "Preferencias"));
    wrap.appendChild(buildPreferences(data));

    wrap.appendChild(App.el("h2", "section-title", "Seguridad"));
    wrap.appendChild(buildSecurity(data));

    wrap.appendChild(App.el("h2", "section-title", "Datos y privacidad"));
    wrap.appendChild(buildPrivacy(data));

    wrap.appendChild(App.el("h2", "section-title", "Plataforma"));
    var platformHost = App.el("div");
    wrap.appendChild(platformHost);
    renderPlatform(platformHost, data);

    wrap.appendChild(App.el("h2", "section-title", "Cuenta"));
    wrap.appendChild(buildAccountActions(data));

    wrap.appendChild(App.el("h2", "section-title", "Panel de demo (SIMULACIÓN)"));
    wrap.appendChild(App.el("p", "notice notice--info",
      "Estos controles no existen en un producto real: permiten recorrer todos los estados del prototipo sin tocar código."));
    var demoHost = App.el("div");
    wrap.appendChild(demoHost);
    renderDemoPanel(demoHost, data, platformHost);

    mount.appendChild(wrap);
  }

  /* ---- Preferencias -------------------------------------------------------- */

  function buildPreferences(data) {
    var host = App.el("div", "refblock");
    var user = data.user;

    var groups = [
      { key: "objetivo", label: "Objetivo", options: ["Ganar músculo", "Mejorar resistencia", "Mantener forma", "Rendimiento combinado"] },
      { key: "duracionHabitual", label: "Duración habitual de sesión", options: ["20 min", "40 min", "60 min", "90+ min"] },
      { key: "unidades", label: "Unidades", options: ["kg", "lb"] }
    ];

    groups.forEach(function (g) {
      host.appendChild(App.el("p", "field__label", g.label));
      var group = App.el("div", "picker");
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", g.label);
      g.options.forEach(function (opt) {
        var b = App.el("button", "picker__btn", opt);
        b.type = "button";
        b.setAttribute("aria-pressed", String(user[g.key] === opt));
        b.addEventListener("click", function () {
          user[g.key] = opt;
          Array.prototype.forEach.call(group.children, function (c) { c.setAttribute("aria-pressed", "false"); });
          b.setAttribute("aria-pressed", "true");
        });
        group.appendChild(b);
      });
      host.appendChild(group);
    });

    var saveBtn = App.el("button", "btn btn--primary btn--sm", "Guardar preferencias");
    saveBtn.type = "button";
    saveBtn.addEventListener("click", function () { App.persist(); App.toast("Preferencias guardadas."); });
    host.appendChild(saveBtn);
    return host;
  }

  /* ---- Seguridad: cambio de contraseña simulado + recuperación ----------- */

  function buildSecurity(data) {
    var host = App.el("div", "refblock");

    var changeBtn = App.el("button", "btn btn--ghost btn--block", "Cambiar contraseña (simulado)");
    changeBtn.type = "button";
    changeBtn.addEventListener("click", function () { openPasswordSheet(data); });
    host.appendChild(changeBtn);

    var recoverBtn = App.el("button", "btn btn--ghost btn--block", "Solicitar recuperación de acceso (simulado)");
    recoverBtn.type = "button";
    recoverBtn.addEventListener("click", function () {
      App.openSheet({
        title: "Recuperación de acceso",
        render: function (body) {
          body.appendChild(App.el("p", "lede small",
            "Simulado: no se envía ningún correo real. Si " + (data.user.email || "tu correo") +
            " tuviera una cuenta, recibirías instrucciones para restablecer el acceso."));
          var okBtn = App.el("button", "btn btn--primary btn--block", "Entendido");
          okBtn.type = "button";
          okBtn.addEventListener("click", function () { App.closeSheet(); });
          body.appendChild(okBtn);
        }
      });
    });
    host.appendChild(recoverBtn);
    return host;
  }

  function openPasswordSheet(data) {
    App.openSheet({
      title: "Cambiar contraseña (simulado)",
      render: function (body) {
        var fields = {};
        [
          ["pwCurrent", "Contraseña actual", "password"],
          ["pwNew", "Nueva contraseña", "password"],
          ["pwConfirm", "Confirmar nueva contraseña", "password"]
        ].forEach(function (spec) {
          var wrap = App.el("div", "field");
          var label = App.el("label", "field__label", spec[1]);
          label.setAttribute("for", spec[0]);
          wrap.appendChild(label);
          var input = document.createElement("input");
          input.type = spec[2]; input.id = spec[0];
          wrap.appendChild(input);
          var error = App.el("p", "field__error", "");
          error.id = spec[0] + "Error"; error.hidden = true; error.setAttribute("role", "alert");
          wrap.appendChild(error);
          body.appendChild(wrap);
          fields[spec[0]] = { input: input, error: error };
        });

        function setError(key, msg) {
          fields[key].error.textContent = msg;
          fields[key].error.hidden = false;
          fields[key].input.setAttribute("aria-invalid", "true");
          fields[key].input.setAttribute("aria-describedby", key + "Error");
        }
        function clearError(key) {
          fields[key].error.hidden = true;
          fields[key].input.removeAttribute("aria-invalid");
          fields[key].input.removeAttribute("aria-describedby");
        }

        var saveBtn = App.el("button", "btn btn--primary btn--block", "Actualizar contraseña");
        saveBtn.type = "button";
        saveBtn.addEventListener("click", function () {
          ["pwCurrent", "pwNew", "pwConfirm"].forEach(clearError);
          var current = fields.pwCurrent.input.value;
          var next = fields.pwNew.input.value;
          var confirm = fields.pwConfirm.input.value;
          var firstInvalid = null;

          if (current !== data.user.password) { setError("pwCurrent", "La contraseña actual no coincide."); firstInvalid = firstInvalid || "pwCurrent"; }
          if (next.length < 6) { setError("pwNew", "La nueva contraseña necesita al menos 6 caracteres."); firstInvalid = firstInvalid || "pwNew"; }
          if (confirm !== next) { setError("pwConfirm", "No coincide con la nueva contraseña."); firstInvalid = firstInvalid || "pwConfirm"; }

          if (firstInvalid) { fields[firstInvalid].input.focus(); return; }

          data.user.password = next;
          App.persist();
          App.closeSheet();
          App.toast("Contraseña actualizada (simulado).");
        });
        body.appendChild(saveBtn);
      }
    });
  }

  /* ---- Datos y privacidad: consentimiento --------------------------------- */

  function buildPrivacy(data) {
    var host = App.el("div", "refblock");
    var user = data.user;
    host.appendChild(App.el("p", "field__label", "Consentimiento"));
    host.appendChild(App.el("p", "small",
      user.consentimiento.aceptado
        ? "Aceptado el " + (user.consentimiento.fecha || "—") + "."
        : "Todavía no has dado tu consentimiento."));

    var detailBtn = App.el("button", "btn btn--quiet", "Ver qué está en el dispositivo y qué se sincronizaría");
    detailBtn.type = "button";
    detailBtn.addEventListener("click", function () {
      App.openSheet({
        title: "Qué se guarda y qué se sincronizaría",
        render: function (body) {
          body.appendChild(App.el("p", "lede small", "En este dispositivo (local): tu perfil, tu plan activo, tus sesiones registradas, tus métricas personales y tu estado de check-in."));
          body.appendChild(App.el("p", "lede small", "Se sincronizaría (simulado, sin red real aquí): lo mismo, para que puedas recuperarlo si cambias de dispositivo."));
          body.appendChild(App.el("p", "lede small", "No se comparte con terceros ni se usa con fines distintos a mostrarte tu propio entrenamiento."));

          var label = document.createElement("label");
          label.className = "checkrow";
          var checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = user.consentimiento.aceptado;
          label.appendChild(checkbox);
          label.appendChild(App.el("span", null, "Acepto que se guarden estos datos en el dispositivo y, si hubiera cuenta real, se sincronicen para mi propio uso."));
          body.appendChild(label);

          var updateBtn = App.el("button", "btn btn--primary btn--block", "Actualizar consentimiento");
          updateBtn.type = "button";
          updateBtn.addEventListener("click", function () {
            user.consentimiento = { aceptado: checkbox.checked, fecha: "Hoy" };
            App.persist();
            App.closeSheet();
            App.toast("Consentimiento actualizado.");
            App.navigate("profile", {}, { replace: true });
          });
          body.appendChild(updateBtn);
        }
      });
    });
    host.appendChild(detailBtn);
    return host;
  }

  /* ---- Plataforma: instalación y actualización simuladas de la PWA ------- */

  function renderPlatform(host, data) {
    host.innerHTML = "";
    var pwa = data.PWA;

    var installCard = App.el("div", "refblock");
    if (pwa.instalada) {
      installCard.appendChild(App.el("p", "state state--sim", "Instalada (simulado)"));
      installCard.appendChild(App.el("p", "small", "Sin Service Worker real ni manifiesto funcional: es una simulación de estado."));
    } else if (!pwa.promptDismissed) {
      installCard.appendChild(App.el("p", "field__label", "Instalar la app (simulado)"));
      installCard.appendChild(App.el("p", "small", "Instálala para abrirla como una app independiente. Sin Service Worker real en este prototipo."));
      var acceptBtn = App.el("button", "btn btn--primary btn--sm", "Instalar");
      acceptBtn.type = "button";
      acceptBtn.addEventListener("click", function () {
        pwa.instalada = true;
        App.persist();
        App.toast("App instalada (simulado).");
        renderPlatform(host, data);
      });
      installCard.appendChild(acceptBtn);
      var stayBtn = App.el("button", "btn btn--ghost btn--sm", "Seguir en la web");
      stayBtn.type = "button";
      stayBtn.addEventListener("click", function () {
        pwa.promptDismissed = true;
        App.toast("Seguirás usando la versión web.");
        renderPlatform(host, data);
      });
      installCard.appendChild(stayBtn);
    } else {
      installCard.appendChild(App.el("p", "small", "Sigues en la versión web (simulado)."));
    }
    host.appendChild(installCard);

    var updateCard = App.el("div", "refblock");
    if (pwa.updateDisponible) {
      updateCard.appendChild(App.el("p", "notice notice--info", "Hay una versión nueva disponible (simulado)."));
      var updateBtn = App.el("button", "btn btn--primary btn--sm", "Actualizar ahora");
      updateBtn.type = "button";
      updateBtn.addEventListener("click", function () {
        pwa.updateDisponible = false;
        App.persist();
        App.toast("App actualizada (simulado).");
        renderPlatform(host, data);
      });
      updateCard.appendChild(updateBtn);
    } else {
      updateCard.appendChild(App.el("p", "small", "La app está al día (simulado)."));
    }
    host.appendChild(updateCard);
  }

  /* ---- Cuenta: cerrar sesión y eliminar cuenta ---------------------------- */

  function buildAccountActions(data) {
    var host = App.el("div", "refblock");

    var signOutBtn = App.el("button", "btn btn--ghost btn--block", "Cerrar sesión");
    signOutBtn.type = "button";
    signOutBtn.addEventListener("click", function () {
      App.openSheet({
        title: "Cerrar sesión",
        render: function (body) {
          body.appendChild(App.el("p", "lede small", "¿Quieres conservar tus datos locales en este dispositivo o borrarlos al cerrar sesión?"));
          var keepBtn = App.el("button", "btn btn--primary btn--block", "Cerrar sesión y conservar datos");
          keepBtn.type = "button";
          keepBtn.addEventListener("click", function () {
            data.auth.estado = "anonimo";
            App.persist();
            App.closeSheet();
            App.navigate("access", {}, { replace: true });
            App.toast("Sesión cerrada. Tus datos locales se conservan.");
          });
          body.appendChild(keepBtn);
          var wipeBtn = App.el("button", "btn btn--ghost btn--block", "Cerrar sesión y borrar datos locales");
          wipeBtn.type = "button";
          wipeBtn.addEventListener("click", function () {
            App.closeSheet();
            App.reset();
          });
          body.appendChild(wipeBtn);
        }
      });
    });
    host.appendChild(signOutBtn);

    if (data.user.deletionRequested) {
      host.appendChild(App.el("p", "notice notice--warn",
        "Solicitud de borrado registrada el " + data.user.deletionRequested + ". No es un borrado instantáneo: tu cuenta permanece visible mientras se procesa."));
    } else {
      var deleteBtn = App.el("button", "btn btn--ghost btn--block", "Solicitar borrado de cuenta");
      deleteBtn.type = "button";
      deleteBtn.addEventListener("click", function () {
        App.openSheet({
          title: "Solicitar borrado de cuenta",
          render: function (body) {
            body.appendChild(App.el("p", "notice notice--warn",
              "Esto registra una solicitud de borrado; no es instantáneo ni silencioso. Simulado: no se borra ningún dato real."));
            var label = document.createElement("label");
            label.className = "checkrow";
            var checkbox = document.createElement("input");
            checkbox.type = "checkbox"; checkbox.id = "confirmDeletion";
            label.appendChild(checkbox);
            label.appendChild(App.el("span", null, "Entiendo que esto es una solicitud de borrado, no un borrado inmediato."));
            body.appendChild(label);

            var confirmBtn = App.el("button", "btn btn--primary btn--block", "Confirmar solicitud");
            confirmBtn.type = "button";
            confirmBtn.addEventListener("click", function () {
              if (!checkbox.checked) { App.toast("Marca la casilla para confirmar la solicitud."); return; }
              data.user.deletionRequested = "Hoy";
              App.persist();
              App.closeSheet();
              App.toast("Solicitud de borrado registrada.");
              App.navigate("profile", {}, { replace: true });
            });
            body.appendChild(confirmBtn);
          }
        });
      });
      host.appendChild(deleteBtn);
    }
    return host;
  }

  /* ---- Panel de demo: sincronización, estados forzados, PWA, reinicio ---- */

  function renderDemoPanel(host, data, platformHost) {
    host.innerHTML = "";

    host.appendChild(App.el("p", "field__label", "Estado de sincronización"));
    var syncGroup = App.el("div", "picker picker--wide");
    syncGroup.setAttribute("role", "group");
    syncGroup.setAttribute("aria-label", "Forzar estado de sincronización");
    [
      ["local", "Sin conexión"], ["sincronizando", "Sincronizando"], ["sincronizado", "Sincronizado"],
      ["conflicto", "Conflicto"], ["error", "Error recuperable"]
    ].forEach(function (pair) {
      var b = App.el("button", "picker__btn", pair[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", String(App.sync.get() === pair[0]));
      b.addEventListener("click", function () {
        App.sync.set(pair[0]);
        Array.prototype.forEach.call(syncGroup.children, function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        App.toast("Sincronización simulada: " + pair[1] + ".");
      });
      syncGroup.appendChild(b);
    });
    host.appendChild(syncGroup);

    var histCtx = App.viewContext("history");

    var emptyBtn = App.el("button", "btn btn--ghost btn--block", "Forzar historial de métricas vacío");
    emptyBtn.type = "button";
    emptyBtn.setAttribute("aria-pressed", String(!!histCtx.forceEmpty));
    emptyBtn.addEventListener("click", function () {
      histCtx.forceEmpty = !histCtx.forceEmpty;
      emptyBtn.setAttribute("aria-pressed", String(!!histCtx.forceEmpty));
      App.toast(histCtx.forceEmpty ? "Historial de métricas forzado a vacío. Ve a Historial → Métricas." : "Vacío forzado desactivado.");
    });
    host.appendChild(emptyBtn);

    var errorBtn = App.el("button", "btn btn--ghost btn--block", "Forzar error en historial");
    errorBtn.type = "button";
    errorBtn.setAttribute("aria-pressed", String(!!histCtx.forceError));
    errorBtn.addEventListener("click", function () {
      histCtx.forceError = !histCtx.forceError;
      errorBtn.setAttribute("aria-pressed", String(!!histCtx.forceError));
      App.toast(histCtx.forceError ? "Error forzado. Ve a Historial." : "Error forzado desactivado.");
    });
    host.appendChild(errorBtn);

    var reinstallBtn = App.el("button", "btn btn--ghost btn--block", "Restablecer prompt de instalación");
    reinstallBtn.type = "button";
    reinstallBtn.addEventListener("click", function () {
      data.PWA.instalada = false;
      data.PWA.promptDismissed = false;
      App.toast("Vuelve a aparecer la invitación a instalar.");
      renderPlatform(platformHost, data);
    });
    host.appendChild(reinstallBtn);

    var updateAgainBtn = App.el("button", "btn btn--ghost btn--block", "Simular nueva actualización disponible");
    updateAgainBtn.type = "button";
    updateAgainBtn.addEventListener("click", function () {
      data.PWA.updateDisponible = true;
      App.toast("Hay una nueva actualización disponible (simulado).");
      renderPlatform(platformHost, data);
    });
    host.appendChild(updateAgainBtn);

    var resetBtn = App.el("button", "btn btn--ghost btn--block", "Reiniciar demo");
    resetBtn.type = "button";
    resetBtn.addEventListener("click", function () { App.reset(); });
    host.appendChild(resetBtn);
  }

  App.registerView("profile", { title: "Perfil", render: render });
})();
