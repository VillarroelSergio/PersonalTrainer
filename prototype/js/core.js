/* =====================================================================
 * Trainer — núcleo (LOTE 1)
 * Namespace global App: router, DOM helpers, hojas modales, estados
 * transversales, sincronización simulada y persistencia local.
 * Sin módulos ES, sin fetch: script clásico para que funcione con file://.
 * ================================================================== */
(function () {
  "use strict";

  var App = (window.App = window.App || {});

  var STORAGE_KEY = "trainer-demo-v3";

  // Los 4 destinos de la navegación principal (bottomnav). "Entrenar" no es
  // un destino: es una acción contextual (desde Hoy, Plan o el check-in)
  // que navega a la vista "train", que por eso queda fuera de esta lista y
  // oculta el bottomnav mientras está activa, igual que "endurance" o
  // "checkin".
  var NAV_DESTINATIONS = ["home", "plan", "library", "history"];

  /* =====================================================================
   * Helpers DOM
   * ================================================================== */

  App.$ = function (id) { return document.getElementById(id); };

  App.el = function (tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  /* =====================================================================
   * Toast — aviso no intrusivo
   * ================================================================== */

  App.toast = function (message) {
    var toast = App.$("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(App.toast._t);
    App.toast._t = window.setTimeout(function () { toast.hidden = true; }, 2800);
  };

  /* =====================================================================
   * Router
   * ================================================================== */

  var views = {};
  var navStack = []; // {name, params}
  var contexts = {}; // contexto persistente por vista (filtros, día abierto, etc.)
  var currentView = null;

  App.registerView = function (name, def) {
    views[name] = def;
  };

  App.viewContext = function (name) {
    if (!contexts[name]) contexts[name] = {};
    return contexts[name];
  };

  function updateNav(name) {
    var nav = App.$("mainNav");
    var buttons = document.querySelectorAll(".bottomnav__btn");
    var isDestination = NAV_DESTINATIONS.indexOf(name) >= 0;
    // "bare" es el criterio explícito de una vista para ocultar el chrome
    // (acceso, recuperación, consentimiento y onboarding viven todos dentro
    // de la vista "access" con chrome: "bare"). No basta con mirar si el
    // nombre está fuera de NAV_DESTINATIONS: eso es un accidente de que hoy
    // solo hay una vista así, no una regla declarada.
    var def = views[name];
    var isBare = !!(def && def.chrome === "bare");
    for (var i = 0; i < buttons.length; i++) {
      if (isDestination && buttons[i].getAttribute("data-nav") === name) {
        buttons[i].setAttribute("aria-current", "page");
      } else {
        buttons[i].removeAttribute("aria-current");
      }
    }
    if (nav) nav.hidden = !isDestination || isBare;

    // Toda vista que no sea un destino de navegación (sesión de fuerza o
    // resistencia, check-in, importar, recuperación, compartir…) oculta el
    // bottomnav y por tanto pierde su única salida. #btnBack vive en la
    // cabecera fija (.topbar es sticky) para que siempre haya un "Volver"
    // visible sin depender de hacer scroll. Las vistas "bare" (acceso/
    // onboarding) no lo muestran: ya gestionan su propia salida.
    var back = App.$("btnBack");
    if (back) back.hidden = isDestination || isBare;
  }

  function focusViewTitle(mount) {
    var h1 = mount.querySelector("h1");
    if (!h1) return;
    if (!h1.hasAttribute("tabindex")) h1.setAttribute("tabindex", "-1");
    h1.focus();
  }

  App.navigate = function (name, params, opts) {
    opts = opts || {};
    var mount = App.$("mainContent");
    if (!mount) return;

    if (currentView && !opts.replace) {
      navStack.push({ name: currentView, params: currentParams });
      if (navStack.length > 20) navStack.shift();
    }

    currentView = name;
    currentParams = params || {};
    mount.innerHTML = "";

    var def = views[name];
    if (!def) {
      // Honesto en vez de romper: los lotes siguientes registrarán esta vista.
      // El fallback necesita su propio <h1> para cumplir el contrato de
      // navegación (el foco siempre va al título de la vista activa).
      var h1 = App.el("h1", "view-title", "Todavía no disponible");
      mount.appendChild(h1);
      var body = App.el("div");
      mount.appendChild(body);
      App.states.empty(body, {
        title: null,
        body: "Esta pantalla (“" + name + "”) llega en un lote posterior del prototipo.",
        actionLabel: "Volver a Tu camino",
        onAction: function () { App.navigate("home"); }
      });
      updateNav(name);
      window.scrollTo(0, 0);
      focusViewTitle(mount);
      return;
    }

    def.render(mount, currentParams);
    updateNav(name);
    window.scrollTo(0, 0);
    focusViewTitle(mount);
  };

  var currentParams = {};

  App.back = function () {
    var prev = navStack.pop();
    if (!prev) { App.navigate("home", {}, { replace: true }); return; }
    App.navigate(prev.name, prev.params, { replace: true });
  };

  /* =====================================================================
   * Estados transversales: cargando / vacío / error
   * ================================================================== */

  App.states = {
    loading: function (mount, opts) {
      opts = opts || {};
      mount.innerHTML = "";
      var wrap = App.el("div", "state-block state-block--loading");
      wrap.setAttribute("role", "status");
      wrap.setAttribute("aria-live", "polite");
      wrap.appendChild(App.el("p", "state-block__title", opts.title || "Cargando…"));
      if (opts.body) wrap.appendChild(App.el("p", "lede small", opts.body));
      mount.appendChild(wrap);
    },

    empty: function (mount, opts) {
      opts = opts || {};
      mount.innerHTML = "";
      var wrap = App.el("div", "state-block state-block--empty");
      if (opts.title !== null) wrap.appendChild(App.el("p", "state-block__title", opts.title || "Todavía no hay nada aquí"));
      if (opts.body) wrap.appendChild(App.el("p", "lede small", opts.body));
      if (opts.actionLabel && opts.onAction) {
        var btn = App.el("button", "btn btn--primary", opts.actionLabel);
        btn.type = "button";
        btn.addEventListener("click", opts.onAction);
        wrap.appendChild(btn);
      }
      mount.appendChild(wrap);
    },

    error: function (mount, opts) {
      opts = opts || {};
      mount.innerHTML = "";
      var wrap = App.el("div", "state-block state-block--error");
      wrap.setAttribute("role", "alert");
      wrap.appendChild(App.el("p", "state-block__title", opts.title || "Algo no ha funcionado"));
      if (opts.body) wrap.appendChild(App.el("p", "lede small", opts.body));
      var actions = App.el("div", "state-block__actions");
      if (opts.onRetry) {
        var retry = App.el("button", "btn btn--primary", opts.retryLabel || "Reintentar");
        retry.type = "button";
        retry.addEventListener("click", opts.onRetry);
        actions.appendChild(retry);
      }
      if (opts.onBack) {
        var back = App.el("button", "btn btn--ghost", opts.backLabel || "Volver");
        back.type = "button";
        back.addEventListener("click", opts.onBack);
        actions.appendChild(back);
      }
      wrap.appendChild(actions);
      mount.appendChild(wrap);
    }
  };

  /* =====================================================================
   * Hojas modales (App.openSheet / App.closeSheet / App.confirmSheet)
   * ================================================================== */

  var sheetRegistry = {};
  var lastFocusedEl = null;
  var sheetOpen = false;

  App.registerSheet = function (id, def) { sheetRegistry[id] = def; };

  function getFocusable(container) {
    var nodes = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(nodes, function (node) {
      return !node.disabled && node.offsetParent !== null;
    });
  }

  App.openSheet = function (idOrDef) {
    var def = typeof idOrDef === "string" ? sheetRegistry[idOrDef] : idOrDef;
    if (!def) return;

    var host = App.$("sheetHost");
    var title = App.$("sheetTitle");
    var body = App.$("sheetBody");
    if (!host || !title || !body) return;

    lastFocusedEl = document.activeElement;
    title.textContent = def.title || "";
    body.innerHTML = "";
    if (typeof def.render === "function") def.render(body);

    host.hidden = false;
    sheetOpen = true;

    // Foco inicial en el primer control del CUERPO, nunca en la ✕.
    var focusable = getFocusable(body);
    if (focusable.length) focusable[0].focus();
    else App.$("btnCloseSheet").focus();
  };

  App.closeSheet = function () {
    var host = App.$("sheetHost");
    if (!host || host.hidden) return;
    host.hidden = true;
    sheetOpen = false;

    var target = lastFocusedEl && lastFocusedEl.isConnected && lastFocusedEl !== document.body
      ? lastFocusedEl
      : null;
    if (!target) {
      target = document.querySelector("#mainContent h1");
      if (target && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    }
    if (target && typeof target.focus === "function") target.focus();
  };

  App.confirmSheet = function (opts) {
    opts = opts || {};
    App.openSheet({
      title: opts.title || "¿Confirmas la acción?",
      render: function (body) {
        if (opts.body) body.appendChild(App.el("p", "lede", opts.body));
        var confirmBtn = App.el("button", "btn btn--primary btn--block", opts.confirmLabel || "Confirmar");
        confirmBtn.type = "button";
        confirmBtn.addEventListener("click", function () {
          App.closeSheet();
          if (typeof opts.onConfirm === "function") opts.onConfirm();
        });
        body.appendChild(confirmBtn);

        var cancelBtn = App.el("button", "btn btn--ghost btn--block", opts.cancelLabel || "Cancelar");
        cancelBtn.type = "button";
        cancelBtn.addEventListener("click", function () { App.closeSheet(); });
        body.appendChild(cancelBtn);
      }
    });
  };

  function wireSheetChrome() {
    App.$("btnCloseSheet").addEventListener("click", App.closeSheet);
    App.$("sheetHost").addEventListener("click", function (e) {
      if (e.target === App.$("sheetHost")) App.closeSheet();
    });
    document.addEventListener("keydown", function (e) {
      if (!sheetOpen) return;
      if (e.key === "Escape") { App.closeSheet(); return; }
      if (e.key !== "Tab") return;
      var panel = App.$("sheetPanel");
      var focusable = getFocusable(panel);
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  /* =====================================================================
   * Sincronización simulada (notas 11 y 29)
   * ================================================================== */

  var SYNC_LABELS = {
    local: { text: "Sin conexión · simulado", icon: "○" },
    sincronizando: { text: "Sincronizando · simulado", icon: "↻" },
    sincronizado: { text: "Sincronizado · simulado", icon: "✓" },
    conflicto: { text: "Conflicto de versiones · simulado", icon: "!" },
    error: { text: "Error recuperable · simulado", icon: "×" }
  };

  var syncState = "local";

  App.sync = {
    get: function () { return syncState; },

    set: function (estado) {
      if (!SYNC_LABELS[estado]) return;
      syncState = estado;
      var info = SYNC_LABELS[estado];
      var btn = App.$("syncStatus");
      var pillText = App.$("syncStatusText");
      var pillIcon = App.$("syncStatusIcon");
      var dot = document.querySelector(".sync-dot");
      // Sin texto permanente en la cabecera (Lote 2): solo icono y punto de
      // estado, siempre visibles. El aria-label + title del control llevan
      // el estado completo para lector de pantalla y hover. `pillText` ya
      // no existe en el DOM; el guard de abajo es solo por si algún markup
      // antiguo lo reintroduce.
      if (pillText) pillText.textContent = info.text;
      if (pillIcon) pillIcon.textContent = info.icon;
      if (dot) dot.setAttribute("data-state", estado);
      if (btn) {
        btn.setAttribute("aria-label", "Estado de sincronización: " + info.text);
        btn.title = info.text;
      }
      App.persist();
    }
  };

  function openSyncSheet() {
    App.openSheet({
      title: "Estado de sincronización (simulado)",
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          "En este prototipo no hay red real. Puedes cambiar el estado a mano para ver cómo se comunica."));

        if (syncState === "conflicto") {
          body.appendChild(App.el("p", "notice notice--warn",
            "Hay una versión distinta en el dispositivo y en el servidor (simulado). Elige cuál conservar."));
          var keepLocal = App.el("button", "btn btn--primary btn--block", "Conservar versión local");
          keepLocal.type = "button";
          keepLocal.addEventListener("click", function () {
            App.sync.set("sincronizado");
            App.closeSheet();
            App.toast("Conservada la versión local (simulado).");
          });
          body.appendChild(keepLocal);

          var keepServer = App.el("button", "btn btn--ghost btn--block", "Conservar versión del servidor");
          keepServer.type = "button";
          keepServer.addEventListener("click", function () {
            App.sync.set("sincronizado");
            App.closeSheet();
            App.toast("Conservada la versión del servidor (simulado).");
          });
          body.appendChild(keepServer);
          return;
        }

        Object.keys(SYNC_LABELS).forEach(function (key) {
          var btn = App.el("button", "opt" + (key === syncState ? " is-current" : ""));
          btn.type = "button";
          btn.appendChild(App.el("span", "opt__name", SYNC_LABELS[key].icon + " " + SYNC_LABELS[key].text));
          btn.addEventListener("click", function () {
            App.sync.set(key);
            App.closeSheet();
            App.toast("Estado cambiado a: " + SYNC_LABELS[key].text);
          });
          body.appendChild(btn);
        });
      }
    });
  }

  /* =====================================================================
   * Reinicio de la demo
   * ================================================================== */

  App.reset = function () {
    App.confirmSheet({
      title: "Reiniciar demo",
      body: "Esto borra los datos guardados en este dispositivo (simulado) y vuelve al estado inicial del prototipo.",
      confirmLabel: "Reiniciar",
      cancelLabel: "Cancelar",
      onConfirm: function () {
        try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* file:// puede fallar; seguimos en memoria */ }
        App.data = App.dataDefaults();
        contexts = {};
        navStack = [];
        App.sync.set("local");
        App.navigate("access", {}, { replace: true });
        App.toast("Demo reiniciada.");
      }
    });
  };

  function openProfileSheet() {
    App.openSheet({
      title: "Perfil y demo",
      render: function (body) {
        var user = App.data.user;
        if (App.data.auth.estado === "autenticado") {
          body.appendChild(App.el("p", "lede small", (user.email || "Cuenta de demostración")));
          body.appendChild(App.el("p", "lede small", user.objetivo + " · " + user.experiencia));
        } else {
          body.appendChild(App.el("p", "lede small", "Todavía no has iniciado sesión en esta demo."));
        }

        if (App.data.auth.estado === "autenticado") {
          var signOut = App.el("button", "btn btn--ghost btn--block", "Cerrar sesión (simulado)");
          signOut.type = "button";
          signOut.addEventListener("click", function () {
            App.data.auth.estado = "anonimo";
            App.persist();
            App.closeSheet();
            App.navigate("access", {}, { replace: true });
            App.toast("Sesión cerrada (simulado).");
          });
          body.appendChild(signOut);
        }

        var resetBtn = App.el("button", "btn btn--ghost btn--block", "Reiniciar demo");
        resetBtn.type = "button";
        resetBtn.addEventListener("click", function () {
          App.closeSheet();
          App.reset();
        });
        body.appendChild(resetBtn);
      }
    });
  }

  /* =====================================================================
   * Persistencia local (simulación de recuperación local)
   * ================================================================== */

  App.persist = function () {
    try {
      var snapshot = {
        data: App.data,
        sync: syncState,
        theme: document.documentElement.getAttribute("data-theme") || "dark"
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      // Bajo file:// u otras restricciones el almacenamiento puede fallar:
      // el prototipo sigue funcionando en memoria.
    }
  };

  // Las versiones nuevas del prototipo añaden campos al dataset de demostración
  // (por ejemplo, deporte y entornos del onboarding). Un snapshot de
  // localStorage creado por una versión anterior no los conoce. Antes de
  // reenganchar los helpers, completamos únicamente las claves ausentes para
  // conservar el progreso local ya registrado.
  function hydrateMissingData(saved, defaults) {
    if (saved === undefined || saved === null) return defaults;
    if (defaults === null || typeof defaults !== "object") return saved;
    if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
    if (typeof saved !== "object" || Array.isArray(saved)) return defaults;

    Object.keys(defaults).forEach(function (key) {
      if (saved[key] === undefined || saved[key] === null) {
        saved[key] = defaults[key];
      } else {
        saved[key] = hydrateMissingData(saved[key], defaults[key]);
      }
    });
    return saved;
  }

  App.load = function () {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var snapshot = JSON.parse(raw);
      if (!snapshot || !snapshot.data) return false;
      App.data = App._attachDataHelpers(hydrateMissingData(snapshot.data, App.dataDefaults()));
      // ---- onboarding-guiado-010 (corrección): un snapshot antiguo tiene
      // `edad` pero no `birthDate` (hydrateMissingData solo rellena claves
      // ausentes con null, no puede inventar una fecha). Aproximamos una
      // fecha de nacimiento compatible (1 de enero del año deducido) para
      // que la persona pueda seguir editando su perfil por rueda de fecha
      // sin perder el punto de partida ya declarado.
      if (App.data.user && App.data.user.birthDate === null && App.data.user.edad) {
        var approxYear = new Date().getFullYear() - App.data.user.edad;
        App.data.user.birthDate = approxYear + "-01-01";
      }
      if (snapshot.theme === "light") document.documentElement.setAttribute("data-theme", "light");
      if (snapshot.sync) syncState = snapshot.sync;
      return true;
    } catch (e) {
      return false;
    }
  };

  /* =====================================================================
   * Tema
   * ================================================================== */

  function wireTheme() {
    App.$("themeToggle").addEventListener("click", function () {
      var root = document.documentElement;
      var toLight = root.getAttribute("data-theme") !== "light";
      if (toLight) {
        root.setAttribute("data-theme", "light");
        App.$("themeToggle").setAttribute("aria-pressed", "true");
        App.$("themeToggle").setAttribute("aria-label", "Cambiar a modo oscuro");
      } else {
        root.removeAttribute("data-theme");
        App.$("themeToggle").setAttribute("aria-pressed", "false");
        App.$("themeToggle").setAttribute("aria-label", "Cambiar a modo claro");
      }
      App.persist();
    });
  }

  /* =====================================================================
   * Navegación principal (bottomnav) + arranque
   * ================================================================== */

  function wireNav() {
    var buttons = document.querySelectorAll(".bottomnav__btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function (e) {
        App.navigate(e.currentTarget.getAttribute("data-nav"));
      });
    }
    App.$("syncStatus").addEventListener("click", openSyncSheet);
    App.$("btnProfile").addEventListener("click", openProfileSheet);
  }

  // #btnBack es la única salida de una vista sin bottomnav (sesión, check-in,
  // importar…). Escape hace lo mismo que pulsarlo, salvo que haya una hoja
  // modal abierta encima: en ese caso Escape la cierra a ella primero
  // (wireSheetChrome ya cubre ese caso y hace `return` antes de llegar aquí).
  function wireBack() {
    App.$("btnBack").addEventListener("click", App.back);
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || sheetOpen) return;
      if (!App.$("btnBack").hidden) App.back();
    });
  }

  App.start = function () {
    wireSheetChrome();
    wireNav();
    wireBack();
    wireTheme();
    App.load();
    App.sync.set(App.sync.get());

    var initial = (App.data.auth.estado === "autenticado" && App.data.plan) ? "home" : "access";
    App.navigate(initial, {}, { replace: true });
  };
})();
