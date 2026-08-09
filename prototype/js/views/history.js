/* =====================================================================
 * Vista: Historial — fuerza, cardio, adherencia/logros y métricas
 * personales opcionales (LOTE 6). Notas 09, 25, 27, 29, 11, 12.
 * Filtros persistentes vía App.viewContext("history"). Corrección
 * versionada simulada: editar NUNCA reescribe el registro original, crea
 * una versión con motivo y el registro anterior sigue consultable.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  var ESTADO_LABEL = {
    planificada: "Planificada", en_curso: "En curso", completada: "Completada",
    adaptada: "Adaptada", parcial: "Parcial", omitida: "Omitida"
  };
  var TIPO_LABEL = { fuerza: "Fuerza", resistencia: "Cardio", recuperacion: "Recuperación" };
  var PROCEDENCIA_LABEL = { local: "Local", importado: "Importado", adaptado: "Adaptado por ti" };

  // C4: mismo aviso literal que checkin.js (SAFETY_TEXT), reutilizado tal
  // cual junto a la molestia "Importante" en el detalle de una sesión de
  // fuerza. La molestia es señal declarada por la persona, nunca un
  // diagnóstico: el sistema no infiere intensidad, zona ni causa.
  var SAFETY_TEXT = "Molestia importante: esto no es un diagnóstico. Si la molestia persiste o es intensa, " +
    "considera detener o adaptar la sesión y consultar a un profesional de salud.";

  var TABS = [
    { key: "registro", label: "Fuerza y cardio" },
    { key: "adherencia", label: "Adherencia y logros" },
    { key: "metricas", label: "Métricas" }
  ];

  // ---- LOTE 3c: entrar en Historial (vía App.navigate, router) SIEMPRE
  // muestra la línea temporal, nunca la última pestaña que se hubiera
  // dejado activa. El cambio de pestaña DENTRO de la vista sigue siendo un
  // re-render local (draw), que no vuelve a pasar por aquí, así que
  // conserva la pestaña elegida mientras la persona sigue en la vista.
  function render(mount) {
    var ctx = App.viewContext("history");
    ctx.tab = "registro";
    if (ctx.periodo === undefined) ctx.periodo = "";
    if (ctx.tipo === undefined) ctx.tipo = "";
    if (ctx.estado === undefined) ctx.estado = "";
    draw(mount, ctx);
  }

  function draw(mount, ctx) {
    // Cambiar de pestaña llama a draw(mount, ctx) directamente (sin pasar
    // por App.navigate, igual que plan.js): hay que limpiar el contenedor
    // aquí o el contenido se apila en vez de sustituirse.
    mount.innerHTML = "";

    var wrap = App.el("section", "view-history");
    wrap.appendChild(App.el("h1", "view-title", "Historial"));
    wrap.appendChild(App.el("p", "lede small",
      "Tu evolución en resúmenes concretos, sin panel analítico denso."));

    // ---- LOTE 2 (mejoras-ux-ui-004): acción de importar SIEMPRE visible
    // aquí, no solo cuando el historial está vacío (nota 07): este es el
    // sitio donde ya se ve la actividad de cardio importada, así que es
    // natural poder añadir más desde el mismo lugar.
    var importBtn = App.el("button", "btn btn--ghost btn--block", "Importar actividad");
    importBtn.type = "button";
    importBtn.addEventListener("click", function () { App.navigate("import"); });
    wrap.appendChild(importBtn);
    wrap.appendChild(App.el("p", "lede small",
      "Admite .FIT, .TCX y .GPX de tu reloj. Este prototipo no procesa archivos reales: sirve para registrar el contexto de cardio que tu reloj ya tiene."));

    if (ctx.forceError) {
      // App.states.error() limpia el contenedor que recibe: se dibuja en un
      // `body` aparte para no perder el <h1> de la vista (nota 12), igual
      // que el patrón ya usado en import.js/endurance.js.
      var errorBody = App.el("div");
      App.states.error(errorBody, {
        title: "No se pudo cargar el historial (simulado)",
        body: "Este error está forzado desde el panel de demo, en Perfil.",
        onRetry: function () { ctx.forceError = false; App.navigate("history", {}, { replace: true }); },
        retryLabel: "Reintentar"
      });
      wrap.appendChild(errorBody);
      mount.appendChild(wrap);
      return;
    }

    wrap.appendChild(buildTabs(ctx, mount));

    var panel = App.el("div", "tabpanel");
    panel.id = "historyPanel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("tabindex", "0");
    panel.setAttribute("aria-labelledby", "historyTab-" + ctx.tab);

    App.states.loading(panel, { title: "Cargando historial…" });
    wrap.appendChild(panel);
    mount.appendChild(wrap);

    window.setTimeout(function () {
      if (ctx.tab === "registro") renderRegistro(panel, ctx);
      else if (ctx.tab === "adherencia") renderAdherencia(panel);
      else renderMetricas(panel, ctx);
    }, 150);
  }

  function buildTabs(ctx, mount) {
    var tabs = App.el("div", "tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Secciones del historial");

    TABS.forEach(function (t, i) {
      var selected = ctx.tab === t.key;
      var btn = App.el("button", "tab", t.label);
      btn.type = "button";
      btn.id = "historyTab-" + t.key;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(selected));
      btn.setAttribute("aria-controls", "historyPanel");
      btn.tabIndex = selected ? 0 : -1;
      btn.addEventListener("click", function () { selectTab(t.key); });
      btn.addEventListener("keydown", function (e) {
        var nextIdx = null;
        if (e.key === "ArrowRight") nextIdx = (i + 1) % TABS.length;
        else if (e.key === "ArrowLeft") nextIdx = (i - 1 + TABS.length) % TABS.length;
        else if (e.key === "Home") nextIdx = 0;
        else if (e.key === "End") nextIdx = TABS.length - 1;
        if (nextIdx === null) return;
        e.preventDefault();
        selectTab(TABS[nextIdx].key);
      });
      tabs.appendChild(btn);
    });

    function selectTab(key) {
      ctx.tab = key;
      draw(mount, ctx);
      var el = App.$("historyTab-" + key);
      if (el) el.focus();
    }
    return tabs;
  }

  /* ---- Pestaña: Fuerza y cardio, con filtros persistentes --------------- */

  function renderRegistro(panel, ctx) {
    panel.innerHTML = "";
    var data = App.data;

    // ---- LOTE 3c: Periodo/Tipo/Estado ya no están inline en la línea
    // temporal: viven en una hoja modal ("Filtros"), igual que en library.js.
    var filtersBtn = App.el("button", "btn btn--ghost", filtersButtonLabel(ctx));
    filtersBtn.type = "button";
    filtersBtn.addEventListener("click", function () { openHistoryFiltersSheet(ctx, panel); });
    panel.appendChild(filtersBtn);

    var results = data.filterHistory({ periodo: ctx.periodo, tipo: ctx.tipo, estado: ctx.estado });
    var count = App.el("p", "small", results.length + (results.length === 1 ? " registro" : " registros") +
      " de " + data.HISTORY.length + " en total");
    count.id = "historyResultsCount";
    count.setAttribute("aria-live", "polite");
    panel.appendChild(count);

    var hasFilters = !!(ctx.periodo || ctx.tipo || ctx.estado);
    if (!results.length) {
      App.states.empty(panel, {
        title: "No hay registros con esos filtros",
        body: hasFilters ? "Prueba a quitar algún filtro." : "Todavía no hay sesiones registradas.",
        actionLabel: hasFilters ? "Quitar filtros" : null,
        onAction: hasFilters ? function () { ctx.periodo = ""; ctx.tipo = ""; ctx.estado = ""; renderRegistro(panel, ctx); } : null
      });
      return;
    }

    var list = App.el("ul", "log");
    results.forEach(function (item) { list.appendChild(buildLogItem(item, panel, ctx)); });
    panel.appendChild(list);
  }

  function filtersButtonLabel(ctx) {
    var count = (ctx.periodo ? 1 : 0) + (ctx.tipo ? 1 : 0) + (ctx.estado ? 1 : 0);
    return count ? "Filtros (" + count + ")" : "Filtros";
  }

  function openHistoryFiltersSheet(ctx, panel) {
    // Redibuja el CUERPO de la hoja (no solo el panel de detrás) tras cada
    // cambio, para que los botones de picker reflejen a mano cuál queda
    // pulsado (mismo patrón que renderReferenceBlock en library.js).
    function renderFilterBody(body) {
      body.innerHTML = "";

      body.appendChild(App.el("p", "field__label", "Periodo"));
      body.appendChild(pickerGroup("Periodo", [
        ["", "Todo"], ["semana", "Esta semana"], ["4sem", "Últimas 4 semanas"]
      ], ctx.periodo, function (v) { ctx.periodo = v; renderRegistro(panel, ctx); renderFilterBody(body); }));

      body.appendChild(App.el("p", "field__label", "Tipo"));
      body.appendChild(pickerGroup("Tipo", [
        ["", "Todos"], ["fuerza", "Fuerza"], ["resistencia", "Cardio"], ["recuperacion", "Recuperación"]
      ], ctx.tipo, function (v) { ctx.tipo = v; renderRegistro(panel, ctx); renderFilterBody(body); }));

      body.appendChild(App.el("p", "field__label", "Estado"));
      body.appendChild(pickerGroup("Estado", [
        ["", "Todos"], ["completada", "Completada"], ["adaptada", "Adaptada"],
        ["parcial", "Parcial"], ["omitida", "Omitida"]
      ], ctx.estado, function (v) { ctx.estado = v; renderRegistro(panel, ctx); renderFilterBody(body); }));

      var clearBtn = App.el("button", "btn btn--ghost btn--block", "Quitar filtros");
      clearBtn.type = "button";
      clearBtn.addEventListener("click", function () {
        ctx.periodo = ""; ctx.tipo = ""; ctx.estado = "";
        renderRegistro(panel, ctx);
        renderFilterBody(body);
      });
      body.appendChild(clearBtn);

      var doneBtn = App.el("button", "btn btn--primary btn--block", "Ver resultados");
      doneBtn.type = "button";
      doneBtn.addEventListener("click", function () { App.closeSheet(); });
      body.appendChild(doneBtn);
    }

    App.openSheet({ title: "Filtros", render: renderFilterBody });
  }

  function pickerGroup(label, options, value, onChange) {
    var group = App.el("div", "picker");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    options.forEach(function (pair) {
      var btn = App.el("button", "picker__btn", pair[1]);
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(value === pair[0]));
      btn.addEventListener("click", function () { onChange(pair[0]); });
      group.appendChild(btn);
    });
    return group;
  }

  function buildLogItem(item, panel, ctx) {
    var li = App.el("li", "log__item");
    li.appendChild(App.el("span", "log__bar log__bar--" + item.estado));
    var body = App.el("div", "log__body");
    body.appendChild(App.el("p", "log__title", item.nombre + " · " + TIPO_LABEL[item.tipo]));
    var meta = item.meta + " · " + (PROCEDENCIA_LABEL[item.procedencia] || item.procedencia);
    body.appendChild(App.el("p", "log__meta", meta));
    var badges = App.el("div", "badge-row");
    badges.appendChild(App.sync.badge(item.sync || "local"));
    if (item.versions && item.versions.length) badges.appendChild(App.el("span", "state state--sim", "Corregido · versión anterior disponible"));
    body.appendChild(badges);
    var openBtn = App.el("button", "chip", "Ver detalle");
    openBtn.type = "button";
    openBtn.addEventListener("click", function () { openDetailSheet(item, panel, ctx); });
    body.appendChild(openBtn);
    li.appendChild(body);
    li.appendChild(App.el("span", "state state--" + item.estado, ESTADO_LABEL[item.estado] || item.estado));
    return li;
  }

  /* ---- Detalle de sesión, procedencia, sincronización y versiones ------- */

  function openDetailSheet(item, panel, ctx) {
    App.openSheet({
      title: item.nombre,
      render: function (body) {
        body.appendChild(App.el("p", "kicker", TIPO_LABEL[item.tipo] + " · " + item.fecha));
        body.appendChild(App.el("p", "lede small", item.meta));

        var badges = App.el("div", "badge-row");
        badges.appendChild(App.el("span", "state state--" + item.estado, ESTADO_LABEL[item.estado] || item.estado));
        badges.appendChild(App.el("span", "tag", "Procedencia: " + (PROCEDENCIA_LABEL[item.procedencia] || item.procedencia)));
        badges.appendChild(App.sync.badge(item.sync || "local"));
        body.appendChild(badges);

        buildDetailBody(body, item);

        if (item.versions && item.versions.length) {
          body.appendChild(App.el("p", "section-title", "Versión vigente y anteriores"));
          body.appendChild(App.el("p", "lede small",
            "La corrección no borra lo sucedido: aquí puedes consultar el registro tal como estaba antes."));
          item.versions.forEach(function (v) {
            var card = App.el("div", "refblock");
            card.appendChild(App.el("p", "field__label", "Versión anterior · " + (v.corregidoEl || "")));
            card.appendChild(App.el("p", "small", v.nombre + " — " + v.meta));
            card.appendChild(App.el("p", "small", "Motivo de la corrección: " + v.motivo));
            body.appendChild(card);
          });
        }

        var correctBtn = App.el("button", "btn btn--ghost btn--block", "Corregir registro");
        correctBtn.type = "button";
        correctBtn.addEventListener("click", function () {
          App.closeSheet();
          openCorrectionSheet(item, panel, ctx);
        });
        body.appendChild(correctBtn);
      }
    });
  }

  function buildDetailBody(body, item) {
    var d = item.detalle;
    if (item.tipo === "fuerza") {
      if (!d || !d.ejercicios || !d.ejercicios.length) {
        body.appendChild(App.el("p", "lede small", "Sin ejercicios registrados para esta sesión."));
      } else {
        body.appendChild(App.el("p", "field__label", "Ejercicio / variante — carga, repeticiones y volumen"));
        var list = App.el("ul", "cues");
        d.ejercicios.forEach(function (ex) {
          list.appendChild(App.el("li", null,
            ex.nombre + ": " + ex.carga + " kg × " + ex.reps + " reps × " + ex.series + " series (volumen " + ex.volumen + " kg)"));
        });
        body.appendChild(list);
      }
      appendDiscomfortDetail(body, item);
    } else if (item.tipo === "resistencia") {
      if (!d) { body.appendChild(App.el("p", "lede small", "Sin datos de actividad para esta sesión.")); return; }
      body.appendChild(App.el("p", "field__label", "Actividad"));
      var rows = [];
      if (d.duracionMin != null) rows.push("Duración: " + d.duracionMin + " min");
      if (d.distanciaKm != null) rows.push("Distancia: " + d.distanciaKm + " km");
      if (d.ritmo) rows.push("Ritmo: " + d.ritmo);
      if (d.fcMedia != null) rows.push("FC media: " + d.fcMedia + " ppm");
      if (d.cargaEstimada) rows.push("Carga estimada: " + d.cargaEstimada);
      if (!rows.length) rows.push("No hay más datos disponibles de este registro (nunca se inventan).");
      var list2 = App.el("ul", "cues");
      rows.forEach(function (r) { list2.appendChild(App.el("li", null, r)); });
      body.appendChild(list2);
    } else {
      body.appendChild(App.el("p", "lede small", d && d.minutos ? d.minutos + " min de recuperación registrados." : "Recuperación registrada."));
    }
  }

  // C4: molestia y comentario declarados al cerrar la sesión de fuerza
  // (data.closeStrengthSession) — antes se recibían y se perdían sin
  // persistirse. `item.molestia` solo existe en entradas creadas después de
  // esta corrección: las entradas antiguas del dataset semilla no declaran
  // nada, así que no se inventa un "Ninguna" para ellas (nunca se inventan
  // datos que la persona no declaró).
  function appendDiscomfortDetail(body, item) {
    if (item.molestia === undefined) return;
    body.appendChild(App.el("p", "field__label", "Molestia declarada al cerrar"));
    body.appendChild(App.el("p", "small", item.molestia));
    if (item.molestia === "Importante") {
      body.appendChild(App.el("p", "notice notice--warn", SAFETY_TEXT));
    }
    if (item.comentario) {
      body.appendChild(App.el("p", "field__label", "Comentario"));
      body.appendChild(App.el("p", "small", item.comentario));
    }
  }

  /* ---- Corrección versionada (nunca reescribe el original) -------------- */

  function openCorrectionSheet(item, panel, ctx) {
    App.openSheet({
      title: "Corregir · " + item.nombre,
      render: function (body) {
        body.appendChild(App.el("p", "lede small",
          "Esto NO reescribe el registro original: crea una versión con tu motivo y el registro anterior sigue consultable."));

        var nombreField = App.el("div", "field");
        var nombreLabel = App.el("label", "field__label", "Nombre");
        nombreLabel.setAttribute("for", "correctNombre");
        nombreField.appendChild(nombreLabel);
        var nombreInput = document.createElement("input");
        nombreInput.type = "text"; nombreInput.id = "correctNombre"; nombreInput.value = item.nombre;
        nombreField.appendChild(nombreInput);
        body.appendChild(nombreField);

        var metaField = App.el("div", "field");
        var metaLabel = App.el("label", "field__label", "Resumen (meta)");
        metaLabel.setAttribute("for", "correctMeta");
        metaField.appendChild(metaLabel);
        var metaInput = document.createElement("input");
        metaInput.type = "text"; metaInput.id = "correctMeta"; metaInput.value = item.meta;
        metaField.appendChild(metaInput);
        body.appendChild(metaField);

        var motivoField = App.el("div", "field");
        var motivoLabel = App.el("label", "field__label", "Motivo de la corrección");
        motivoLabel.setAttribute("for", "correctMotivo");
        motivoField.appendChild(motivoLabel);
        var motivoInput = document.createElement("input");
        motivoInput.type = "text"; motivoInput.id = "correctMotivo";
        motivoInput.setAttribute("placeholder", "Por ejemplo: se me olvidó anotar una serie");
        motivoField.appendChild(motivoInput);
        var motivoError = App.el("p", "field__error", "Escribe el motivo de la corrección.");
        motivoError.id = "correctMotivoError"; motivoError.hidden = true; motivoError.setAttribute("role", "alert");
        motivoField.appendChild(motivoError);
        body.appendChild(motivoField);

        var saveBtn = App.el("button", "btn btn--primary btn--block", "Guardar como nueva versión");
        saveBtn.type = "button";
        saveBtn.addEventListener("click", function () {
          var motivo = motivoInput.value.trim();
          if (!motivo) {
            motivoInput.setAttribute("aria-invalid", "true");
            motivoInput.setAttribute("aria-describedby", "correctMotivoError");
            motivoError.hidden = false;
            motivoInput.focus();
            return;
          }
          App.data.correctHistoryEntry(item.id, { nombre: nombreInput.value.trim(), meta: metaInput.value.trim() }, motivo);
          App.closeSheet();
          App.toast("Registro corregido: la versión anterior sigue disponible en el detalle.");
          render(App.$("mainContent"));
        });
        body.appendChild(saveBtn);
      }
    });
  }

  /* ---- Pestaña: Adherencia y logros -------------------------------------- */

  function renderAdherencia(panel) {
    panel.innerHTML = "";
    var data = App.data;
    var stats = data.weekStats();
    var adherence = data.adherenceSummary();

    panel.appendChild(App.el("h2", "section-title", "Tu semana"));
    var figures = App.el("div", "figures");
    figures.setAttribute("aria-label", "Resumen de la semana");
    figures.appendChild(figureBlock(stats.hechas + "/" + stats.previstas, "sesiones"));
    figures.appendChild(figureBlock(String(stats.minutos), "min activos"));
    figures.appendChild(figureBlock(String(stats.constancia), "sem. de constancia"));
    panel.appendChild(figures);

    panel.appendChild(App.el("h2", "section-title", "Adherencia (todo el historial)"));
    panel.appendChild(App.el("p", "lede small",
      "Completada, adaptada y recuperación válida suman adherencia. Parcial y omitida se conservan en el historial, sin sumar hito."));
    var figures2 = App.el("div", "figures");
    figures2.setAttribute("aria-label", "Adherencia acumulada");
    figures2.appendChild(figureBlock(String(adherence.totalAdherencia), "suman adherencia"));
    figures2.appendChild(figureBlock(String(adherence.completadas), "completadas"));
    figures2.appendChild(figureBlock(String(adherence.adaptadas), "adaptadas"));
    panel.appendChild(figures2);
    var figures3 = App.el("div", "figures");
    figures3.setAttribute("aria-label", "Recuperación, parciales y omitidas");
    figures3.appendChild(figureBlock(String(adherence.recuperacionValida), "recuperación válida"));
    figures3.appendChild(figureBlock(String(adherence.parciales), "parciales · no suman"));
    figures3.appendChild(figureBlock(String(adherence.omitidas), "omitidas · no suman"));
    panel.appendChild(figures3);

    panel.appendChild(App.el("h2", "section-title", "Logros"));
    panel.appendChild(App.el("p", "lede small",
      "Privados y discretos. Nunca se basan solo en calorías o peso, y no hay rankings ni comparación con otras personas."));
    var picks = data.pickAchievements();
    if (picks.alcanzado) panel.appendChild(buildAchievementCard(picks.alcanzado, "Alcanzado"));
    if (picks.cercano) panel.appendChild(buildAchievementCard(picks.cercano, "Cercano"));
    if (!picks.alcanzado && !picks.cercano) {
      App.states.empty(panel, { title: "Todavía no hay logros", body: "Vuelven a aparecer aquí en cuanto registres sesiones." });
    }
  }

  function figureBlock(num, label) {
    var f = App.el("div", "figure");
    f.appendChild(App.el("p", "figure__num", num));
    f.appendChild(App.el("p", "figure__label", label));
    return f;
  }

  function buildAchievementCard(a, kind) {
    var p = App.el("p", "achievement");
    var mark = App.el("span", "achievement__mark");
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l2.5 5.6 6.1.6-4.6 4.1 1.4 6-5.4-3-5.4 3 1.4-6L3.4 9.2l6.1-.6L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    p.appendChild(mark);
    p.appendChild(document.createTextNode(kind + ": " + a.titulo + ". Logro privado, solo lo ves tú."));
    return p;
  }

  /* ---- Pestaña: Métricas personales opcionales (nota 27) ----------------- */

  function renderMetricas(panel, ctx) {
    panel.innerHTML = "";
    var data = App.data;

    if (ctx.forceEmpty) {
      App.states.empty(panel, {
        title: "Todavía no hay métricas registradas",
        body: "Registrar peso o medidas es opcional. Este estado está forzado desde el panel de demo.",
        actionLabel: "Registrar métrica",
        onAction: function () { openMetricSheet(null, panel, ctx); }
      });
      return;
    }

    panel.appendChild(App.el("p", "notice notice--info",
      "Registrar peso o medidas es opcional y no condiciona las recomendaciones de tu próxima sesión. " +
      "No hay conteo de calorías, dietas ni recomendaciones de suplementos."));

    ["peso", "medida"].forEach(function (tipo) {
      var trend = data.metricTrend(tipo);
      if (trend) {
        panel.appendChild(App.el("p", "field__label", tipo === "peso" ? "Tendencia de peso" : "Tendencia de medidas"));
        panel.appendChild(App.el("p", "small", trend.texto));
      }
    });

    var list = data.BODY_METRICS.slice().sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    if (!list.length) {
      App.states.empty(panel, { title: "Todavía no hay métricas registradas", body: "Registrar peso o medidas es opcional." });
    } else {
      var ul = App.el("ul", "catalog-list");
      list.forEach(function (m) { ul.appendChild(buildMetricRow(m, panel, ctx)); });
      panel.appendChild(ul);
    }

    var addBtn = App.el("button", "btn btn--primary btn--block", "Registrar métrica");
    addBtn.type = "button";
    addBtn.addEventListener("click", function () { openMetricSheet(null, panel, ctx); });
    panel.appendChild(addBtn);
  }

  function buildMetricRow(m, panel, ctx) {
    var li = App.el("li", "catalog-card");
    var top = App.el("div", "catalog-card__top");
    var body = App.el("div", "catalog-card__body");
    var label = (m.tipo === "peso" ? "Peso" : "Medida" + (m.zona ? " · " + m.zona : ""));
    body.appendChild(App.el("p", "catalog-card__name", label + ": " + m.valor + " " + m.unidad));
    body.appendChild(App.el("p", "catalog-card__meta", m.fecha + " · " + (PROCEDENCIA_LABEL[m.procedencia] || m.procedencia)));
    top.appendChild(body);
    top.appendChild(App.sync.badge(m.sync || "local"));
    li.appendChild(top);

    if (m.versions && m.versions.length) {
      li.appendChild(App.el("p", "small", "Corregido. Valor anterior: " + m.versions[0].valor + " " + m.versions[0].unidad +
        " (" + m.versions[0].motivo + ")"));
    }

    var actions = App.el("div", "dayrow__actions");
    var correctBtn = App.el("button", "chip", "Corregir");
    correctBtn.type = "button";
    correctBtn.addEventListener("click", function () { openMetricCorrectionSheet(m, panel, ctx); });
    actions.appendChild(correctBtn);
    li.appendChild(actions);
    return li;
  }

  function openMetricSheet(existing, panel, ctx) {
    App.openSheet({
      title: "Registrar métrica",
      render: function (body) {
        var tipoValue = "peso";
        body.appendChild(App.el("p", "field__label", "Tipo"));
        var tipoGroup = App.el("div", "picker");
        tipoGroup.setAttribute("role", "group");
        tipoGroup.setAttribute("aria-label", "Tipo de métrica");
        [["peso", "Peso"], ["medida", "Medida corporal"]].forEach(function (pair) {
          var b = App.el("button", "picker__btn", pair[1]);
          b.type = "button";
          b.setAttribute("aria-pressed", String(pair[0] === tipoValue));
          b.addEventListener("click", function () {
            tipoValue = pair[0];
            Array.prototype.forEach.call(tipoGroup.children, function (c) { c.setAttribute("aria-pressed", "false"); });
            b.setAttribute("aria-pressed", "true");
            unidadInput.value = tipoValue === "peso" ? "kg" : "cm";
          });
          tipoGroup.appendChild(b);
        });
        body.appendChild(tipoGroup);

        var valorField = App.el("div", "field");
        var valorLabel = App.el("label", "field__label", "Valor");
        valorLabel.setAttribute("for", "metricValor");
        valorField.appendChild(valorLabel);
        var valorInput = document.createElement("input");
        valorInput.type = "number"; valorInput.step = "0.1"; valorInput.id = "metricValor";
        valorField.appendChild(valorInput);
        var valorError = App.el("p", "field__error", "Escribe un valor numérico mayor que 0.");
        valorError.id = "metricValorError"; valorError.hidden = true; valorError.setAttribute("role", "alert");
        valorField.appendChild(valorError);
        body.appendChild(valorField);

        var unidadField = App.el("div", "field");
        var unidadLabel = App.el("label", "field__label", "Unidad");
        unidadLabel.setAttribute("for", "metricUnidad");
        unidadField.appendChild(unidadLabel);
        var unidadInput = document.createElement("input");
        unidadInput.type = "text"; unidadInput.id = "metricUnidad"; unidadInput.value = "kg";
        unidadField.appendChild(unidadInput);
        body.appendChild(unidadField);

        var fechaField = App.el("div", "field");
        var fechaLabel = App.el("label", "field__label", "Fecha");
        fechaLabel.setAttribute("for", "metricFecha");
        fechaField.appendChild(fechaLabel);
        var fechaInput = document.createElement("input");
        fechaInput.type = "date"; fechaInput.id = "metricFecha";
        fechaField.appendChild(fechaInput);
        var fechaError = App.el("p", "field__error", "Elige una fecha.");
        fechaError.id = "metricFechaError"; fechaError.hidden = true; fechaError.setAttribute("role", "alert");
        fechaField.appendChild(fechaError);
        body.appendChild(fechaField);

        var saveBtn = App.el("button", "btn btn--primary btn--block", "Guardar");
        saveBtn.type = "button";
        saveBtn.addEventListener("click", function () {
          var valorOk = valorInput.value !== "" && !isNaN(parseFloat(valorInput.value)) && parseFloat(valorInput.value) > 0;
          var fechaOk = !!fechaInput.value;
          valorError.hidden = valorOk;
          fechaError.hidden = fechaOk;
          valorInput.removeAttribute("aria-invalid"); valorInput.removeAttribute("aria-describedby");
          fechaInput.removeAttribute("aria-invalid"); fechaInput.removeAttribute("aria-describedby");
          if (!valorOk) { valorInput.setAttribute("aria-invalid", "true"); valorInput.setAttribute("aria-describedby", "metricValorError"); }
          if (!fechaOk) { fechaInput.setAttribute("aria-invalid", "true"); fechaInput.setAttribute("aria-describedby", "metricFechaError"); }
          if (!valorOk) { valorInput.focus(); return; }
          if (!fechaOk) { fechaInput.focus(); return; }
          App.data.addMetric({ tipo: tipoValue, valor: parseFloat(valorInput.value), unidad: unidadInput.value.trim() || (tipoValue === "peso" ? "kg" : "cm"), fecha: fechaInput.value });
          App.closeSheet();
          App.toast("Métrica registrada.");
          renderMetricas(panel, ctx);
        });
        body.appendChild(saveBtn);
      }
    });
  }

  function openMetricCorrectionSheet(m, panel, ctx) {
    App.openSheet({
      title: "Corregir métrica",
      render: function (body) {
        body.appendChild(App.el("p", "lede small", "Se crea una versión con el valor corregido; el valor anterior sigue consultable."));

        var valorField = App.el("div", "field");
        var valorLabel = App.el("label", "field__label", "Nuevo valor");
        valorLabel.setAttribute("for", "correctMetricValor");
        valorField.appendChild(valorLabel);
        var valorInput = document.createElement("input");
        valorInput.type = "number"; valorInput.step = "0.1"; valorInput.id = "correctMetricValor"; valorInput.value = m.valor;
        valorField.appendChild(valorInput);
        var valorError = App.el("p", "field__error", "Escribe un valor numérico mayor que 0.");
        valorError.id = "correctMetricValorError"; valorError.hidden = true; valorError.setAttribute("role", "alert");
        valorField.appendChild(valorError);
        body.appendChild(valorField);

        var motivoField = App.el("div", "field");
        var motivoLabel = App.el("label", "field__label", "Motivo de la corrección");
        motivoLabel.setAttribute("for", "correctMetricMotivo");
        motivoField.appendChild(motivoLabel);
        var motivoInput = document.createElement("input");
        motivoInput.type = "text"; motivoInput.id = "correctMetricMotivo";
        motivoField.appendChild(motivoInput);
        var motivoError = App.el("p", "field__error", "Escribe el motivo de la corrección.");
        motivoError.id = "correctMetricMotivoError"; motivoError.hidden = true; motivoError.setAttribute("role", "alert");
        motivoField.appendChild(motivoError);
        body.appendChild(motivoField);

        var saveBtn = App.el("button", "btn btn--primary btn--block", "Guardar corrección");
        saveBtn.type = "button";
        saveBtn.addEventListener("click", function () {
          var valorOk = valorInput.value !== "" && !isNaN(parseFloat(valorInput.value)) && parseFloat(valorInput.value) > 0;
          var motivo = motivoInput.value.trim();
          valorError.hidden = valorOk;
          motivoError.hidden = !!motivo;
          if (!valorOk) { valorInput.setAttribute("aria-invalid", "true"); valorInput.setAttribute("aria-describedby", "correctMetricValorError"); valorInput.focus(); return; }
          if (!motivo) { motivoInput.setAttribute("aria-invalid", "true"); motivoInput.setAttribute("aria-describedby", "correctMetricMotivoError"); motivoInput.focus(); return; }
          App.data.correctMetric(m.id, { valor: parseFloat(valorInput.value) }, motivo);
          App.closeSheet();
          App.toast("Métrica corregida: el valor anterior sigue disponible.");
          renderMetricas(panel, ctx);
        });
        body.appendChild(saveBtn);
      }
    });
  }

  App.registerView("history", { title: "Historial", render: render });
})();
