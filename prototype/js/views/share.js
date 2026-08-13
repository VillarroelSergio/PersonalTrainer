/* =====================================================================
 * Vista: Compartir rutina (LOTE 6). Nota 10.
 * Enlace SIMULADO (texto, sin red). Copia independiente desde el primer
 * momento: adaptar la copia no toca el original, y viceversa.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  function render(mount) {
    var data = App.data;
    var wrap = App.el("section", "view-share");
    wrap.appendChild(App.el("h1", "view-title", "Compartir rutina"));
    wrap.appendChild(App.el("p", "lede small",
      "Comparte tu plan como una plantilla; quien la abra crea una copia independiente. " +
      "Sin colaboración en tiempo real ni actualizaciones automáticas."));

    wrap.appendChild(App.el("h2", "section-title", "Tu rutina original"));
    var origHost = App.el("div", "refblock");
    wrap.appendChild(origHost);
    renderOriginal(origHost, data);

    wrap.appendChild(App.el("h2", "section-title", "Generar enlace de copia"));
    wrap.appendChild(App.el("p", "lede small", "Elige qué se comparte antes de generar el enlace."));

    var scope = { estructura: true, notas: true, ejercicios: true };
    var scopeGroup = App.el("div", "picker picker--wide");
    scopeGroup.setAttribute("role", "group");
    scopeGroup.setAttribute("aria-label", "Qué se comparte");
    [["estructura", "Estructura del plan"], ["notas", "Notas permitidas"], ["ejercicios", "Ejercicios y variantes"]].forEach(function (pair) {
      var b = App.el("button", "picker__btn", pair[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", function () {
        scope[pair[0]] = !scope[pair[0]];
        b.setAttribute("aria-pressed", String(scope[pair[0]]));
      });
      scopeGroup.appendChild(b);
    });
    wrap.appendChild(scopeGroup);

    // ---- LOTE 4: cargas personales, desactivadas por defecto (nota 10 /
    // MVP-DEFINITION.md §12: la copia parte con su propia carga; el original
    // NO se comparte por defecto). Selector aparte de las 3 pills de arriba
    // porque su valor por defecto es el opuesto (desactivado, no activado).
    var cargasLabel = document.createElement("label");
    cargasLabel.className = "checkrow";
    var cargasInput = document.createElement("input");
    cargasInput.type = "checkbox";
    cargasInput.id = "shareCargasToggle";
    cargasInput.checked = false;
    cargasLabel.appendChild(cargasInput);
    cargasLabel.appendChild(App.el("span", null, "Incluir cargas solo como referencia"));
    wrap.appendChild(cargasLabel);

    var privacyNote = App.el("p", "notice notice--info");
    privacyNote.id = "shareCargasPrivacy";
    updatePrivacyNote(privacyNote, cargasInput.checked);
    cargasInput.addEventListener("change", function () { updatePrivacyNote(privacyNote, cargasInput.checked); });
    wrap.appendChild(privacyNote);

    var generateBtn = App.el("button", "btn btn--primary btn--block", "Generar enlace (simulado)");
    generateBtn.type = "button";
    generateBtn.addEventListener("click", function () {
      var link = data.generateShareLink(scope);
      // data.generateShareLink (fuera de este lote) solo guarda estructura/
      // notas/ejercicios; añadimos aquí el campo "cargas" al objeto ya
      // devuelto, sin tocar js/data.js.
      link.scope.cargas = !!cargasInput.checked;
      App.toast(link.scope.cargas
        ? "Enlace simulado generado. Incluye tus cargas como referencia."
        : "Enlace simulado generado. No incluye tus cargas personales.");
      App.navigate("share", {}, { replace: true });
    });
    wrap.appendChild(generateBtn);

    wrap.appendChild(App.el("h2", "section-title", "Enlaces generados"));
    var linksHost = App.el("div");
    wrap.appendChild(linksHost);
    renderLinks(linksHost, data);

    wrap.appendChild(App.el("h2", "section-title", "Copias creadas"));
    var copiesHost = App.el("div");
    wrap.appendChild(copiesHost);
    renderCopies(copiesHost, data);

    mount.appendChild(wrap);
  }

  function updatePrivacyNote(el, includeCargas) {
    el.textContent = includeCargas
      ? "Se enviará: estructura del plan, ejercicios/variantes, notas permitidas y tus cargas actuales como referencia orientativa. " +
        "Quien reciba la copia podrá ver esos pesos, pero no tienen por qué usarlos: siguen siendo solo una referencia."
      : "Se enviará: estructura del plan, ejercicios/variantes y notas permitidas. NO se envían tus cargas personales: " +
        "quien reciba la copia empieza con su propio registro, desde cero.";
  }

  // Etiqueta explícita para no confundir el enlace simulado con una URL real.
  function buildSimLinkBlock(enlace) {
    var box = App.el("div");
    var code = App.el("p", "small mono", enlace);
    box.appendChild(code);
    box.appendChild(App.el("p", "small", "Enlace simulado de este prototipo, no una dirección real que se pueda abrir."));
    return box;
  }

  var SCOPE_LABEL = { estructura: "Estructura", notas: "Notas", ejercicios: "Ejercicios y variantes" };

  function scopeSummary(scope) {
    var parts = Object.keys(SCOPE_LABEL).filter(function (k) { return scope[k]; }).map(function (k) { return SCOPE_LABEL[k]; });
    parts.push(scope.cargas ? "cargas (solo referencia)" : "sin cargas personales");
    return parts.join(", ");
  }

  function renderOriginal(host, data) {
    host.innerHTML = "";
    var o = data.SHARE_ORIGINAL;
    host.appendChild(App.el("p", "field__label", "Calendario"));
    host.appendChild(App.el("p", "small", o.calendario.map(function (c) { return c.dia + ": " + c.sesion; }).join(" · ")));
    host.appendChild(App.el("p", "field__label", "Cargas de referencia"));
    host.appendChild(App.el("p", "small", Object.keys(o.cargas).map(function (k) { return k + ": " + o.cargas[k] + " kg"; }).join(" · ")));

    var adaptBtn = App.el("button", "btn btn--ghost btn--sm", "Adaptar el original (simulado)");
    adaptBtn.type = "button";
    adaptBtn.addEventListener("click", function () {
      var key = "Jalón en polea";
      var nueva = Math.round((o.cargas[key] + 2.5) * 2) / 2;
      data.adaptOriginalLoad(key, nueva);
      App.toast("Original adaptado: " + key + " ahora en " + nueva + " kg. Las copias ya creadas no cambian.");
      renderOriginal(host, data);
    });
    host.appendChild(adaptBtn);
  }

  function renderLinks(host, data) {
    host.innerHTML = "";
    if (!data.SHARED_ROUTINES.length) {
      App.states.empty(host, { title: "Todavía no has generado ningún enlace" });
      return;
    }
    var list = App.el("ul", "catalog-list");
    data.SHARED_ROUTINES.forEach(function (link) {
      var li = App.el("li", "catalog-card");
      var top = App.el("div", "catalog-card__top");
      var body = App.el("div", "catalog-card__body");
      body.appendChild(buildSimLinkBlock(link.enlace));
      body.appendChild(App.el("p", "catalog-card__meta",
        "Incluye: " + scopeSummary(link.scope) + " · " + link.creadoEl));
      top.appendChild(body);
      top.appendChild(App.el("span", "state " + (link.estado === "activo" ? "state--activo" : "state--archivado"),
        link.estado === "activo" ? "Activo" : "Revocado"));
      li.appendChild(top);

      var actions = App.el("div", "dayrow__actions");
      var previewBtn = App.el("button", "chip", "Vista previa");
      previewBtn.type = "button";
      previewBtn.addEventListener("click", function () { openPreviewSheet(link, data, host); });
      actions.appendChild(previewBtn);

      if (link.estado === "activo") {
        var revokeBtn = App.el("button", "chip", "Revocar enlace");
        revokeBtn.type = "button";
        revokeBtn.addEventListener("click", function () {
          App.confirmSheet({
            title: "Revocar enlace",
            body: "Nadie podrá crear copias nuevas con este enlace. Las copias que ya existan NO se borran.",
            confirmLabel: "Revocar",
            cancelLabel: "Cancelar",
            onConfirm: function () {
              data.revokeShareLink(link.id);
              App.toast("Enlace revocado. Las copias existentes siguen intactas.");
              renderLinks(host, data);
            }
          });
        });
        actions.appendChild(revokeBtn);
      } else {
        actions.appendChild(App.el("p", "small", "Revocado: ya no admite copias nuevas."));
      }
      li.appendChild(actions);
      list.appendChild(li);
    });
    host.appendChild(list);
  }

  function openPreviewSheet(link, data, linksHost) {
    App.openSheet({
      title: "Vista previa del enlace",
      render: function (body) {
        body.appendChild(buildSimLinkBlock(link.enlace));
        body.appendChild(App.el("p", "notice notice--info",
          "Crear una copia genera un plan independiente con su propio calendario e historial desde el primer momento."));
        body.appendChild(App.el("p", "field__label", "Incluye"));
        var tags = App.el("div", "tags");
        Object.keys(SCOPE_LABEL).forEach(function (k) {
          if (link.scope[k]) tags.appendChild(App.el("span", "tag", SCOPE_LABEL[k]));
        });
        tags.appendChild(App.el("span", "tag" + (link.scope.cargas ? "" : " tag--muted"),
          link.scope.cargas ? "Cargas (solo referencia)" : "Sin cargas personales"));
        body.appendChild(tags);
        body.appendChild(App.el("p", "small", link.scope.cargas
          ? "Quien reciba la copia verá tus cargas actuales como referencia orientativa, editable desde el primer momento."
          : "Quien reciba la copia NO verá tus cargas: empieza su propio registro desde cero."));
        body.appendChild(App.el("p", "field__label", "Calendario que vería el receptor"));
        body.appendChild(App.el("p", "small", data.SHARE_ORIGINAL.calendario.map(function (c) { return c.dia + ": " + c.sesion; }).join(" · ")));

        if (link.estado !== "activo") {
          body.appendChild(App.el("p", "notice notice--warn", "Este enlace está revocado: no se pueden crear copias nuevas desde aquí."));
          return;
        }

        var createBtn = App.el("button", "btn btn--primary btn--block", "Crear copia independiente");
        createBtn.type = "button";
        createBtn.addEventListener("click", function () {
          var copy = data.createRoutineCopy(link.id);
          if (copy) {
            // data.createRoutineCopy (fuera de este lote) siempre clona
            // SHARE_ORIGINAL.cargas. Por privacidad por defecto, si el
            // enlace no incluye cargas, las quitamos de la copia aquí mismo
            // sin tocar js/data.js.
            copy.cargasIncluidas = !!link.scope.cargas;
            if (!copy.cargasIncluidas) copy.cargas = {};
          }
          App.closeSheet();
          if (copy) {
            App.toast(copy.cargasIncluidas
              ? "Copia creada: " + copy.nombre + ". Incluye tus cargas como referencia; el receptor puede ajustarlas."
              : "Copia creada: " + copy.nombre + ". Sin tus cargas personales: empieza su propio registro.");
          }
          App.navigate("share", {}, { replace: true });
        });
        body.appendChild(createBtn);
      }
    });
  }

  function renderCopies(host, data) {
    host.innerHTML = "";
    if (!data.ROUTINE_COPIES.length) {
      App.states.empty(host, { title: "Todavía no se ha creado ninguna copia", body: "Genera un enlace y crea una copia desde la vista previa." });
      return;
    }
    var list = App.el("ul", "catalog-list");
    data.ROUTINE_COPIES.forEach(function (copy) {
      var li = App.el("li", "catalog-card");
      var top = App.el("div", "catalog-card__top");
      var body = App.el("div", "catalog-card__body");
      body.appendChild(App.el("p", "catalog-card__name", copy.nombre));
      body.appendChild(App.el("p", "catalog-card__meta", copy.creadaEl + " · " + copy.historialCount + " sesión(es) en su propio historial"));
      top.appendChild(body);
      li.appendChild(top);

      li.appendChild(App.el("p", "field__label", "Cargas en esta copia"));
      var cargaKeys = Object.keys(copy.cargas || {});
      if (cargaKeys.length) {
        li.appendChild(App.el("p", "small",
          (copy.cargasIncluidas ? "Heredadas como referencia del original, editables: " : "Registradas por ti en esta copia: ") +
          cargaKeys.map(function (k) { return k + ": " + copy.cargas[k] + " kg"; }).join(" · ")));
      } else {
        li.appendChild(App.el("p", "small",
          "Todavía sin cargas propias. Por privacidad, las cargas del original no se copian por defecto: registra las tuyas cuando entrenes, empezando por una carga conservadora."));
      }

      var actions = App.el("div", "dayrow__actions");
      var adaptBtn = App.el("button", "chip", "Adaptar esta copia");
      adaptBtn.type = "button";
      adaptBtn.addEventListener("click", function () {
        var key = "Jalón en polea";
        var base = copy.cargas[key] || 20; // Carga conservadora de partida si la copia todavía no tenía ninguna.
        var nueva = Math.round((base + 5) * 2) / 2;
        data.adaptCopyLoad(copy.id, key, nueva);
        App.toast("Copia adaptada: " + key + " ahora en " + nueva + " kg en esta copia. El original no cambia.");
        renderCopies(host, data);
      });
      actions.appendChild(adaptBtn);
      li.appendChild(actions);

      list.appendChild(li);
    });
    host.appendChild(list);
  }

  App.registerView("share", { title: "Compartir rutina", render: render });
})();
