/* =====================================================================
 * Vista: Ejercicios — catálogo, ficha/guía, variantes, ejercicio propio y
 * referencia de carga por variante (LOTE 4). Notas 08, 18, 20, 23.
 * Reutiliza App.states, App.openSheet/confirmSheet y el vocabulario visual
 * ya definido (opt/optgroup/chip/picker/tag/cues) en vez de inventar uno
 * nuevo. Sin fetch, sin módulos ES, sin medios remotos.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  /* ---- Entrada de la vista ------------------------------------------------ */

  function render(mount, params) {
    var data = App.data;
    var ctx = App.viewContext("library");
    if (ctx.query === undefined) ctx.query = "";
    if (ctx.patron === undefined) ctx.patron = "";
    if (ctx.grupo === undefined) ctx.grupo = "";
    if (ctx.equipo === undefined) ctx.equipo = "";
    if (ctx.favoritosOnly === undefined) ctx.favoritosOnly = false;

    var wrap = App.el("section", "view-library");
    wrap.appendChild(App.el("h1", "view-title", "Ejercicios"));
    wrap.appendChild(App.el("p", "lede small",
      "Busca por nombre o filtra por patrón, músculo, equipamiento o favoritas. " +
      "No modelamos el inventario exacto de tu gimnasio."));

    var searchField = App.el("div", "field");
    var searchLabel = App.el("label", "field__label", "Buscar ejercicio");
    searchLabel.setAttribute("for", "librarySearch");
    searchField.appendChild(searchLabel);
    var input = document.createElement("input");
    input.type = "text";
    input.id = "librarySearch";
    input.value = ctx.query;
    input.setAttribute("aria-describedby", "libraryResultsCount");
    searchField.appendChild(input);
    wrap.appendChild(searchField);

    var patrones = uniqueValues(data, "patron");
    var grupos = uniqueValues(data, "grupo");
    var equipos = uniqueValues(data, "equipo");

    wrap.appendChild(buildSelect("Patrón de movimiento", patrones, ctx.patron, function (v) { ctx.patron = v; update(); }));
    wrap.appendChild(buildSelect("Grupo muscular", grupos, ctx.grupo, function (v) { ctx.grupo = v; update(); }));
    wrap.appendChild(buildSelect("Equipamiento", equipos, ctx.equipo, function (v) { ctx.equipo = v; update(); }));

    var favBtn = App.el("button", "picker__btn", (ctx.favoritosOnly ? "★" : "☆") + " Solo favoritas");
    favBtn.type = "button";
    favBtn.setAttribute("aria-pressed", String(ctx.favoritosOnly));
    favBtn.addEventListener("click", function () {
      ctx.favoritosOnly = !ctx.favoritosOnly;
      favBtn.setAttribute("aria-pressed", String(ctx.favoritosOnly));
      favBtn.textContent = (ctx.favoritosOnly ? "★" : "☆") + " Solo favoritas";
      update();
    });
    wrap.appendChild(favBtn);

    var resultsHost = App.el("div", "library-results");
    wrap.appendChild(resultsHost);

    var addOwnBtn = App.el("button", "btn btn--quiet", "+ Crear ejercicio propio");
    addOwnBtn.type = "button";
    addOwnBtn.addEventListener("click", function () {
      openCustomExerciseSheet(data, null, update);
    });
    wrap.appendChild(addOwnBtn);

    mount.appendChild(wrap);

    input.addEventListener("input", function () { ctx.query = input.value; update(); });

    function update() {
      var results = data.searchCatalog({
        query: ctx.query, patron: ctx.patron, grupo: ctx.grupo,
        equipo: ctx.equipo, favoritosOnly: ctx.favoritosOnly
      });
      renderResults(resultsHost, data, results, ctx, update);
    }
    update();
  }

  function uniqueValues(data, key) {
    var seen = {}, out = [];
    data.EXERCISE_CATALOG.forEach(function (item) {
      if (!seen[item[key]]) { seen[item[key]] = true; out.push(item[key]); }
    });
    return out;
  }

  function buildSelect(labelText, options, value, onChange) {
    var wrap = App.el("div", "field");
    var id = "sel-" + labelText.replace(/\s+/g, "-").toLowerCase();
    var label = App.el("label", "field__label", labelText);
    label.setAttribute("for", id);
    wrap.appendChild(label);
    var select = document.createElement("select");
    select.id = id;
    var optAll = document.createElement("option");
    optAll.value = ""; optAll.textContent = "Todos";
    select.appendChild(optAll);
    options.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt; o.textContent = opt;
      if (opt === value) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener("change", function () { onChange(select.value); });
    wrap.appendChild(select);
    return wrap;
  }

  /* ---- Resultados: vacío útil (nota 08/12) --------------------------------- */

  function renderResults(host, data, results, ctx, refresh) {
    host.innerHTML = "";
    var count = App.el("p", "small", results.length + (results.length === 1 ? " resultado" : " resultados"));
    count.id = "libraryResultsCount";
    count.setAttribute("aria-live", "polite");
    host.appendChild(count);

    var hasFilters = !!(ctx.query || ctx.patron || ctx.grupo || ctx.equipo || ctx.favoritosOnly);

    if (!results.length) {
      App.states.empty(host, {
        title: "No hay ejercicios con esos filtros",
        body: hasFilters
          ? "Prueba a quitar algún filtro de búsqueda."
          : "Todavía no hay ejercicios en el catálogo.",
        actionLabel: hasFilters ? "Quitar filtros" : null,
        onAction: hasFilters ? function () {
          ctx.query = ""; ctx.patron = ""; ctx.grupo = ""; ctx.equipo = ""; ctx.favoritosOnly = false;
          App.navigate("library", {}, { replace: true });
        } : null
      });
      var createOwn = App.el("button", "btn btn--ghost btn--block", "Crear ejercicio propio");
      createOwn.type = "button";
      createOwn.addEventListener("click", function () { openCustomExerciseSheet(data, null, refresh); });
      host.appendChild(createOwn);
      return;
    }

    var list = App.el("ul", "catalog-list");
    results.forEach(function (item) { list.appendChild(buildCatalogCard(item, data, refresh)); });
    host.appendChild(list);
  }

  function buildCatalogCard(item, data, refresh) {
    var li = App.el("li", "catalog-card");
    var top = App.el("div", "catalog-card__top");

    var thumb = App.el("div", "catalog-card__thumb");
    thumb.setAttribute("aria-hidden", "true");
    thumb.innerHTML = icon(item.icon);
    top.appendChild(thumb);

    var body = App.el("div", "catalog-card__body");
    body.appendChild(App.el("p", "catalog-card__name", item.nombre + (item.custom ? " · propio" : "")));
    body.appendChild(App.el("p", "catalog-card__meta", item.patron + " · " + item.grupo + " · " + item.equipo));
    top.appendChild(body);

    var favBtn = App.el("button", "icon-btn favbtn", item.favorito ? "★" : "☆");
    favBtn.type = "button";
    favBtn.setAttribute("aria-pressed", String(item.favorito));
    favBtn.setAttribute("aria-label", (item.favorito ? "Quitar de favoritas: " : "Marcar como favorita: ") + item.nombre);
    favBtn.addEventListener("click", function () {
      data.toggleFavorite(item.id);
      favBtn.textContent = item.favorito ? "★" : "☆";
      favBtn.setAttribute("aria-pressed", String(item.favorito));
      favBtn.setAttribute("aria-label", (item.favorito ? "Quitar de favoritas: " : "Marcar como favorita: ") + item.nombre);
      App.toast(item.favorito ? item.nombre + " marcada como favorita." : item.nombre + " ya no es favorita.");
    });
    top.appendChild(favBtn);
    li.appendChild(top);

    var actions = App.el("div", "dayrow__actions");

    var guideBtn = App.el("button", "chip", "Ver ficha y guía");
    guideBtn.type = "button";
    guideBtn.addEventListener("click", function () { openDetailSheet(item, data, refresh); });
    actions.appendChild(guideBtn);

    var variantsBtn = App.el("button", "chip", "Ver variantes");
    variantsBtn.type = "button";
    variantsBtn.addEventListener("click", function () { openVariantsSheet(item, data, refresh); });
    actions.appendChild(variantsBtn);

    var addBtn = App.el("button", "chip", "Añadir");
    addBtn.type = "button";
    addBtn.addEventListener("click", function () { openAddTargetSheet(item, data); });
    actions.appendChild(addBtn);

    if (item.custom) {
      var manageBtn = App.el("button", "chip", "Editar / eliminar");
      manageBtn.type = "button";
      manageBtn.addEventListener("click", function () { openCustomExerciseSheet(data, item, refresh); });
      actions.appendChild(manageBtn);
    }
    li.appendChild(actions);
    return li;
  }

  /* ---- Ficha de ejercicio y guía (nota 18) --------------------------------- */

  function openDetailSheet(item, data, refresh) {
    App.openSheet({
      title: item.nombre,
      render: function (body) {
        body.appendChild(App.el("p", "kicker", item.patron + " · " + item.equipo));
        body.appendChild(App.el("p", "lede small", "Objetivo: " + item.objetivo));

        // ---- Medio bajo demanda (nota 09/18): placeholder visible, sin carga
        // hasta una acción explícita; simula la espera con un breve retardo.
        var mediaHost = App.el("div", "media-demand");
        var placeholder = App.el("p", "media-demand__placeholder", "Ilustración no cargada todavía.");
        placeholder.setAttribute("aria-live", "polite");
        var showBtn = App.el("button", "btn btn--ghost btn--sm", "Mostrar ilustración");
        showBtn.type = "button";
        mediaHost.appendChild(placeholder);
        mediaHost.appendChild(showBtn);
        showBtn.addEventListener("click", function () {
          showBtn.disabled = true;
          placeholder.textContent = "Cargando ilustración…";
          window.setTimeout(function () {
            mediaHost.innerHTML = "";
            var fig = App.el("div", "guide-figure");
            fig.innerHTML = icon(item.icon);
            mediaHost.appendChild(fig);
          }, 300);
        });
        body.appendChild(mediaHost);

        body.appendChild(App.el("p", "field__label", "Guía técnica"));
        var cues = App.el("ul", "cues");
        item.guide.cues.forEach(function (c) { cues.appendChild(App.el("li", null, c)); });
        body.appendChild(cues);

        if (item.guide.muscles.length) {
          body.appendChild(App.el("p", "field__label", "Músculos implicados"));
          var tags = App.el("div", "tags");
          item.guide.muscles.forEach(function (m) { tags.appendChild(App.el("span", "tag", m)); });
          body.appendChild(tags);
        }

        body.appendChild(App.el("p", "lede small",
          "Guía informativa general de bienestar; no diagnostica, trata ni previene lesiones ni molestias, " +
          "y no sustituye la valoración de un profesional de salud."));

        var videoLink = document.createElement("a");
        videoLink.className = "chip";
        videoLink.href = item.video;
        videoLink.target = "_blank";
        videoLink.rel = "noopener";
        videoLink.textContent = "Vídeo en YouTube (se abre fuera de la app) ↗";
        body.appendChild(videoLink);

        body.appendChild(App.el("p", "section-title", "Referencia de carga"));
        var refHost = App.el("div");
        body.appendChild(refHost);
        renderReferenceBlock(refHost, item, data);

        var favBtn = App.el("button", "btn btn--ghost btn--block", item.favorito ? "Quitar de favoritas" : "Marcar como favorita");
        favBtn.type = "button";
        favBtn.setAttribute("aria-pressed", String(item.favorito));
        favBtn.addEventListener("click", function () {
          data.toggleFavorite(item.id);
          favBtn.textContent = item.favorito ? "Quitar de favoritas" : "Marcar como favorita";
          favBtn.setAttribute("aria-pressed", String(item.favorito));
          App.toast(item.favorito ? "Marcada como favorita." : "Ya no es favorita.");
          if (refresh) refresh();
        });
        body.appendChild(favBtn);
      }
    });
  }

  /* ---- Referencia de carga y progresión por variante (nota 23) ------------- */

  function renderReferenceBlock(host, item, data) {
    host.innerHTML = "";
    var ref = item.reference;
    var block = App.el("div", "refblock");

    if (ref.ultima) {
      block.appendChild(App.el("p", "lede small",
        "Último resultado con esta variante: " + ref.ultima.peso + " kg × " + ref.ultima.reps +
        " reps · facilidad: " + facilidadLabel(ref.ultima.facilidad)));
    } else {
      block.appendChild(App.el("p", "lede small", "Todavía no hay resultado anterior de esta variante concreta."));
    }

    block.appendChild(App.el("p", "field__label", "Próxima referencia (editable)"));
    var row = App.el("div", "reffields");
    var pesoField = numberField("Peso (kg)", ref.proxima ? ref.proxima.peso : (ref.cargaInicial || 0));
    var repsField = numberField("Repeticiones objetivo", ref.proxima ? ref.proxima.reps : parseObjetivoMin(item.objetivo));
    row.appendChild(pesoField.wrap);
    row.appendChild(repsField.wrap);
    block.appendChild(row);

    if (ref.notaSugerencia) block.appendChild(App.el("p", "small", ref.notaSugerencia));

    var saveRefBtn = App.el("button", "btn btn--ghost btn--sm", "Guardar próxima referencia");
    saveRefBtn.type = "button";
    saveRefBtn.addEventListener("click", function () {
      var peso = parseFloat(pesoField.input.value);
      var reps = parseInt(repsField.input.value, 10);
      if (isNaN(peso) || isNaN(reps)) { App.toast("Revisa el peso y las repeticiones."); return; }
      data.setNextReference(item.id, peso, reps);
      App.toast("Próxima referencia de " + item.nombre + " actualizada a mano.");
      renderReferenceBlock(host, item, data);
    });
    block.appendChild(saveRefBtn);

    block.appendChild(App.el("p", "field__label", "Registrar resultado real de hoy"));
    var resultRow = App.el("div", "reffields");
    var pesoDoneField = numberField("Peso usado (kg)", ref.ultima ? ref.ultima.peso : (ref.cargaInicial || 0));
    var repsDoneField = numberField("Repeticiones logradas", ref.ultima ? ref.ultima.reps : parseObjetivoMin(item.objetivo));
    resultRow.appendChild(pesoDoneField.wrap);
    resultRow.appendChild(repsDoneField.wrap);
    block.appendChild(resultRow);

    block.appendChild(App.el("p", "field__label", "Facilidad percibida"));
    var difficultyGroup = App.el("div", "picker");
    difficultyGroup.setAttribute("role", "group");
    difficultyGroup.setAttribute("aria-label", "Facilidad percibida");
    var chosenFacilidad = ref.ultima ? ref.ultima.facilidad : null;
    [["facil", "Fácil"], ["adecuada", "Adecuada"], ["dura", "Demasiado dura"]].forEach(function (pair) {
      var b = App.el("button", "picker__btn", pair[1]);
      b.type = "button";
      b.setAttribute("aria-pressed", String(chosenFacilidad === pair[0]));
      b.addEventListener("click", function () {
        chosenFacilidad = pair[0];
        Array.prototype.forEach.call(difficultyGroup.children, function (c) { c.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
      });
      difficultyGroup.appendChild(b);
    });
    block.appendChild(difficultyGroup);

    var registerBtn = App.el("button", "btn btn--primary btn--sm", "Registrar resultado y actualizar referencia");
    registerBtn.type = "button";
    registerBtn.addEventListener("click", function () {
      var peso = parseFloat(pesoDoneField.input.value);
      var reps = parseInt(repsDoneField.input.value, 10);
      if (isNaN(peso) || isNaN(reps) || !chosenFacilidad) {
        App.toast("Indica peso, repeticiones y facilidad para registrar el resultado.");
        return;
      }
      data.recordCatalogResult(item.id, { peso: peso, reps: reps, facilidad: chosenFacilidad });
      App.toast("Resultado registrado. La próxima referencia de " + item.nombre + " se actualizó (solo esta variante).");
      renderReferenceBlock(host, item, data);
    });
    block.appendChild(registerBtn);

    block.appendChild(App.el("p", "notice notice--info",
      "La regla de progresión de este prototipo es orientativa y conservadora, y está pendiente de " +
      "validación profesional antes de producción. No es una garantía de rendimiento ni un consejo médico."));

    host.appendChild(block);
  }

  function numberField(labelText, value) {
    var wrap = App.el("div", "field");
    var id = "f-" + Math.random().toString(36).slice(2);
    var label = App.el("label", "field__label", labelText);
    label.setAttribute("for", id);
    wrap.appendChild(label);
    var input = document.createElement("input");
    input.type = "number"; input.id = id; input.step = "0.5"; input.min = "0";
    input.value = value;
    input.setAttribute("aria-label", labelText);
    wrap.appendChild(input);
    return { wrap: wrap, input: input };
  }

  function parseObjetivoMin(objetivo) {
    var m = /(\d+)\s*-\s*(\d+)/.exec(objetivo || "");
    return m ? parseInt(m[1], 10) : 10;
  }

  function facilidadLabel(key) {
    var labels = { facil: "fácil", adecuada: "adecuada", dura: "demasiado dura" };
    return labels[key] || "sin indicar";
  }

  /* ---- Variantes: prioridad y último resultado por variante (nota 08/23) --- */

  function openVariantsSheet(item, data, refresh) {
    var groups = data.catalogAlternatives(item);
    App.openSheet({
      title: "Variantes · " + item.patron,
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          "Cada variante conserva su propio historial y referencia de carga; no se mezclan entre sí."));

        [
          ["Favoritas", groups.favoritas],
          ["Usadas recientemente", groups.recientes],
          ["Mismo patrón — " + item.patron, groups.mismoPatron],
          ["Catálogo general", groups.catalogo]
        ].forEach(function (pair) {
          var title = pair[0], items = pair[1];
          if (!items.length) return;
          var g = App.el("div", "optgroup");
          g.appendChild(App.el("p", "optgroup__title", title));
          items.forEach(function (v) {
            var btn = App.el("button", "opt");
            btn.type = "button";
            btn.appendChild(App.el("span", "opt__name", v.nombre));
            var metaText = v.reference.ultima
              ? ("Último: " + v.reference.ultima.peso + " kg × " + v.reference.ultima.reps + " reps")
              : "Sin historial previo";
            btn.appendChild(App.el("span", "opt__meta", metaText));
            btn.addEventListener("click", function () {
              App.closeSheet();
              openDetailSheet(v, data, refresh);
            });
            g.appendChild(btn);
          });
          body.appendChild(g);
        });
      }
    });
  }

  /* ---- Añadir a sesión o al bloque del borrador (nota 08/20) --------------- */

  function openAddTargetSheet(item, data) {
    App.openSheet({
      title: "Añadir " + item.nombre,
      render: function (body) {
        var today = data.sessionOnDay(data.hoy);
        if (today && today.tipo === "fuerza") {
          var addToday = App.el("button", "opt");
          addToday.type = "button";
          addToday.appendChild(App.el("span", "opt__name", "Añadir a la sesión de hoy · " + today.nombre));
          addToday.appendChild(App.el("span", "opt__meta", "Solo esta sesión; tu plantilla no cambia"));
          addToday.addEventListener("click", function () {
            data.addCatalogExerciseToSession(today.id, item);
            App.closeSheet();
            App.toast(item.nombre + " se añadió a la sesión de hoy.");
          });
          body.appendChild(addToday);
        } else {
          body.appendChild(App.el("p", "lede small", "Hoy no tienes una sesión de fuerza abierta para añadir directamente."));
        }

        var addDraft = App.el("button", "opt");
        addDraft.type = "button";
        addDraft.appendChild(App.el("span", "opt__name", "Añadir al bloque de un plan en borrador"));
        addDraft.appendChild(App.el("span", "opt__meta", "Pide confirmación; no activa ningún plan"));
        addDraft.addEventListener("click", function () {
          App.confirmSheet({
            title: "Añadir al borrador",
            body: "Esto añade " + item.nombre + " a la lista de ejercicios propuestos de tu plan en borrador. " +
              "No modifica ningún plan activo ni su plantilla.",
            confirmLabel: "Añadir",
            cancelLabel: "Cancelar",
            onConfirm: function () {
              data.addToDraftBlock(item);
              App.toast(item.nombre + " se añadió al borrador.");
            }
          });
        });
        body.appendChild(addDraft);
      }
    });
  }

  /* ---- Ejercicio propio: crear, editar y eliminar con confirmación --------- */

  function openCustomExerciseSheet(data, existing, refresh) {
    App.openSheet({
      title: existing ? "Editar ejercicio propio" : "Crear ejercicio propio",
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          "Recurso secundario: nombre, patrón o músculo aproximado y tipo de carga."));

        var nameField = App.el("div", "field");
        var nameLabel = App.el("label", "field__label", "Nombre");
        nameLabel.setAttribute("for", "customExName");
        nameField.appendChild(nameLabel);
        var nameInput = document.createElement("input");
        nameInput.type = "text"; nameInput.id = "customExName";
        nameInput.value = existing ? existing.nombre : "";
        nameField.appendChild(nameInput);
        var nameError = App.el("p", "field__error", "Escribe un nombre para tu ejercicio.");
        nameError.id = "customExNameError";
        nameError.hidden = true;
        nameError.setAttribute("role", "alert");
        nameField.appendChild(nameError);
        body.appendChild(nameField);

        var patronField = App.el("div", "field");
        var patronLabel = App.el("label", "field__label", "Patrón o músculo aproximado");
        patronLabel.setAttribute("for", "customExPatron");
        patronField.appendChild(patronLabel);
        var patronInput = document.createElement("input");
        patronInput.type = "text"; patronInput.id = "customExPatron";
        patronInput.value = existing ? existing.patron : "";
        patronField.appendChild(patronInput);
        body.appendChild(patronField);

        body.appendChild(App.el("p", "field__label", "Tipo de carga"));
        var equipoGroup = App.el("div", "picker");
        equipoGroup.setAttribute("role", "group");
        equipoGroup.setAttribute("aria-label", "Tipo de carga");
        var equipoValue = existing ? existing.equipo : "Peso corporal";
        ["Peso corporal", "Mancuernas", "Barra", "Máquina", "Polea", "Banda elástica"].forEach(function (opt) {
          var b = App.el("button", "picker__btn", opt);
          b.type = "button";
          b.setAttribute("aria-pressed", String(opt === equipoValue));
          b.addEventListener("click", function () {
            equipoValue = opt;
            Array.prototype.forEach.call(equipoGroup.children, function (c) { c.setAttribute("aria-pressed", "false"); });
            b.setAttribute("aria-pressed", "true");
          });
          equipoGroup.appendChild(b);
        });
        body.appendChild(equipoGroup);

        var saveBtn = App.el("button", "btn btn--primary btn--block", existing ? "Guardar cambios" : "Crear ejercicio");
        saveBtn.type = "button";
        saveBtn.addEventListener("click", function () {
          var name = nameInput.value.trim();
          if (!name) {
            nameInput.setAttribute("aria-invalid", "true");
            nameInput.setAttribute("aria-describedby", "customExNameError");
            nameError.hidden = false;
            nameInput.focus();
            return;
          }
          var payload = {
            nombre: name,
            patron: patronInput.value.trim() || "Personalizado",
            grupo: patronInput.value.trim() || "Personalizado",
            equipo: equipoValue,
            objetivo: "3 × 10-12 reps"
          };
          if (existing) {
            data.updateCustomExercise(existing.id, payload);
            App.toast(name + " se actualizó.");
          } else {
            data.createCustomExercise(payload);
            App.toast(name + " se creó y ya está disponible en el catálogo.");
          }
          App.closeSheet();
          if (refresh) refresh();
        });
        body.appendChild(saveBtn);

        if (existing) {
          var deleteBtn = App.el("button", "btn btn--ghost btn--block", "Eliminar ejercicio propio");
          deleteBtn.type = "button";
          deleteBtn.addEventListener("click", function () {
            App.confirmSheet({
              title: "Eliminar " + existing.nombre,
              body: "Esto elimina tu ejercicio propio del catálogo. No se puede deshacer en esta demo.",
              confirmLabel: "Eliminar",
              cancelLabel: "Cancelar",
              onConfirm: function () {
                data.deleteCustomExercise(existing.id);
                App.toast(existing.nombre + " se eliminó.");
                if (refresh) refresh();
              }
            });
          });
          body.appendChild(deleteBtn);
        }
      }
    });
  }

  /* ---- Miniaturas ilustradas (SVG inline, sin recursos remotos) ------------ */

  function icon(kind) {
    var icons = {
      pull: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M6 21h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      row: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12h6m0 0l3-3m-3 3l3 3M21 12h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      facepull: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M6 20c1-4 3-6 6-6s5 2 6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      curl: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 18l4-9 5 3 5-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      press: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12h16M6 8v8m12-8v8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      shoulderpress: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 21V9m0 0l-5 4m5-4l5 4M7 5h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      dip: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 8h6m4 0h6M9 8v10m5-10v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      lateral: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h5m6 0h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      squat: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="2" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v5m-4 7v-5l4-2 4 2v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      legpress: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12h8m0 0l4-4m-4 4l4 4M21 6v12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      hamcurl: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 6h9m0 0l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      hipthrust: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 16h16M8 16v-3a4 4 0 018 0v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="7" r="2" stroke="currentColor" stroke-width="1.6"/></svg>',
      calf: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M8 20V8a4 4 0 018 0v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M6 20h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      adductor: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 4v6m0 0l-6 10m6-10l6 10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      core: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M6 12h12" stroke="currentColor" stroke-width="1.6"/></svg>',
      plank: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 17l6-9h6l6 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      custom: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
    };
    return icons[kind] || icons.custom;
  }

  App.registerView("library", { title: "Ejercicios", render: render });
})();
