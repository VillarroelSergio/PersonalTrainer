/*
 * Trainer — prototipo navegable (datos ficticios, todo en memoria).
 * Sin backend, sin fetch, sin módulos ES: script clásico para que funcione con file://.
 * ponytail: motor de reglas de adaptación deliberadamente simple (if/else), no es
 * el motor determinista real descrito en MVP-DEFINITION.md; sustituir si se valida por un profesional.
 */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
   * Datos ficticios
   * ------------------------------------------------------------------- */

  var WEEK = [
    { key: "lun", day: "Lunes", short: "Lun", title: "Push", type: "fuerza", status: "completada", duration: 52, detail: "Press banca, press militar, fondos en máquina, elevaciones laterales." },
    { key: "mar", day: "Martes", short: "Mar", title: "Carrera suave", type: "cardio", status: "completada", duration: 30, detail: "30 min a ritmo cómodo, recuperación activa tras Push." },
    { key: "mie", day: "Miércoles", short: "Mié", title: "Pull", type: "fuerza", status: "hoy", duration: null, detail: "Jalón al pecho, remo sentado, face pull, pullover en polea, curl de bíceps." },
    { key: "jue", day: "Jueves", short: "Jue", title: "Descanso", type: "descanso", status: "libre", duration: null, detail: "Día libre." },
    { key: "vie", day: "Viernes", short: "Vie", title: "Legs", type: "fuerza", status: "planificada", duration: null, detail: "Sentadilla, prensa, curl femoral, elevación de gemelo." },
    { key: "sab", day: "Sábado", short: "Sáb", title: "Descanso", type: "descanso", status: "libre", duration: null, detail: "Día libre." },
    { key: "dom", day: "Domingo", short: "Dom", title: "Carrera larga", type: "cardio", status: "planificada", duration: null, detail: "70-80 min a ritmo constante.", intense: true }
  ];

  var PHASES = [
    { name: "Adaptación", weeks: "Semanas 1-2", status: "done" },
    { name: "Progresión · hipertrofia", weeks: "Semanas 3-6 (estás aquí)", status: "current" },
    { name: "Descarga", weeks: "Semana 7", status: "pending" },
    { name: "Mantenimiento", weeks: "Semana 8", status: "pending" }
  ];

  var HISTORY = [
    { title: "Push", meta: "Lunes · 52 min", status: "completed" },
    { title: "Carrera suave", meta: "Martes · 30 min", status: "completed" },
    { title: "Pull", meta: "Semana pasada · completada", status: "completed" },
    { title: "Legs", meta: "Semana pasada · adaptada por fatiga", status: "adapted" },
    { title: "Carrera larga", meta: "Hace 2 semanas · omitida y recolocada al lunes", status: "skipped" }
  ];

  var EXERCISES = [
    {
      id: "jalon",
      nombre: "Jalón al pecho",
      variante: "Polea (agarre ancho)",
      patron: "Tracción vertical",
      icon: "pull",
      objetivo: "3 series × 10-12 reps",
      ultimoTexto: "Último resultado: 52.5 kg × 11 reps",
      restSeconds: 90,
      sets: [
        { peso: 52.5, reps: 11, estado: "pendiente" },
        { peso: 52.5, reps: 10, estado: "pendiente" },
        { peso: 50, reps: 12, estado: "pendiente" }
      ],
      difficulty: null,
      included: true,
      variantes: {
        favoritas: [{ nombre: "Polea (agarre ancho)", meta: "Tu variante habitual · última vez 52.5 kg × 11" }],
        recientes: [{ nombre: "Agarre supino (polea)", meta: "Usada hace 2 semanas · 47.5 kg × 10" }],
        mismoPatron: [
          { nombre: "Dominada asistida", meta: "Mismo patrón: tracción vertical" },
          { nombre: "Jalón a una mano (polea)", meta: "Mismo patrón: tracción vertical" }
        ],
        catalogo: [{ nombre: "Remo en máquina T", meta: "Catálogo general" }]
      },
      guide: {
        cues: [
          "Lleva las escápulas hacia abajo y atrás antes de tirar.",
          "Guía la barra hacia la parte alta del pecho.",
          "Controla la fase excéntrica, no sueltes de golpe.",
          "Evita balancear el torso hacia atrás para ayudarte con impulso."
        ],
        muscles: ["Dorsal ancho", "Redondo mayor", "Bíceps", "Trapecio inferior"]
      },
      video: "https://www.youtube.com/results?search_query=jalon+al+pecho+tecnica"
    },
    {
      id: "remo",
      nombre: "Remo sentado",
      variante: "Máquina",
      patron: "Tracción horizontal",
      icon: "row",
      objetivo: "3 series × 10-12 reps",
      ultimoTexto: "Último resultado: 45 kg × 12 reps",
      restSeconds: 90,
      sets: [
        { peso: 45, reps: 12, estado: "pendiente" },
        { peso: 45, reps: 11, estado: "pendiente" },
        { peso: 42.5, reps: 12, estado: "pendiente" }
      ],
      difficulty: null,
      included: true,
      variantes: {
        favoritas: [{ nombre: "Máquina", meta: "Tu variante habitual · última vez 45 kg × 12" }],
        recientes: [{ nombre: "Remo con cable (agarre neutro)", meta: "Usada hace 3 semanas · 40 kg × 10" }],
        mismoPatron: [{ nombre: "Remo en punta T", meta: "Mismo patrón: tracción horizontal" }],
        catalogo: [{ nombre: "Remo invertido en barra", meta: "Catálogo general" }]
      },
      guide: {
        cues: [
          "Pecho apoyado o torso estable, sin balanceo.",
          "Tira llevando los codos cerca del cuerpo.",
          "Aprieta omóplatos al final del recorrido.",
          "Vuelve controlando el peso, sin dejarlo caer."
        ],
        muscles: ["Dorsal ancho", "Romboides", "Trapecio medio", "Bíceps"]
      },
      video: "https://www.youtube.com/results?search_query=remo+sentado+en+maquina+tecnica"
    },
    {
      id: "facepull",
      nombre: "Face pull",
      variante: "Polea con cuerda",
      patron: "Rotación externa / deltoide posterior",
      icon: "facepull",
      objetivo: "3 series × 15 reps",
      ultimoTexto: "Último resultado: 17.5 kg × 15 reps",
      restSeconds: 60,
      sets: [
        { peso: 17.5, reps: 15, estado: "pendiente" },
        { peso: 17.5, reps: 15, estado: "pendiente" },
        { peso: 15, reps: 15, estado: "pendiente" }
      ],
      difficulty: null,
      included: true,
      variantes: {
        favoritas: [],
        recientes: [{ nombre: "Face pull con banda elástica", meta: "Usada hace 1 mes · más suave para el hombro" }],
        mismoPatron: [{ nombre: "Pájaros con mancuerna", meta: "Mismo grupo: deltoide posterior" }],
        catalogo: [{ nombre: "Rotación externa con banda", meta: "Catálogo general" }]
      },
      guide: {
        cues: [
          "Tira hacia la cara con los codos altos.",
          "Rota los antebrazos hacia atrás al final del recorrido.",
          "Usa un peso ligero; prioriza técnica sobre carga.",
          "Mantén el cuello relajado durante el movimiento."
        ],
        muscles: ["Deltoide posterior", "Manguito rotador", "Trapecio medio"]
      },
      video: "https://www.youtube.com/results?search_query=face+pull+tecnica"
    },
    {
      id: "pullover",
      nombre: "Pullover en polea",
      variante: "Polea alta",
      patron: "Aducción de hombro / dorsal",
      icon: "pullover",
      objetivo: "3 series × 12-15 reps",
      ultimoTexto: "Último resultado: 25 kg × 14 reps",
      restSeconds: 75,
      sets: [
        { peso: 25, reps: 14, estado: "pendiente" },
        { peso: 25, reps: 13, estado: "pendiente" },
        { peso: 22.5, reps: 15, estado: "pendiente" }
      ],
      difficulty: null,
      included: true,
      variantes: {
        favoritas: [],
        recientes: [],
        mismoPatron: [{ nombre: "Pullover con mancuerna", meta: "Mismo patrón: aducción de hombro" }],
        catalogo: [{ nombre: "Pullover en máquina", meta: "Catálogo general" }]
      },
      guide: {
        cues: [
          "Brazos ligeramente flexionados durante todo el recorrido.",
          "Lleva los brazos desde arriba hasta la cadera en arco.",
          "Evita arquear la zona lumbar en exceso.",
          "Siente el estiramiento del dorsal en la fase alta."
        ],
        muscles: ["Dorsal ancho", "Serrato anterior", "Pectoral"]
      },
      video: "https://www.youtube.com/results?search_query=pullover+en+polea+tecnica"
    },
    {
      id: "curl",
      nombre: "Curl de bíceps",
      variante: "Barra Z",
      patron: "Flexión de codo",
      icon: "curl",
      objetivo: "3 series × 10-12 reps",
      ultimoTexto: "Último resultado: 27.5 kg × 10 reps",
      restSeconds: 60,
      sets: [
        { peso: 27.5, reps: 10, estado: "pendiente" },
        { peso: 27.5, reps: 10, estado: "pendiente" },
        { peso: 25, reps: 11, estado: "pendiente" }
      ],
      difficulty: null,
      included: true,
      variantes: {
        favoritas: [],
        recientes: [{ nombre: "Curl con mancuernas alterno", meta: "Usada hace 2 semanas · 14 kg × 11" }],
        mismoPatron: [{ nombre: "Curl en polea con cuerda", meta: "Mismo patrón: flexión de codo" }],
        catalogo: [{ nombre: "Curl en banco Scott", meta: "Catálogo general" }]
      },
      guide: {
        cues: [
          "Codos pegados al cuerpo durante todo el recorrido.",
          "Sube sin balancear el torso hacia atrás.",
          "Controla la bajada, no dejes caer la barra.",
          "Rango completo sin bloquear el codo con fuerza."
        ],
        muscles: ["Bíceps braquial", "Braquial anterior", "Antebrazo"]
      },
      video: "https://www.youtube.com/results?search_query=curl+de+biceps+barra+z+tecnica"
    }
  ];

  var OTHER_FAVORITES = [
    "Jalón al pecho en polea",
    "Remo sentado en máquina",
    "Extensión de tríceps con cuerda"
  ];

  var PROGRESS_EXAMPLE = [
    { fecha: "Hoy", valor: "52.5 kg × 11 reps" },
    { fecha: "Hace 1 semana", valor: "50 kg × 12 reps" },
    { fecha: "Hace 2 semanas", valor: "50 kg × 10 reps" },
    { fecha: "Hace 3 semanas", valor: "47.5 kg × 11 reps" },
    { fecha: "Hace 4 semanas", valor: "47.5 kg × 9 reps" }
  ];

  /* ---------------------------------------------------------------------
   * Estado de la sesión / check-in / UI
   * ------------------------------------------------------------------- */

  var session = {
    state: "prevista", // prevista | adaptada
    exerciseMode: "confirm" // confirm | editAll
  };

  var checkinState = {
    energia: null,
    motivacion: null,
    tiempo: null,
    molestias: null,
    zona: null,
    lado: null,
    intensidadZona: null,
    tipoMolestia: null
  };

  var currentExerciseId = null;
  var restTimerHandle = null;
  var restTimerRemaining = 0;
  var pendingAdaptation = null;
  var rescheduleTarget = null; // key of the day being rescheduled

  /* ---------------------------------------------------------------------
   * Utilidades
   * ------------------------------------------------------------------- */

  function $(id) { return document.getElementById(id); }

  function showToast(message) {
    var toast = $("toast");
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(function () { toast.hidden = true; }, 2600);
  }

  function findExercise(id) {
    for (var i = 0; i < EXERCISES.length; i++) {
      if (EXERCISES[i].id === id) return EXERCISES[i];
    }
    return null;
  }

  function findDay(key) {
    for (var i = 0; i < WEEK.length; i++) {
      if (WEEK[i].key === key) return WEEK[i];
    }
    return null;
  }

  function iconMarkup(kind) {
    var icons = {
      pull: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M6 21h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      row: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12h6m0 0l3-3m-3 3l3 3M21 12h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      facepull: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M6 20c1-4 3-6 6-6s5 2 6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      pullover: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 8c3 6 13 6 16 0M6 16c2-2 10-2 12 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      curl: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 18l4-9 5 3 5-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      recovery: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 21c-4-3-8-6-8-10a4 4 0 018-1 4 4 0 018 1c0 4-4 7-8 10z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    };
    return icons[kind] || icons.pull;
  }

  /* ---------------------------------------------------------------------
   * Navegación entre vistas (sin recarga)
   * ------------------------------------------------------------------- */

  function showView(name) {
    var views = document.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle("is-active", views[i].getAttribute("data-view") === name);
    }
    var navBtns = document.querySelectorAll(".bottom-nav__btn");
    var topLevel = ["home", "plan", "session", "history"].indexOf(name) >= 0 ? name : null;
    for (var j = 0; j < navBtns.length; j++) {
      if (topLevel && navBtns[j].getAttribute("data-nav") === topLevel) {
        navBtns[j].setAttribute("aria-current", "page");
      } else {
        navBtns[j].removeAttribute("aria-current");
      }
    }
    window.scrollTo(0, 0);

    if (name === "home") renderHome();
    if (name === "plan") renderPlan();
    if (name === "session") renderSession();
    if (name === "history") renderHistory();
  }

  function wireNav() {
    var navEls = document.querySelectorAll("[data-nav]");
    for (var i = 0; i < navEls.length; i++) {
      navEls[i].addEventListener("click", function (e) {
        showView(e.currentTarget.getAttribute("data-nav"));
      });
    }
  }

  /* ---------------------------------------------------------------------
   * Home — "Tu camino"
   * ------------------------------------------------------------------- */

  function renderHome() {
    var sessionsPlanned = WEEK.filter(function (d) { return d.type !== "descanso"; }).length;
    var sessionsDone = WEEK.filter(function (d) { return d.status === "completada"; }).length;
    var minutes = WEEK.reduce(function (sum, d) { return sum + (d.duration || 0); }, 0);

    $("weekDone").textContent = sessionsDone;
    $("weekTotal").textContent = sessionsPlanned;
    $("weekMinutes").textContent = minutes;

    var list = $("recentActivity");
    list.innerHTML = "";
    HISTORY.slice(0, 3).forEach(function (item) {
      list.appendChild(buildActivityItem(item));
    });
  }

  function badgeForStatus(status) {
    var map = {
      completed: { cls: "badge--completed", text: "Completada" },
      adapted: { cls: "badge--adapted", text: "Adaptada" },
      skipped: { cls: "badge--skipped", text: "Omitida y recolocada" },
      planned: { cls: "badge--planned", text: "Planificada" }
    };
    return map[status] || map.planned;
  }

  function buildActivityItem(item) {
    var el = document.createElement("div");
    el.className = "activity-item";
    var b = badgeForStatus(item.status);
    el.innerHTML =
      '<div><p class="activity-item__title">' + item.title + '</p>' +
      '<p class="activity-item__meta">' + item.meta + "</p></div>" +
      '<span class="badge ' + b.cls + '">' + b.text + "</span>";
    return el;
  }

  /* ---------------------------------------------------------------------
   * Plan semanal + fases
   * ------------------------------------------------------------------- */

  function renderPlan() {
    var weekList = $("weekList");
    weekList.innerHTML = "";
    WEEK.forEach(function (day) {
      weekList.appendChild(buildDayCard(day));
    });

    var timeline = $("phaseTimeline");
    timeline.innerHTML = "";
    PHASES.forEach(function (phase) {
      var li = document.createElement("li");
      li.className = "phase-item" + (phase.status === "current" ? " phase-item--current" : "") + (phase.status === "done" ? " phase-item--done" : "");
      li.innerHTML = '<p class="phase-item__title">' + phase.name + '</p><p class="phase-item__meta">' + phase.weeks + "</p>";
      timeline.appendChild(li);
    });

    $("planWarning").hidden = true;
  }

  function dayStatusLabel(day) {
    if (day.status === "completada") return { text: "Completada", cls: "badge--completed" };
    if (day.status === "hoy") return { text: "Hoy", cls: "badge--planned" };
    if (day.status === "planificada") return { text: "Planificada", cls: "badge--planned" };
    if (day.status === "omitida") return { text: "Omitida", cls: "badge--skipped" };
    if (day.status === "recolocada") return { text: "Recolocada", cls: "badge--skipped" };
    return { text: "Libre", cls: "badge--sim" };
  }

  function buildDayCard(day) {
    var card = document.createElement("div");
    card.className = "day-card" + (day.status === "hoy" ? " day-card--today" : "");
    var label = dayStatusLabel(day);

    var metaText = day.detail;
    if (day.duration) metaText = day.duration + " min · " + day.detail;
    if (day.status === "recolocada" && day.movedTo) metaText = "Recolocada al " + day.movedTo + ". " + day.detail;
    if (day.status === "omitida") metaText = "Omitida esta semana. " + day.detail;

    var html =
      '<div class="day-card__top">' +
      '<div><p class="day-card__day">' + day.day + '</p>' +
      '<p class="day-card__title">' + day.title + '</p>' +
      '<p class="day-card__meta">' + metaText + "</p></div>" +
      '<span class="badge ' + label.cls + '">' + label.text + "</span>" +
      "</div>";

    card.innerHTML = html;

    var actions = document.createElement("div");
    actions.className = "day-card__actions";

    if (day.type !== "descanso") {
      var openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "chip-btn";
      openBtn.textContent = day.status === "hoy" && day.title === "Pull" ? "Abrir sesión" : "Ver detalle";
      openBtn.addEventListener("click", function () {
        if (day.status === "hoy" && day.title === "Pull") {
          showView("session");
        } else {
          openDaySummary(day);
        }
      });
      actions.appendChild(openBtn);

      if (day.status === "planificada") {
        var skipBtn = document.createElement("button");
        skipBtn.type = "button";
        skipBtn.className = "chip-btn";
        skipBtn.textContent = "Omitir";
        skipBtn.addEventListener("click", function () {
          day.status = "omitida";
          renderPlan();
          showToast(day.title + " marcada como omitida.");
        });
        actions.appendChild(skipBtn);

        var moveBtn = document.createElement("button");
        moveBtn.type = "button";
        moveBtn.className = "chip-btn";
        moveBtn.textContent = "Recolocar";
        moveBtn.addEventListener("click", function () { openRescheduleModal(day); });
        actions.appendChild(moveBtn);
      }
    }

    card.appendChild(actions);
    return card;
  }

  function openDaySummary(day) {
    $("daySummaryTitle").textContent = day.title;
    var label = dayStatusLabel(day);
    var card = $("daySummaryCard");
    card.innerHTML =
      '<span class="badge ' + label.cls + '">' + label.text + "</span>" +
      '<p class="stat-big" style="margin-top:10px">' + day.title + "</p>" +
      '<p class="muted">' + day.day + (day.duration ? " · " + day.duration + " min" : "") + "</p>" +
      '<p style="margin-top:12px">' + day.detail + "</p>" +
      '<p class="muted small" style="margin-top:14px">Vista de solo lectura en este prototipo. Solo la sesión Pull de hoy es completamente interactiva.</p>';
    showView("daySummary");
  }

  function openRescheduleModal(day) {
    rescheduleTarget = day.key;
    var freeDays = WEEK.filter(function (d) { return d.type === "descanso"; });
    var body = $("rescheduleModalBody");
    body.innerHTML = '<p class="muted">Elige un día libre para mover <strong>' + day.title + "</strong>.</p>";

    var list = document.createElement("div");
    list.className = "activity-list";
    freeDays.forEach(function (freeDay) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "variant-option";
      btn.innerHTML = '<span class="variant-option__name">' + freeDay.day + "</span><span class=\"variant-option__meta\">Día libre</span>";
      btn.addEventListener("click", function () { confirmReschedule(day, freeDay); });
      list.appendChild(btn);
    });
    body.appendChild(list);
    openModal("rescheduleModal");
  }

  function dayIsAdjacentIntense(freeDay) {
    var idx = WEEK.indexOf(freeDay);
    var prev = WEEK[idx - 1];
    var next = WEEK[idx + 1];
    return (prev && prev.intense) || (next && next.intense);
  }

  function confirmReschedule(day, freeDay) {
    if (day.title === "Legs" && dayIsAdjacentIntense(freeDay)) {
      var body = $("rescheduleModalBody");
      body.innerHTML =
        '<p class="alert alert--warning">Aviso: colocar Legs junto a una carrera intensa puede acumular fatiga en las piernas. Puedes confirmar igualmente o elegir otro día.</p>';
      var confirmBtn = document.createElement("button");
      confirmBtn.type = "button";
      confirmBtn.className = "primary-btn primary-btn--block";
      confirmBtn.textContent = "Confirmar de todas formas";
      confirmBtn.addEventListener("click", function () { applyReschedule(day, freeDay); });
      var backBtn = document.createElement("button");
      backBtn.type = "button";
      backBtn.className = "ghost-btn ghost-btn--block";
      backBtn.textContent = "Elegir otro día";
      backBtn.addEventListener("click", function () { openRescheduleModal(day); });
      body.appendChild(confirmBtn);
      body.appendChild(backBtn);
      return;
    }
    applyReschedule(day, freeDay);
  }

  function applyReschedule(day, freeDay) {
    freeDay.title = day.title;
    freeDay.type = day.type;
    freeDay.status = "planificada";
    freeDay.detail = day.detail;
    freeDay.duration = day.duration;

    day.status = "recolocada";
    day.movedTo = freeDay.short;

    // renderPlan() se ejecuta antes de cerrar el modal: reconstruye las tarjetas
    // y destruye el botón "Recolocar" que abrió el modal, así que closeModal()
    // debe comprobar la conexión al DOM después de esta reconstrucción, no antes.
    renderPlan();
    closeModal($("rescheduleModal"));
    showToast(day.title + " recolocado al " + freeDay.day + ".");
  }

  function wirePlanTabs() {
    $("tabWeek").addEventListener("click", function () { setPlanTab("week"); });
    $("tabPhases").addEventListener("click", function () { setPlanTab("phases"); });
  }

  function setPlanTab(which) {
    var weekActive = which === "week";
    $("tabWeek").setAttribute("aria-selected", weekActive ? "true" : "false");
    $("tabPhases").setAttribute("aria-selected", weekActive ? "false" : "true");
    $("panelWeek").hidden = !weekActive;
    $("panelPhases").hidden = weekActive;
  }

  /* ---------------------------------------------------------------------
   * Sesión de fuerza — lista
   * ------------------------------------------------------------------- */

  function renderSession() {
    var list = $("exerciseList");
    list.innerHTML = "";

    var active = EXERCISES.filter(function (ex) { return ex.included; });
    var completedCount = 0;

    active.forEach(function (ex) {
      var allDone = ex.sets.every(function (s) { return s.estado === "hecha"; });
      if (allDone) completedCount++;

      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "exercise-list__item" + (allDone ? " is-done" : "");
      var setsDone = ex.sets.filter(function (s) { return s.estado === "hecha"; }).length;
      btn.innerHTML =
        '<span class="exercise-list__thumb">' + iconMarkup(ex.icon) + "</span>" +
        '<span class="exercise-list__body">' +
        '<span class="exercise-list__name">' + ex.nombre + "</span><br>" +
        '<span class="exercise-list__meta">' + ex.variante + " · " + setsDone + "/" + ex.sets.length + " series</span>" +
        "</span>" +
        '<span class="exercise-list__status" aria-hidden="true">' + (allDone ? "✓" : "›") + "</span>";
      btn.addEventListener("click", function () { openExercise(ex.id); });
      li.appendChild(btn);
      list.appendChild(li);
    });

    var fill = $("sessionProgressFill");
    var pct = active.length ? Math.round((completedCount / active.length) * 100) : 0;
    fill.style.width = pct + "%";
    $("sessionProgressText").textContent = completedCount + " de " + active.length + " ejercicios completados";

    var badges = $("sessionBadges");
    badges.innerHTML = "";
    if (session.state === "adaptada") {
      badges.innerHTML += '<span class="badge badge--adapted">Sesión adaptada</span>';
    }
    badges.innerHTML += '<span class="badge badge--sim">Pendiente de sincronizar (simulado)</span>';
  }

  /* ---------------------------------------------------------------------
   * Tarjeta de ejercicio
   * ------------------------------------------------------------------- */

  function openExercise(id) {
    currentExerciseId = id;
    var ex = findExercise(id);
    if (!ex) return;

    $("exerciseTitle").textContent = ex.nombre;
    $("exerciseThumb").innerHTML = iconMarkup(ex.icon);
    $("exerciseVariant").textContent = ex.variante;
    $("exerciseObjective").textContent = ex.objetivo;
    $("exerciseLast").textContent = ex.ultimoTexto;
    $("btnVideo").href = ex.video;

    session.exerciseMode = "confirm";
    $("modeConfirm").classList.add("is-active");
    $("modeConfirm").setAttribute("aria-pressed", "true");
    $("modeEditAll").classList.remove("is-active");
    $("modeEditAll").setAttribute("aria-pressed", "false");

    $("restSeconds").value = ex.restSeconds;
    stopRestTimer();
    resetRestDisplay();

    renderDifficulty(ex);
    renderSetTable(ex);

    showView("exercise");
  }

  function renderDifficulty(ex) {
    var btns = $("difficultyGroup").querySelectorAll(".segmented__btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("is-selected", btns[i].getAttribute("data-difficulty") === ex.difficulty);
    }
  }

  function renderSetTable(ex) {
    var body = $("setTableBody");
    body.innerHTML = "";

    ex.sets.forEach(function (set, index) {
      var row = document.createElement("tr");
      var done = set.estado === "hecha";

      var pesoCell = document.createElement("td");
      var pesoInput = document.createElement("input");
      pesoInput.type = "number";
      pesoInput.step = "0.5";
      pesoInput.min = "0";
      pesoInput.value = set.peso;
      pesoInput.setAttribute("aria-label", "Peso serie " + (index + 1) + " en kilos");
      pesoInput.disabled = done && session.exerciseMode === "confirm";
      pesoInput.addEventListener("input", function () { set.peso = parseFloat(pesoInput.value) || 0; });
      pesoCell.appendChild(pesoInput);

      var repsCell = document.createElement("td");
      var repsInput = document.createElement("input");
      repsInput.type = "number";
      repsInput.step = "1";
      repsInput.min = "0";
      repsInput.value = set.reps;
      repsInput.setAttribute("aria-label", "Repeticiones serie " + (index + 1));
      repsInput.disabled = done && session.exerciseMode === "confirm";
      repsInput.addEventListener("input", function () { set.reps = parseInt(repsInput.value, 10) || 0; });
      repsCell.appendChild(repsInput);

      var stateCell = document.createElement("td");
      if (session.exerciseMode === "confirm") {
        var confirmBtn = document.createElement("button");
        confirmBtn.type = "button";
        confirmBtn.className = "set-confirm-btn" + (done ? " is-done" : "");
        confirmBtn.textContent = done ? "Hecha ✓" : "Confirmar";
        confirmBtn.addEventListener("click", function () {
          set.estado = set.estado === "hecha" ? "pendiente" : "hecha";
          renderSetTable(ex);
          renderSessionBadgeState();
        });
        stateCell.appendChild(confirmBtn);
      } else {
        var span = document.createElement("span");
        span.className = "muted small";
        span.textContent = done ? "Hecha ✓" : "Pendiente";
        stateCell.appendChild(span);
      }

      row.appendChild(document.createElement("td")).textContent = index + 1;
      row.appendChild(pesoCell);
      row.appendChild(repsCell);
      row.appendChild(stateCell);
      body.appendChild(row);
    });

    var existingAll = document.getElementById("confirmAllBtn");
    if (existingAll) existingAll.remove();

    if (session.exerciseMode === "editAll") {
      var allBtn = document.createElement("button");
      allBtn.type = "button";
      allBtn.id = "confirmAllBtn";
      allBtn.className = "primary-btn primary-btn--block";
      allBtn.textContent = "Confirmar todas las series";
      allBtn.addEventListener("click", function () {
        ex.sets.forEach(function (s) { s.estado = "hecha"; });
        renderSetTable(ex);
        renderSessionBadgeState();
        showToast("Series de " + ex.nombre + " confirmadas.");
      });
      $("setTable").insertAdjacentElement("afterend", allBtn);
    }
  }

  function renderSessionBadgeState() {
    // Mantiene la lista de ejercicios sincronizada si el usuario vuelve atrás.
  }

  function wireExerciseView() {
    $("modeConfirm").addEventListener("click", function () {
      session.exerciseMode = "confirm";
      $("modeConfirm").classList.add("is-active");
      $("modeConfirm").setAttribute("aria-pressed", "true");
      $("modeEditAll").classList.remove("is-active");
      $("modeEditAll").setAttribute("aria-pressed", "false");
      renderSetTable(findExercise(currentExerciseId));
    });

    $("modeEditAll").addEventListener("click", function () {
      session.exerciseMode = "editAll";
      $("modeEditAll").classList.add("is-active");
      $("modeEditAll").setAttribute("aria-pressed", "true");
      $("modeConfirm").classList.remove("is-active");
      $("modeConfirm").setAttribute("aria-pressed", "false");
      renderSetTable(findExercise(currentExerciseId));
    });

    var diffBtns = $("difficultyGroup").querySelectorAll(".segmented__btn");
    for (var i = 0; i < diffBtns.length; i++) {
      diffBtns[i].addEventListener("click", function (e) {
        var ex = findExercise(currentExerciseId);
        var value = e.currentTarget.getAttribute("data-difficulty");
        ex.difficulty = ex.difficulty === value ? null : value;
        renderDifficulty(ex);
      });
    }

    $("btnBackToList").addEventListener("click", function () { showView("session"); });

    $("btnChangeVariant").addEventListener("click", openVariantModal);
    $("btnGuide").addEventListener("click", openGuideModal);

    $("btnStartRest").addEventListener("click", startRestTimer);
    $("btnCancelRest").addEventListener("click", stopRestTimer);
    $("restSeconds").addEventListener("input", function () {
      if (!restTimerHandle) resetRestDisplay();
    });
  }

  /* ---------------------------------------------------------------------
   * Temporizador de descanso (solo manual)
   * ------------------------------------------------------------------- */

  function resetRestDisplay() {
    var seconds = parseInt($("restSeconds").value, 10) || 0;
    restTimerRemaining = seconds;
    $("restDisplay").textContent = formatTime(seconds);
  }

  function formatTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = totalSeconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function startRestTimer() {
    if (restTimerHandle) return;
    restTimerRemaining = parseInt($("restSeconds").value, 10) || 0;
    if (restTimerRemaining <= 0) return;

    $("btnStartRest").hidden = true;
    $("btnCancelRest").hidden = false;
    $("restSeconds").disabled = true;

    updateRestDisplay();
    restTimerHandle = window.setInterval(function () {
      restTimerRemaining--;
      updateRestDisplay();
      if (restTimerRemaining <= 0) {
        stopRestTimer();
        showToast("Descanso terminado.");
      }
    }, 1000);
  }

  function updateRestDisplay() {
    $("restDisplay").textContent = formatTime(Math.max(restTimerRemaining, 0));
  }

  function stopRestTimer() {
    if (restTimerHandle) {
      window.clearInterval(restTimerHandle);
      restTimerHandle = null;
    }
    $("btnStartRest").hidden = false;
    $("btnCancelRest").hidden = true;
    $("restSeconds").disabled = false;
    resetRestDisplay();
  }

  /* ---------------------------------------------------------------------
   * Cambiar variante
   * ------------------------------------------------------------------- */

  function openVariantModal() {
    var ex = findExercise(currentExerciseId);
    var body = $("variantModalBody");
    body.innerHTML = "";

    var groups = [
      { title: "Favoritas", items: ex.variantes.favoritas },
      { title: "Usadas recientemente", items: ex.variantes.recientes },
      { title: "Mismo patrón — " + ex.patron, items: ex.variantes.mismoPatron },
      { title: "Catálogo general", items: ex.variantes.catalogo }
    ];

    groups.forEach(function (group) {
      if (!group.items.length) return;
      var wrap = document.createElement("div");
      wrap.className = "variant-group";
      wrap.innerHTML = '<p class="variant-group__title">' + group.title + "</p>";
      group.items.forEach(function (item) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "variant-option" + (item.nombre === ex.variante ? " is-current" : "");
        btn.innerHTML = '<span class="variant-option__name">' + item.nombre + "</span><span class=\"variant-option__meta\">" + item.meta + "</span>";
        btn.addEventListener("click", function () {
          ex.variante = item.nombre;
          ex.ultimoTexto = "Último resultado con esta variante: " + (item.meta.indexOf("·") >= 0 ? item.meta.split("·").pop().trim() : "sin historial previo, será tu primera vez");
          closeModal($("variantModal"));
          openExercise(ex.id);
          showToast("Variante actualizada a " + item.nombre + ".");
        });
        wrap.appendChild(btn);
      });
      body.appendChild(wrap);
    });

    var favSummary = document.createElement("div");
    favSummary.className = "variant-group";
    favSummary.innerHTML = '<p class="variant-group__title">Tus favoritos guardados</p><p class="muted small">' + OTHER_FAVORITES.join(" · ") + "</p>";
    body.appendChild(favSummary);

    var customBtn = document.createElement("button");
    customBtn.type = "button";
    customBtn.className = "custom-exercise-link";
    customBtn.textContent = "+ Crear ejercicio personalizado";
    customBtn.addEventListener("click", function () {
      closeModal($("variantModal"));
      showToast("Ejercicio personalizado creado (no se guarda en este prototipo).");
    });
    body.appendChild(customBtn);

    openModal("variantModal");
  }

  /* ---------------------------------------------------------------------
   * Guía técnica
   * ------------------------------------------------------------------- */

  function openGuideModal() {
    var ex = findExercise(currentExerciseId);
    var body = $("guideModalBody");
    var cuesHtml = ex.guide.cues.map(function (c) { return "<li>" + c + "</li>"; }).join("");
    var muscleHtml = ex.guide.muscles.map(function (m) { return '<span class="muscle-tag">' + m + "</span>"; }).join("");

    body.innerHTML =
      '<div class="guide-illustration">' + iconMarkup(ex.icon).replace("width=\"24\"", "width=\"56\"").replace("height=\"24\"", "height=\"56\"") + "</div>" +
      '<p class="field-label">' + ex.nombre + " · " + ex.variante + "</p>" +
      '<ul class="guide-list">' + cuesHtml + "</ul>" +
      '<p class="field-label" style="margin-top:14px">Músculos implicados</p>' +
      '<div class="muscle-tags">' + muscleHtml + "</div>" +
      '<p class="muted small" style="margin-top:14px">Guía informativa general, no sustituye la supervisión de un profesional.</p>';

    openModal("guideModal");
  }

  /* ---------------------------------------------------------------------
   * Cerrar ejercicio y sesión
   * ------------------------------------------------------------------- */

  function wireCloseSession() {
    $("btnFinishSession").addEventListener("click", function () { showView("close"); });

    $("btnSaveClose").addEventListener("click", function () {
      var esfuerzo = getSelectedValue("esfuerzo");
      if (!esfuerzo) {
        showToast("Indica el esfuerzo global antes de guardar.");
        return;
      }

      var estadoFinal = session.state === "adaptada" ? "adapted" : "completed";
      HISTORY.unshift({
        title: "Pull",
        meta: "Hoy · esfuerzo " + esfuerzo + (session.state === "adaptada" ? " · adaptada" : ""),
        status: estadoFinal
      });

      var today = findDay("mie");
      today.status = "completada";
      today.duration = 48;

      showToast("Sesión guardada. Buen trabajo.");
      showView("home");
    });
  }

  /* ---------------------------------------------------------------------
   * Check-in y adaptación
   * ------------------------------------------------------------------- */

  function getSelectedValue(groupName) {
    var group = document.querySelector('.segmented[data-group="' + groupName + '"]');
    if (!group) return null;
    var selected = group.querySelector(".is-selected");
    return selected ? selected.getAttribute("data-value") : null;
  }

  function wireSegmentedGroups() {
    var groups = document.querySelectorAll(".segmented[data-group]");
    groups.forEach(function (group) {
      var groupName = group.getAttribute("data-group");
      var buttons = group.querySelectorAll(".segmented__btn");
      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var already = btn.classList.contains("is-selected");
          buttons.forEach(function (b) { b.classList.remove("is-selected"); });
          if (!already) btn.classList.add("is-selected");
          onSegmentedChange(groupName);
        });
      });
    });
  }

  function onSegmentedChange(groupName) {
    if (groupName === "molestias") {
      var value = getSelectedValue("molestias");
      checkinState.molestias = value;
      var showMap = value && value !== "ninguna";
      $("bodyMapSection").hidden = !showMap;
      if (showMap && (value === "leve" || value === "moderada" || value === "importante")) {
        selectSegmentedValue("intensidadZona", value);
      }
    }
    if (groupName === "intensidadZona" || groupName === "molestias") {
      var intensidad = getSelectedValue("intensidadZona");
      $("importantPainNotice").hidden = intensidad !== "importante";
    }
    if (groupName === "molestiasCierre") {
      $("closePainNotice").hidden = getSelectedValue("molestiasCierre") !== "importante";
    }
  }

  function selectSegmentedValue(groupName, value) {
    var group = document.querySelector('.segmented[data-group="' + groupName + '"]');
    if (!group) return;
    var buttons = group.querySelectorAll(".segmented__btn");
    buttons.forEach(function (b) {
      b.classList.toggle("is-selected", b.getAttribute("data-value") === value);
    });
  }

  function wireBodyMap() {
    $("bodyTabFront").addEventListener("click", function () { setBodyTab("front"); });
    $("bodyTabBack").addEventListener("click", function () { setBodyTab("back"); });

    var zoneBtns = document.querySelectorAll(".zone-btn");
    zoneBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var all = document.querySelectorAll(".zone-btn");
        all.forEach(function (b) { b.classList.remove("is-selected"); });
        btn.classList.add("is-selected");
        checkinState.zona = btn.getAttribute("data-zone");
        checkinState.lado = btn.getAttribute("data-lado");
        var ladoTexto = checkinState.lado && checkinState.lado !== "none" ? " (" + checkinState.lado + ")" : "";
        $("zoneSelectedText").textContent = "Zona seleccionada: " + btn.textContent + ladoTexto + ".";
      });
    });
  }

  function setBodyTab(which) {
    var frontActive = which === "front";
    $("bodyTabFront").setAttribute("aria-selected", frontActive ? "true" : "false");
    $("bodyTabBack").setAttribute("aria-selected", frontActive ? "false" : "true");
    $("bodyFront").hidden = !frontActive;
    $("bodyBack").hidden = frontActive;
  }

  function wireReviewProposal() {
    $("btnReviewProposal").addEventListener("click", function () {
      checkinState.energia = getSelectedValue("energia");
      checkinState.motivacion = getSelectedValue("motivacion");
      checkinState.tiempo = getSelectedValue("tiempo");
      checkinState.molestias = getSelectedValue("molestias");
      checkinState.intensidadZona = getSelectedValue("intensidadZona");
      checkinState.tipoMolestia = getSelectedValue("tipoMolestia");

      if (!checkinState.energia || !checkinState.motivacion || !checkinState.tiempo || !checkinState.molestias) {
        showToast("Completa energía, motivación, tiempo y molestias antes de continuar.");
        return;
      }
      if (checkinState.molestias !== "ninguna" && !checkinState.zona) {
        showToast("Indica en qué zona notas la molestia.");
        return;
      }

      pendingAdaptation = generateAdaptation(checkinState);
      renderAdaptation(pendingAdaptation);
      showView("adaptation");
    });
  }

  function generateAdaptation(checkin) {
    var changes = [];
    var duration = checkin.tiempo || "40";
    var apply = [];

    if (checkin.tiempo === "20" || checkin.tiempo === "40") {
      changes.push("Se retira el curl de bíceps para ajustarse a " + checkin.tiempo + " minutos disponibles.");
      apply.push(function () {
        var ex = findExercise("curl");
        if (ex) ex.included = false;
      });
    }

    if (checkin.molestias !== "ninguna" && checkin.zona === "hombro") {
      var ladoTexto = checkin.lado && checkin.lado !== "none" ? " " + checkin.lado : "";
      changes.push("Se reduce una serie de jalón al pecho y de remo sentado para bajar la carga sobre el hombro" + ladoTexto + " que indicaste.");
      changes.push("Face pull cambia a variante con banda elástica, menos exigente para el hombro.");
      apply.push(function () {
        var jalon = findExercise("jalon");
        var remo = findExercise("remo");
        var face = findExercise("facepull");
        if (jalon && jalon.sets.length > 2) jalon.sets.pop();
        if (remo && remo.sets.length > 2) remo.sets.pop();
        if (face) face.variante = "Face pull con banda elástica";
      });
    } else if (checkin.molestias !== "ninguna") {
      changes.push("Se reduce ligeramente el volumen de tirón en la zona indicada.");
      apply.push(function () {
        var jalon = findExercise("jalon");
        if (jalon && jalon.sets.length > 2) jalon.sets.pop();
      });
    }

    if (checkin.energia === "baja") {
      changes.push("El descanso recomendado entre series aumenta 15 s para compensar la energía baja.");
      apply.push(function () {
        EXERCISES.forEach(function (ex) { ex.restSeconds += 15; });
      });
    }

    if (!changes.length) {
      changes.push("No se detectan ajustes necesarios: puedes mantener la sesión Pull tal como está prevista.");
    }

    var reasonParts = [];
    reasonParts.push("energía " + checkin.energia);
    reasonParts.push("motivación " + checkin.motivacion);
    reasonParts.push(checkin.tiempo + " min disponibles");
    if (checkin.molestias !== "ninguna") {
      reasonParts.push("molestia " + checkin.molestias + (checkin.zona ? " en " + checkin.zona.replace("-", " ") : ""));
    }

    return {
      title: "Pull adaptado · " + duration + " min",
      changes: changes,
      reason: "Motivo: indicaste " + reasonParts.join(", ") + ".",
      importantPain: checkin.molestias === "importante" || checkin.intensidadZona === "importante",
      apply: function () { apply.forEach(function (fn) { fn(); }); }
    };
  }

  function renderAdaptation(adaptation) {
    $("adaptationName").textContent = adaptation.title;
    var list = $("adaptationChanges");
    list.innerHTML = "";
    adaptation.changes.forEach(function (c) {
      var li = document.createElement("li");
      li.textContent = c;
      list.appendChild(li);
    });
    $("adaptationReason").textContent = adaptation.reason;
    $("adaptationSafetyNotice").hidden = !adaptation.importantPain;
  }

  function wireAdaptationDecision() {
    $("btnApplyAdapted").addEventListener("click", function () {
      if (pendingAdaptation) pendingAdaptation.apply();
      session.state = "adaptada";
      showToast("Versión adaptada aplicada.");
      showView("session");
    });

    $("btnKeepPlanned").addEventListener("click", function () {
      session.state = "prevista";
      showToast("Mantienes la sesión prevista.");
      showView("session");
    });
  }

  /* ---------------------------------------------------------------------
   * Historial
   * ------------------------------------------------------------------- */

  function renderHistory() {
    var list = $("historyList");
    list.innerHTML = "";
    HISTORY.forEach(function (item) {
      list.appendChild(buildActivityItem(item));
    });
  }

  function wireHistoryTabs() {
    $("tabHistoryFull").addEventListener("click", function () { setHistoryTab(true); });
    $("tabHistoryEmpty").addEventListener("click", function () { setHistoryTab(false); });

    $("btnViewProgress").addEventListener("click", function () {
      var body = $("progressModalBody");
      var rows = PROGRESS_EXAMPLE.map(function (p) {
        return '<div class="activity-item"><span>' + p.fecha + '</span><span class="muted small">' + p.valor + "</span></div>";
      }).join("");
      body.innerHTML = '<p class="muted">Jalón al pecho · polea (agarre ancho)</p><div class="activity-list" style="margin-top:10px">' + rows + "</div>";
      openModal("progressModal");
    });
  }

  function setHistoryTab(showFull) {
    $("tabHistoryFull").setAttribute("aria-selected", showFull ? "true" : "false");
    $("tabHistoryEmpty").setAttribute("aria-selected", showFull ? "false" : "true");
    $("panelHistoryFull").hidden = !showFull;
    $("panelHistoryEmpty").hidden = showFull;
  }

  /* ---------------------------------------------------------------------
   * Modales genéricos
   * ------------------------------------------------------------------- */

  var lastFocusedEl = null;
  var activeModalOverlay = null;

  function getFocusable(container) {
    var nodes = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(nodes, function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
  }

  function openModal(overlayId) {
    var overlay = $(overlayId);
    if (overlay.hidden) lastFocusedEl = document.activeElement;
    overlay.hidden = false;
    activeModalOverlay = overlay;
    var focusable = getFocusable(overlay);
    if (focusable.length) focusable[0].focus();
  }

  function closeModal(overlay) {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    if (overlay === activeModalOverlay) activeModalOverlay = null;

    // ponytail: si quien abrió el modal fue destruido por un re-render posterior
    // (p. ej. renderPlan() reconstruye la tarjeta "Recolocar"), el foco no puede
    // volver ahí. Fallback: el título de la vista activa, en vez de perderse en <body>.
    var target = lastFocusedEl && lastFocusedEl.isConnected ? lastFocusedEl : null;
    if (!target) {
      target = document.querySelector(".view.is-active .view-title");
      if (target && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    }
    if (target && typeof target.focus === "function") target.focus();
  }

  function wireModals() {
    $("btnCloseVariant").addEventListener("click", function () { closeModal($("variantModal")); });
    $("btnCloseGuide").addEventListener("click", function () { closeModal($("guideModal")); });
    $("btnCloseProgress").addEventListener("click", function () { closeModal($("progressModal")); });
    $("btnCloseReschedule").addEventListener("click", function () { closeModal($("rescheduleModal")); });

    document.querySelectorAll(".modal-overlay").forEach(function (overlay) {
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeModal(overlay);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (!activeModalOverlay) return;
      if (e.key === "Escape") {
        closeModal(activeModalOverlay);
        return;
      }
      if (e.key === "Tab") {
        var focusable = getFocusable(activeModalOverlay);
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
      }
    });
  }

  /* ---------------------------------------------------------------------
   * Opciones rápidas de Inicio
   * ------------------------------------------------------------------- */

  function wireHomeOptions() {
    $("btnStartPlanned").addEventListener("click", function () { showView("session"); });
    $("btnStartAdapted").addEventListener("click", function () { showView("checkin"); });
    $("btnStartRecovery").addEventListener("click", function () {
      $("daySummaryTitle").textContent = "Recuperación · movilidad";
      $("daySummaryCard").innerHTML =
        '<span class="badge badge--planned">Opcional</span>' +
        '<p class="stat-big" style="margin-top:10px">Movilidad suave</p>' +
        '<p class="muted">10-15 min · sin carga</p>' +
        '<p style="margin-top:12px">Movilidad de hombro, cadera y tobillo, respiración y estiramientos suaves. Pensada para días de baja energía o como complemento tras una sesión exigente.</p>' +
        '<p class="muted small" style="margin-top:14px">Contenido de ejemplo en este prototipo; no incluye vídeo guiado real.</p>';
      showView("daySummary");
    });
  }

  /* ---------------------------------------------------------------------
   * Tema y estado de sincronización simulado
   * ------------------------------------------------------------------- */

  function wireTheme() {
    $("themeToggle").addEventListener("click", function () {
      var root = document.documentElement;
      var isLight = root.getAttribute("data-theme") === "light";
      if (isLight) {
        root.removeAttribute("data-theme");
        $("themeToggle").setAttribute("aria-pressed", "false");
        $("themeToggle").setAttribute("aria-label", "Cambiar a modo claro");
      } else {
        root.setAttribute("data-theme", "light");
        $("themeToggle").setAttribute("aria-pressed", "true");
        $("themeToggle").setAttribute("aria-label", "Cambiar a modo oscuro");
      }
    });
  }

  function wireSyncStatus() {
    $("syncStatus").addEventListener("click", function () {
      showToast("Estado simulado: en este prototipo no hay sincronización real.");
    });
  }

  /* ---------------------------------------------------------------------
   * Arranque
   * ------------------------------------------------------------------- */

  function init() {
    wireNav();
    wirePlanTabs();
    wireExerciseView();
    wireCloseSession();
    wireSegmentedGroups();
    wireBodyMap();
    wireReviewProposal();
    wireAdaptationDecision();
    wireHistoryTabs();
    wireModals();
    wireHomeOptions();
    wireTheme();
    wireSyncStatus();

    showView("home");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
