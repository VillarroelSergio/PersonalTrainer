/* =====================================================================
 * Vista: Importación manual de actividad (LOTE 5)
 * Notas 07 y 29. Simulación completa, sin parser real y sin
 * <input type="file">: elegir un archivo ficticio de data.IMPORT_FILES
 * dispara el mismo camino que un archivo real recorrería. Todo el estado
 * del asistente vive en App.viewContext("import") (no en variables de
 * módulo), consistente con el resto del prototipo.
 * ================================================================== */
(function () {
  "use strict";

  var App = window.App;

  var FORMATOS_ADMITIDOS = ["FIT", "TCX", "GPX", "CSV"];

  function freshImportState() {
    return { stage: "pick", fileId: null, nombre: "", tipo: "", sessionId: "" };
  }

  function render(mount, params) {
    var ctx = App.viewContext("import");
    if (!ctx.state) ctx.state = freshImportState();
    if (params && params.sessionId && !ctx.state.sessionId) ctx.state.sessionId = params.sessionId;
    draw(mount, App.data, ctx.state);
  }

  function draw(mount, data, s) {
    mount.innerHTML = "";
    if (s.stage === "unsupported") { drawUnsupported(mount, data, s); return; }
    if (s.stage === "invalid") { drawInvalid(mount, data, s); return; }
    if (s.stage === "duplicate") { drawDuplicate(mount, data, s); return; }
    if (s.stage === "review") { drawReview(mount, data, s); return; }
    if (s.stage === "saved") { drawSaved(mount, data, s); return; }
    drawPick(mount, data, s);
  }

  /* ---- Paso 1: elegir archivo ficticio -------------------------------------- */

  function drawPick(mount, data, s) {
    var wrap = App.el("section", "view-import");
    wrap.appendChild(App.el("p", "kicker", "Importar actividad"));
    wrap.appendChild(App.el("h1", "view-title", "Elige un archivo"));
    wrap.appendChild(App.el("p", "lede small",
      "Prototipo sin parser real: elige uno de estos archivos ficticios para ver cómo se comportaría cada caso. " +
      "Se admiten .FIT, .TCX, .GPX y CSV de intervalos."));

    var list = App.el("ul", "import-filelist");
    data.IMPORT_FILES.forEach(function (file) {
      var li = App.el("li", "import-file");
      var body = document.createElement("div");
      body.appendChild(App.el("p", "import-file__name", file.nombre));
      body.appendChild(App.el("p", "import-file__meta", "." + file.formato + " · " + file.tamanoKB + " KB"));
      li.appendChild(body);
      var btn = App.el("button", "btn btn--ghost btn--sm", "Elegir");
      btn.type = "button";
      btn.setAttribute("aria-label", "Elegir " + file.nombre);
      btn.addEventListener("click", function () { chooseFile(mount, data, s, file); });
      li.appendChild(btn);
      list.appendChild(li);
    });
    wrap.appendChild(list);

    var cancelBtn = App.el("button", "btn btn--quiet", "Cancelar y volver");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", function () {
      App.viewContext("import").state = freshImportState();
      App.navigate("home", {}, { replace: true });
    });
    wrap.appendChild(cancelBtn);

    mount.appendChild(wrap);
  }

  function chooseFile(mount, data, s, file) {
    s.fileId = file.id;
    if (FORMATOS_ADMITIDOS.indexOf(file.formato) < 0) {
      s.stage = "unsupported";
    } else if (file.valido === false) {
      s.stage = "invalid";
    } else if (file.duplicadoDe) {
      s.stage = "duplicate";
    } else {
      s.stage = "review";
      s.nombre = file.nombre.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
      s.tipo = (file.analisis && file.analisis.tipo) || "Actividad";
    }
    draw(mount, data, s);
  }

  /* ---- Camino 1: formato no admitido ---------------------------------------- */

  function drawUnsupported(mount, data, s) {
    var file = data.findImportFile(s.fileId);
    var wrap = App.el("section", "view-import");
    wrap.appendChild(App.el("h1", "view-title", "Formato no admitido"));
    // App.states.error() limpia el contenedor que recibe: se dibuja en un
    // `body` aparte para no perder el <h1> de la vista (nota 12).
    var body = App.el("div");
    App.states.error(body, {
      title: "“." + file.formato + "” no es un formato admitido",
      body: "Esta versión admite .FIT (prioritario), .TCX, .GPX y CSV de intervalos. Elige otro archivo con uno de estos formatos.",
      onBack: function () { s.stage = "pick"; s.fileId = null; draw(mount, data, s); },
      backLabel: "Elegir otro archivo"
    });
    wrap.appendChild(body);
    mount.appendChild(wrap);
  }

  /* ---- Camino 2: archivo inválido -------------------------------------------- */

  function drawInvalid(mount, data, s) {
    var file = data.findImportFile(s.fileId);
    var wrap = App.el("section", "view-import");
    wrap.appendChild(App.el("h1", "view-title", "Archivo inválido"));
    var body = App.el("div");
    App.states.error(body, {
      title: file.nombre + " no se pudo importar",
      body: file.motivoInvalido,
      onBack: function () { s.stage = "pick"; s.fileId = null; draw(mount, data, s); },
      backLabel: "Elegir otro archivo"
    });
    wrap.appendChild(body);
    mount.appendChild(wrap);
  }

  /* ---- Camino 3: posible duplicado ------------------------------------------- */

  function drawDuplicate(mount, data, s) {
    var file = data.findImportFile(s.fileId);
    var match = data.findSession(file.duplicadoDe);

    var wrap = App.el("section", "view-import");
    wrap.appendChild(App.el("h1", "view-title", "Posible duplicado"));
    wrap.appendChild(App.el("p", "notice notice--warn",
      file.nombre + " se parece a una actividad que ya tienes registrada" +
      (match ? " (" + match.nombre + ")" : "") + ". Puedes ver la coincidencia, importar de todos modos o cancelar."));

    if (match) {
      var viewBtn = App.el("button", "btn btn--ghost btn--block", "Ver coincidencia");
      viewBtn.type = "button";
      viewBtn.addEventListener("click", function () { openMatchSheet(match); });
      wrap.appendChild(viewBtn);
    }

    var importAnyway = App.el("button", "btn btn--primary btn--block", "Importar de todos modos");
    importAnyway.type = "button";
    importAnyway.addEventListener("click", function () {
      s.stage = "review";
      s.nombre = file.nombre.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
      s.tipo = (file.analisis && file.analisis.tipo) || "Actividad";
      draw(mount, data, s);
    });
    wrap.appendChild(importAnyway);

    var cancelBtn = App.el("button", "btn btn--ghost btn--block", "Cancelar");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", function () {
      App.toast("Importación cancelada: sin cambios.");
      App.viewContext("import").state = freshImportState();
      App.navigate("home", {}, { replace: true });
    });
    wrap.appendChild(cancelBtn);

    mount.appendChild(wrap);
  }

  function openMatchSheet(match) {
    App.openSheet({
      title: "Coincidencia encontrada",
      render: function (body) {
        body.appendChild(App.el("p", "field__label", match.nombre));
        body.appendChild(App.el("p", "lede small",
          (match.duracionPrevista || 0) + " min · estado: " + match.estado + " · procedencia: " + match.procedencia));
      }
    });
  }

  /* ---- Camino 4: archivo válido — análisis + asociación --------------------- */

  function drawReview(mount, data, s) {
    var file = data.findImportFile(s.fileId);
    var a = file.analisis;

    var wrap = App.el("section", "view-import");
    wrap.appendChild(App.el("p", "kicker", file.nombre));
    wrap.appendChild(App.el("h1", "view-title", "Análisis breve"));

    var box = App.el("div", "import-analysis");
    box.appendChild(App.el("p", "import-analysis__row", "Tipo: " + a.tipo));
    box.appendChild(App.el("p", "import-analysis__row", "Duración: " + a.duracionMin + " min"));
    box.appendChild(App.el("p", "import-analysis__row", "Distancia: " + a.distanciaKm + " km"));
    box.appendChild(App.el("p", "import-analysis__row", "Ritmo: " + a.ritmo));
    box.appendChild(App.el("p", "import-analysis__row",
      a.fcMedia ? "Frecuencia cardiaca: " + a.fcMedia + " ppm media · " + a.fcMax + " ppm máx." :
        "Este archivo no incluye frecuencia cardiaca: no se muestra un valor inventado."));
    if (a.zonas && a.zonas.length) {
      box.appendChild(App.el("p", "import-analysis__row",
        "Zonas: " + a.zonas.map(function (z) { return z.zona + " " + z.min + " min"; }).join(" · ")));
    } else {
      box.appendChild(App.el("p", "import-analysis__row", "Este archivo no incluye zonas de frecuencia cardiaca."));
    }
    box.appendChild(App.el("p", "import-analysis__row", "Carga estimada: " + a.cargaEstimada));
    wrap.appendChild(box);

    wrap.appendChild(App.el("p", "field__label", "Editar antes de guardar"));

    var nameField = App.el("div", "field");
    var nameLabel = App.el("label", "field__label", "Nombre");
    nameLabel.setAttribute("for", "importName");
    nameField.appendChild(nameLabel);
    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.id = "importName";
    nameInput.value = s.nombre;
    nameInput.addEventListener("input", function () { s.nombre = nameInput.value; });
    nameField.appendChild(nameInput);
    wrap.appendChild(nameField);

    var tipoField = App.el("div", "field");
    var tipoLabel = App.el("label", "field__label", "Tipo de actividad");
    tipoLabel.setAttribute("for", "importTipo");
    tipoField.appendChild(tipoLabel);
    var tipoInput = document.createElement("input");
    tipoInput.type = "text";
    tipoInput.id = "importTipo";
    tipoInput.value = s.tipo;
    tipoInput.addEventListener("input", function () { s.tipo = tipoInput.value; });
    tipoField.appendChild(tipoInput);
    wrap.appendChild(tipoField);

    var sessionField = App.el("div", "field");
    var sessionLabel = App.el("label", "field__label", "Asociar a sesión planificada");
    sessionLabel.setAttribute("for", "importSession");
    sessionField.appendChild(sessionLabel);
    var select = document.createElement("select");
    select.id = "importSession";
    var noneOpt = document.createElement("option");
    noneOpt.value = ""; noneOpt.textContent = "Ninguna";
    select.appendChild(noneOpt);
    data.SESSIONS.filter(function (sess) {
      return sess.tipo === "resistencia" && (sess.estado === "planificada" || sess.estado === "en_curso");
    }).forEach(function (sess) {
      var opt = document.createElement("option");
      opt.value = sess.id;
      opt.textContent = sess.nombre + " (" + data.dayByKey(sess.day).nombre + ")";
      if (sess.id === s.sessionId) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", function () { s.sessionId = select.value; });
    sessionField.appendChild(select);
    wrap.appendChild(sessionField);

    var saveBtn = App.el("button", "btn btn--primary btn--block", "Guardar actividad");
    saveBtn.type = "button";
    saveBtn.addEventListener("click", function () {
      if (!s.nombre.trim()) { App.toast("Escribe un nombre para la actividad."); nameInput.focus(); return; }
      var record = data.saveImportedActivity(file, { nombre: s.nombre, tipo: s.tipo, sessionId: s.sessionId || null });
      App.persist();
      s.stage = "saved";
      s.savedRecord = record;
      draw(mount, data, s);
    });
    wrap.appendChild(saveBtn);

    var cancelBtn = App.el("button", "btn btn--ghost btn--block", "Cancelar");
    cancelBtn.type = "button";
    cancelBtn.addEventListener("click", function () {
      App.toast("Importación cancelada: sin cambios.");
      App.viewContext("import").state = freshImportState();
      App.navigate("home", {}, { replace: true });
    });
    wrap.appendChild(cancelBtn);

    mount.appendChild(wrap);
  }

  /* ---- Guardado: procedencia importado + impacto en contexto (nota 07/24) --- */

  function drawSaved(mount, data, s) {
    var wrap = App.el("section", "view-import");
    wrap.appendChild(App.el("h1", "view-title", "Actividad guardada"));

    var badges = App.el("div", "badge-row");
    badges.appendChild(App.el("span", "state state--completada", "Procedencia: importado"));
    badges.appendChild(App.sync.badge("local"));
    wrap.appendChild(badges);

    wrap.appendChild(App.el("p", "lede", s.savedRecord.nombre + " se guardó en tu historial."));

    var impact = data.loadContext();
    wrap.appendChild(App.el("p", "notice notice--info",
      impact || "Esta actividad no cambia tu plan automáticamente. Podrás verla en tu historial."));

    var homeBtn = App.el("button", "btn btn--primary btn--block", "Volver a inicio");
    homeBtn.type = "button";
    homeBtn.addEventListener("click", function () {
      App.viewContext("import").state = freshImportState();
      App.navigate("home", {}, { replace: true });
    });
    wrap.appendChild(homeBtn);

    var anotherBtn = App.el("button", "btn btn--ghost btn--block", "Importar otro archivo");
    anotherBtn.type = "button";
    anotherBtn.addEventListener("click", function () {
      App.viewContext("import").state = freshImportState();
      App.navigate("import", {}, { replace: true });
    });
    wrap.appendChild(anotherBtn);

    mount.appendChild(wrap);
  }

  App.registerView("import", { title: "Importar actividad", render: render });
})();
