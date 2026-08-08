/*
 * Trainer — prototipo navegable (datos ficticios, todo en memoria).
 * Sin backend, sin fetch, sin módulos ES: script clásico para que funcione con file://.
 *
 * Modelo: una sesión es UN objeto con un día de programación (`day`). Recolocar
 * cambia ese día; nunca se copia la sesión a otro día. Los días del calendario
 * (DAYS) son solo la rejilla temporal.
 *
 * ponytail: el motor de adaptación es deliberadamente simple (if/else), no es el
 * motor determinista descrito en MVP-DEFINITION.md; debe validarlo un profesional.
 */
(function () {
  "use strict";

  /* =====================================================================
   * Datos ficticios
   * ================================================================== */

  var DAYS = [
    { key: "lun", name: "Lunes",     short: "Lun", initial: "L" },
    { key: "mar", name: "Martes",    short: "Mar", initial: "M" },
    { key: "mie", name: "Miércoles", short: "Mié", initial: "X" },
    { key: "jue", name: "Jueves",    short: "Jue", initial: "J" },
    { key: "vie", name: "Viernes",   short: "Vie", initial: "V" },
    { key: "sab", name: "Sábado",    short: "Sáb", initial: "S" },
    { key: "dom", name: "Domingo",   short: "Dom", initial: "D" }
  ];

  // Una entrada = una sesión activa. `day` es su día de programación actual.
  var SESSIONS = [
    {
      id: "push", title: "Push", type: "fuerza", day: "lun",
      status: "completada", duration: 52,
      why: "Empuje de pecho, hombro y tríceps.",
      detail: "Press banca, press militar, fondos en máquina, elevaciones laterales."
    },
    {
      id: "run-easy", title: "Carrera suave", type: "cardio", day: "mar",
      status: "completada", duration: 30,
      why: "Recuperación activa tras el empuje del lunes.",
      detail: "30 min a ritmo cómodo."
    },
    {
      id: "pull", title: "Pull", type: "fuerza", day: "mie",
      status: "hoy", duration: null, interactive: true,
      why: "Tirón de espalda y bíceps. Es tu segunda sesión de fuerza de la semana y toca subir volumen de dorsal.",
      detail: "Jalón al pecho, remo sentado, face pull, pullover en polea, curl de bíceps."
    },
    {
      id: "legs", title: "Legs", type: "fuerza", day: "vie",
      status: "planificada", duration: null,
      why: "Tren inferior completo.",
      detail: "Sentadilla, prensa, curl femoral, elevación de gemelo."
    },
    {
      id: "run-long", title: "Carrera larga", type: "cardio", day: "dom",
      status: "planificada", duration: null, intense: true,
      why: "Base aeróbica de la semana.",
      detail: "70-80 min a ritmo constante."
    }
  ];

  var PHASES = [
    { name: "Adaptación",               weeks: "Semanas 1-2", span: 2, status: "done" },
    { name: "Progresión · hipertrofia", weeks: "Semanas 3-6", span: 4, status: "current" },
    { name: "Descarga",                 weeks: "Semana 7",    span: 1, status: "pending" },
    { name: "Mantenimiento",            weeks: "Semana 8",    span: 1, status: "pending" }
  ];

  var HISTORY = [
    { title: "Push",          meta: "Lunes · 52 min · 4 de 4 ejercicios",          status: "completed" },
    { title: "Carrera suave", meta: "Martes · 30 min",                              status: "completed" },
    { title: "Pull",          meta: "Semana pasada · 48 min · 5 de 5 ejercicios",   status: "completed" },
    { title: "Legs",          meta: "Semana pasada · adaptada por fatiga",          status: "adapted" },
    { title: "Push",          meta: "Hace 2 semanas · parcial, 2 de 4 ejercicios",  status: "partial" },
    { title: "Carrera larga", meta: "Hace 2 semanas · omitida y recolocada",        status: "skipped" }
  ];

  var ADHERENCE = [true, true, false, true, true, false];

  var EXERCISES = [
    {
      id: "jalon", nombre: "Jalón al pecho", variante: "Polea (agarre ancho)",
      patron: "Tracción vertical", icon: "pull",
      objetivo: "3 × 10-12 reps", ultimoTexto: "52.5 kg × 11 reps",
      restSeconds: 90, difficulty: null, included: true,
      sets: [
        { peso: 52.5, reps: 11, estado: "pendiente" },
        { peso: 52.5, reps: 10, estado: "pendiente" },
        { peso: 50, reps: 12, estado: "pendiente" }
      ],
      variantes: {
        favoritas: [{ nombre: "Polea (agarre ancho)", meta: "Tu variante habitual · 52.5 kg × 11" }],
        recientes: [{ nombre: "Agarre supino (polea)", meta: "Hace 2 semanas · 47.5 kg × 10" }],
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
      id: "remo", nombre: "Remo sentado", variante: "Máquina",
      patron: "Tracción horizontal", icon: "row",
      objetivo: "3 × 10-12 reps", ultimoTexto: "45 kg × 12 reps",
      restSeconds: 90, difficulty: null, included: true,
      sets: [
        { peso: 45, reps: 12, estado: "pendiente" },
        { peso: 45, reps: 11, estado: "pendiente" },
        { peso: 42.5, reps: 12, estado: "pendiente" }
      ],
      variantes: {
        favoritas: [{ nombre: "Máquina", meta: "Tu variante habitual · 45 kg × 12" }],
        recientes: [{ nombre: "Remo con cable (agarre neutro)", meta: "Hace 3 semanas · 40 kg × 10" }],
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
      id: "facepull", nombre: "Face pull", variante: "Polea con cuerda",
      patron: "Rotación externa / deltoide posterior", icon: "facepull",
      objetivo: "3 × 15 reps", ultimoTexto: "17.5 kg × 15 reps",
      restSeconds: 60, difficulty: null, included: true,
      sets: [
        { peso: 17.5, reps: 15, estado: "pendiente" },
        { peso: 17.5, reps: 15, estado: "pendiente" },
        { peso: 15, reps: 15, estado: "pendiente" }
      ],
      variantes: {
        favoritas: [],
        recientes: [{ nombre: "Face pull con banda elástica", meta: "Hace 1 mes · más suave para el hombro" }],
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
      id: "pullover", nombre: "Pullover en polea", variante: "Polea alta",
      patron: "Aducción de hombro / dorsal", icon: "pullover",
      objetivo: "3 × 12-15 reps", ultimoTexto: "25 kg × 14 reps",
      restSeconds: 75, difficulty: null, included: true,
      sets: [
        { peso: 25, reps: 14, estado: "pendiente" },
        { peso: 25, reps: 13, estado: "pendiente" },
        { peso: 22.5, reps: 15, estado: "pendiente" }
      ],
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
      id: "curl", nombre: "Curl de bíceps", variante: "Barra Z",
      patron: "Flexión de codo", icon: "curl",
      objetivo: "3 × 10-12 reps", ultimoTexto: "27.5 kg × 10 reps",
      restSeconds: 60, difficulty: null, included: true,
      sets: [
        { peso: 27.5, reps: 10, estado: "pendiente" },
        { peso: 27.5, reps: 10, estado: "pendiente" },
        { peso: 25, reps: 11, estado: "pendiente" }
      ],
      variantes: {
        favoritas: [],
        recientes: [{ nombre: "Curl con mancuernas alterno", meta: "Hace 2 semanas · 14 kg × 11" }],
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
    { fecha: "Hoy",            valor: "52.5 kg × 11 reps" },
    { fecha: "Hace 1 semana",  valor: "50 kg × 12 reps" },
    { fecha: "Hace 2 semanas", valor: "50 kg × 10 reps" },
    { fecha: "Hace 3 semanas", valor: "47.5 kg × 11 reps" },
    { fecha: "Hace 4 semanas", valor: "47.5 kg × 9 reps" }
  ];

  // Duración de referencia de la sesión Pull completa (dato ficticio).
  var FULL_SESSION_MINUTES = 48;

  /* =====================================================================
   * Estado de UI
   * ================================================================== */

  var session = {
    state: "prevista",      // prevista | adaptada
    exerciseMode: "confirm" // confirm | editAll
  };

  var checkinState = {
    energia: null, motivacion: null, tiempo: null, molestias: null,
    zona: null, lado: null, zonaTexto: null, intensidadZona: null, tipoMolestia: null
  };

  var currentExerciseId = null;
  var restTimerHandle = null;
  var restTimerRemaining = 0;
  var restAnchorIndex = null; // tras qué serie se dibuja el carril de descanso
  var pendingAdaptation = null;
  var closeMode = "completa"; // completa | parcial

  /* =====================================================================
   * Utilidades
   * ================================================================== */

  function $(id) { return document.getElementById(id); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function showToast(message) {
    var toast = $("toast");
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(function () { toast.hidden = true; }, 2800);
  }

  function findExercise(id) {
    for (var i = 0; i < EXERCISES.length; i++) {
      if (EXERCISES[i].id === id) return EXERCISES[i];
    }
    return null;
  }

  function findSession(id) {
    for (var i = 0; i < SESSIONS.length; i++) {
      if (SESSIONS[i].id === id) return SESSIONS[i];
    }
    return null;
  }

  function sessionOnDay(dayKey) {
    for (var i = 0; i < SESSIONS.length; i++) {
      if (SESSIONS[i].day === dayKey) return SESSIONS[i];
    }
    return null;
  }

  function ghostOnDay(dayKey) {
    // Rastro visual de una sesión que se movió desde este día. No es sesión activa.
    for (var i = 0; i < SESSIONS.length; i++) {
      if (SESSIONS[i].movedFrom === dayKey) return SESSIONS[i];
    }
    return null;
  }

  function dayByKey(key) {
    for (var i = 0; i < DAYS.length; i++) {
      if (DAYS[i].key === key) return DAYS[i];
    }
    return null;
  }

  function icon(kind) {
    var icons = {
      pull: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0l-4-4m4 4l4-4M6 21h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      row: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M3 12h6m0 0l3-3m-3 3l3 3M21 12h-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      facepull: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M6 20c1-4 3-6 6-6s5 2 6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      pullover: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 8c3 6 13 6 16 0M6 16c2-2 10-2 12 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
      curl: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M5 18l4-9 5 3 5-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
    return icons[kind] || icons.pull;
  }

  var STATE_LABEL = {
    completed: "Completada",
    adapted: "Adaptada",
    partial: "Parcial",
    skipped: "Omitida",
    planned: "Planificada"
  };

  /* =====================================================================
   * Navegación
   * ================================================================== */

  function showView(name) {
    var views = document.querySelectorAll(".view");
    for (var i = 0; i < views.length; i++) {
      views[i].classList.toggle("is-active", views[i].getAttribute("data-view") === name);
    }
    var navBtns = document.querySelectorAll(".bottomnav__btn");
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

  /* =====================================================================
   * Estado de la sesión de fuerza
   * ================================================================== */

  function sessionStats() {
    var active = EXERCISES.filter(function (ex) { return ex.included; });
    var setsTotal = 0, setsDone = 0, exDone = 0;
    active.forEach(function (ex) {
      var done = 0;
      ex.sets.forEach(function (s) { if (s.estado === "hecha") done++; });
      setsTotal += ex.sets.length;
      setsDone += done;
      if (ex.sets.length > 0 && done === ex.sets.length) exDone++;
    });
    return { exTotal: active.length, exDone: exDone, setsTotal: setsTotal, setsDone: setsDone };
  }

  /* =====================================================================
   * INICIO
   * ================================================================== */

  function renderHome() {
    renderToday();
    renderWeekRail();

    var done = SESSIONS.filter(function (s) {
      return s.status === "completada" || s.status === "adaptada";
    }).length;
    var minutes = SESSIONS.reduce(function (sum, s) { return sum + (s.duration || 0); }, 0);

    $("weekDone").textContent = done;
    $("weekTotal").textContent = SESSIONS.length;
    $("weekMinutes").textContent = minutes;

    var list = $("recentActivity");
    list.innerHTML = "";
    HISTORY.slice(0, 3).forEach(function (item) { list.appendChild(buildLogItem(item)); });
  }

  function renderToday() {
    var pull = findSession("pull");
    var block = $("todayBlock");
    var stats = sessionStats();
    block.innerHTML = "";
    block.className = "today";

    var eyebrow = el("p", "today__eyebrow");
    var title = el("h2", "today__title", pull.title);
    title.id = "todayTitle";

    if (pull.status === "completada" || pull.status === "adaptada" || pull.status === "parcial") {
      block.classList.add("today--done");
      eyebrow.textContent = pull.status === "completada" ? "Hoy · sesión completada"
        : pull.status === "adaptada" ? "Hoy · versión adaptada terminada"
        : "Hoy · sesión parcial";
      block.appendChild(eyebrow);
      block.appendChild(title);
      block.appendChild(el("p", "today__why",
        pull.status === "parcial"
          ? "Guardada como parcial: " + stats.exDone + " de " + stats.exTotal + " ejercicios y " +
            stats.setsDone + " de " + stats.setsTotal + " series. No cuenta como completada."
          : "Sesión registrada: " + (pull.duration || 0) + " min activos, " +
            stats.setsDone + " de " + stats.setsTotal + " series."));

      var altsDone = el("div", "today__alts");
      altsDone.appendChild(buildAlt("recovery", "Recuperación · movilidad suave", "10–15 min, sin carga", openRecovery));
      block.appendChild(altsDone);
      return;
    }

    var adapted = session.state === "adaptada";
    eyebrow.textContent = "Hoy · fuerza";
    if (adapted) eyebrow.appendChild(el("span", "state state--adapted", "Adaptada"));
    block.appendChild(eyebrow);
    block.appendChild(title);
    block.appendChild(el("p", "today__why", pull.why));

    var facts = el("ul", "today__facts");
    facts.appendChild(buildFact(stats.exTotal, "ejercicios"));
    facts.appendChild(buildFact(stats.setsTotal, "series"));
    facts.appendChild(buildFact("~" + (adapted ? 40 : FULL_SESSION_MINUTES), "min"));
    block.appendChild(facts);

    var start = el("button", "btn btn--primary btn--block",
      stats.setsDone > 0 ? "Continuar sesión" : "Empezar sesión");
    start.type = "button";
    start.style.marginTop = "0";
    start.addEventListener("click", function () { showView("session"); });
    block.appendChild(start);

    var alts = el("div", "today__alts");
    alts.appendChild(buildAlt("adapt", "Ajustar a cómo llego hoy", "Check-in de 20 s · propone y confirmas", function () { showView("checkin"); }));
    alts.appendChild(buildAlt("recovery", "Cambiar a recuperación", "Movilidad suave, 10–15 min", openRecovery));
    block.appendChild(alts);
  }

  function buildFact(value, unit) {
    var li = document.createElement("li");
    li.appendChild(el("b", null, String(value)));
    li.appendChild(el("span", null, unit));
    return li;
  }

  function buildAlt(kind, title, meta, onClick) {
    var btn = el("button", "alt alt--" + kind);
    btn.type = "button";
    btn.appendChild(el("span", "alt__mark"));
    var body = el("span", "alt__body");
    body.appendChild(el("span", "alt__title", title));
    body.appendChild(el("span", "alt__meta", meta));
    btn.appendChild(body);
    var arrow = el("span", "alt__arrow", "→");
    arrow.setAttribute("aria-hidden", "true");
    btn.appendChild(arrow);
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderWeekRail() {
    var rail = $("weekRail");
    rail.innerHTML = "";

    DAYS.forEach(function (day) {
      var s = sessionOnDay(day.key);
      var ghost = s ? null : ghostOnDay(day.key);

      var li = el("li", "weekrail__day");
      var name = el("span", "weekrail__name");
      var described;

      if (s) {
        if (s.type === "cardio") li.classList.add("is-cardio");
        name.textContent = s.title;
        if (s.status === "completada") { li.classList.add("is-done"); described = s.title + ", completada"; }
        else if (s.status === "adaptada") { li.classList.add("is-done"); described = s.title + ", adaptada y terminada"; }
        else if (s.status === "hoy") { li.classList.add("is-today"); described = s.title + ", hoy"; }
        else if (s.status === "omitida") { li.classList.add("is-skipped"); described = s.title + ", omitida"; }
        else if (s.status === "parcial") { li.classList.add("is-skipped"); described = s.title + ", parcial"; }
        else { li.classList.add("is-planned"); described = s.title + ", planificada"; }
        if (s.movedFrom) described += ", recolocada aquí";
      } else if (ghost) {
        li.classList.add("is-moved");
        name.textContent = "movida";
        described = ghost.title + " se movió de este día";
      } else {
        li.classList.add("is-rest");
        name.textContent = "descanso";
        described = "descanso";
      }

      li.setAttribute("aria-label", day.name + ": " + described);
      li.appendChild(el("span", "weekrail__label", day.initial));
      li.appendChild(el("span", "weekrail__mark"));
      li.appendChild(name);
      rail.appendChild(li);
    });

    $("railLegend").textContent =
      "Relleno: completada · anillo naranja: hoy · anillo hueco: planificada · trazo discontinuo: día del que se movió una sesión · punto: descanso.";
  }

  function buildLogItem(item) {
    var li = el("li", "log__item");
    li.appendChild(el("span", "log__bar log__bar--" + item.status));
    var body = el("div", "log__body");
    body.appendChild(el("p", "log__title", item.title));
    body.appendChild(el("p", "log__meta", item.meta));
    li.appendChild(body);
    li.appendChild(el("span", "state state--" + item.status, STATE_LABEL[item.status] || item.status));
    return li;
  }

  function openRecovery() {
    $("daySummaryTitle").textContent = "Recuperación";
    var card = $("daySummaryCard");
    card.innerHTML = "";
    card.appendChild(el("span", "state state--rest", "Opcional"));
    card.appendChild(el("p", "view-title", "Movilidad suave"));
    card.appendChild(el("p", "lede", "10–15 min · sin carga"));
    card.appendChild(el("p", "lede small", "Movilidad de hombro, cadera y tobillo, respiración y estiramientos suaves. Pensada para días de baja energía o como complemento tras una sesión exigente."));
    card.appendChild(el("p", "lede small", "Contenido de ejemplo en este prototipo; no incluye vídeo guiado real."));
    showView("daySummary");
  }

  /* =====================================================================
   * PLAN
   * ================================================================== */

  function renderPlan() {
    var list = $("weekList");
    list.innerHTML = "";
    DAYS.forEach(function (day) { list.appendChild(buildDayRow(day)); });
    renderPhases();
  }

  function buildDayRow(day) {
    var s = sessionOnDay(day.key);
    var ghost = s ? null : ghostOnDay(day.key);
    var li = el("li", "dayrow");

    var top = el("div", "dayrow__top");
    var head = document.createElement("div");
    head.appendChild(el("p", "dayrow__day", day.name));
    top.appendChild(head);

    if (s) {
      li.classList.add("dayrow--" + s.status);
      if (s.type === "cardio") li.classList.add("dayrow--cardio");

      head.appendChild(el("p", "dayrow__title", s.title));
      var meta = s.detail;
      if (s.duration) meta = s.duration + " min · " + s.detail;
      if (s.movedFrom) meta = "Recolocada desde " + dayByKey(s.movedFrom).name.toLowerCase() + ". " + meta;
      head.appendChild(el("p", "dayrow__meta", meta));

      var stateKey = s.status === "completada" ? "completed"
        : s.status === "adaptada" ? "adapted"
        : s.status === "hoy" ? "today"
        : s.status === "omitida" ? "skipped"
        : s.status === "parcial" ? "partial"
        : "planned";
      top.appendChild(el("span", "state state--" + stateKey,
        s.status === "hoy" ? "Hoy" : (STATE_LABEL[stateKey] || "Planificada")));
      li.appendChild(top);

      var actions = el("div", "dayrow__actions");
      var openBtn = el("button", "chip btn--sm", s.interactive && s.status === "hoy" ? "Abrir sesión" : "Ver detalle");
      openBtn.type = "button";
      openBtn.addEventListener("click", function () {
        if (s.interactive && s.status === "hoy") showView("session");
        else openDaySummary(s, day);
      });
      actions.appendChild(openBtn);

      if (s.status === "planificada") {
        var skipBtn = el("button", "chip btn--sm", "Omitir");
        skipBtn.type = "button";
        skipBtn.addEventListener("click", function () {
          s.status = "omitida";
          renderPlan();
          showToast(s.title + " marcada como omitida.");
        });
        actions.appendChild(skipBtn);

        var moveBtn = el("button", "chip btn--sm", "Recolocar");
        moveBtn.type = "button";
        moveBtn.addEventListener("click", function () { openRescheduleModal(s); });
        actions.appendChild(moveBtn);
      }
      li.appendChild(actions);
      return li;
    }

    if (ghost) {
      // Registro visual, no sesión activa: sin acciones y sin contar en la semana.
      li.classList.add("dayrow--ghost");
      head.appendChild(el("p", "dayrow__title", ghost.title + " · recolocada"));
      head.appendChild(el("p", "dayrow__meta",
        "Se movió al " + dayByKey(ghost.day).name.toLowerCase() + ". Este día ya no tiene sesión."));
      top.appendChild(el("span", "state state--skipped", "Movida"));
      li.appendChild(top);
      return li;
    }

    li.classList.add("dayrow--descanso");
    head.appendChild(el("p", "dayrow__title", "Descanso"));
    head.appendChild(el("p", "dayrow__meta", "Día libre."));
    top.appendChild(el("span", "state state--rest", "Libre"));
    li.appendChild(top);
    return li;
  }

  function renderPhases() {
    var bar = $("phaseBar");
    var list = $("phaseList");
    bar.innerHTML = "";
    list.innerHTML = "";

    PHASES.forEach(function (phase) {
      var seg = el("div", "phaseseg phaseseg--" + phase.status, phase.span > 1 ? phase.span + " sem" : "1");
      seg.style.flex = String(phase.span);
      bar.appendChild(seg);

      var li = el("li", phase.status === "current" ? "is-current" : null);
      li.appendChild(el("span", "phase__name", phase.name));
      li.appendChild(el("span", "phase__weeks", phase.weeks + (phase.status === "current" ? " · estás aquí" : "")));
      list.appendChild(li);
    });
  }

  function openDaySummary(s, day) {
    $("daySummaryTitle").textContent = s.title;
    var card = $("daySummaryCard");
    card.innerHTML = "";
    card.appendChild(el("p", "kicker", day.name + (s.duration ? " · " + s.duration + " min" : "")));
    card.appendChild(el("p", "view-title", s.title));
    card.appendChild(el("p", "lede", s.why));
    card.appendChild(el("p", "lede small", s.detail));
    card.appendChild(el("p", "lede small", "Vista de solo lectura en este prototipo. Solo la sesión Pull de hoy es completamente interactiva."));
    showView("daySummary");
  }

  /* ---- Recolocar: mueve la sesión, no la duplica ---------------------- */

  function openRescheduleModal(s) {
    var body = $("rescheduleModalBody");
    body.innerHTML = "";
    body.appendChild(el("p", "lede small",
      "Elige un día libre para mover " + s.title + ". La sesión cambia de día; no se crea una copia."));

    var freeDays = DAYS.filter(function (d) {
      return d.key !== s.day && !sessionOnDay(d.key);
    });

    if (!freeDays.length) {
      body.appendChild(el("p", "notice notice--warn", "No queda ningún día libre esta semana."));
      openModal("rescheduleModal");
      return;
    }

    freeDays.forEach(function (freeDay) {
      var btn = el("button", "opt");
      btn.type = "button";
      btn.appendChild(el("span", "opt__name", freeDay.name));
      btn.appendChild(el("span", "opt__meta", "Día libre"));
      btn.addEventListener("click", function () { confirmReschedule(s, freeDay); });
      body.appendChild(btn);
    });

    openModal("rescheduleModal");
  }

  function dayIsAdjacentIntense(dayKey) {
    var keys = DAYS.map(function (d) { return d.key; });
    var idx = keys.indexOf(dayKey);
    var neighbours = [DAYS[idx - 1], DAYS[idx + 1]];
    for (var i = 0; i < neighbours.length; i++) {
      if (!neighbours[i]) continue;
      var s = sessionOnDay(neighbours[i].key);
      if (s && s.intense) return true;
    }
    return false;
  }

  function confirmReschedule(s, freeDay) {
    if (s.title === "Legs" && dayIsAdjacentIntense(freeDay.key)) {
      var body = $("rescheduleModalBody");
      body.innerHTML = "";
      body.appendChild(el("p", "notice notice--warn",
        "Colocar Legs junto a una carrera intensa puede acumular fatiga en las piernas. Puedes confirmar igualmente o elegir otro día."));

      var confirmBtn = el("button", "btn btn--primary btn--block", "Confirmar de todas formas");
      confirmBtn.type = "button";
      confirmBtn.addEventListener("click", function () { applyReschedule(s, freeDay); });
      body.appendChild(confirmBtn);

      var backBtn = el("button", "btn btn--ghost btn--block", "Elegir otro día");
      backBtn.type = "button";
      backBtn.addEventListener("click", function () { openRescheduleModal(s); });
      body.appendChild(backBtn);
      return;
    }
    applyReschedule(s, freeDay);
  }

  function applyReschedule(s, freeDay) {
    var origin = s.movedFrom || s.day; // mover dos veces conserva el día de origen real
    s.movedFrom = origin === freeDay.key ? null : origin;
    s.day = freeDay.key;

    // renderPlan() reconstruye la fila que abrió el modal antes de restaurar el
    // foco; closeModal() detecta el elemento desconectado y usa un sustituto.
    renderPlan();
    closeModal($("rescheduleModal"));
    showToast(s.title + " se movió al " + freeDay.name.toLowerCase() + ". Sigue siendo una única sesión.");
  }

  /* =====================================================================
   * SESIÓN — lista de ejercicios
   * ================================================================== */

  function renderSession() {
    var list = $("exerciseList");
    list.innerHTML = "";

    var active = EXERCISES.filter(function (ex) { return ex.included; });

    active.forEach(function (ex, i) {
      var setsDone = ex.sets.filter(function (s) { return s.estado === "hecha"; }).length;
      var allDone = ex.sets.length > 0 && setsDone === ex.sets.length;

      var li = document.createElement("li");
      var btn = el("button", "exrow" + (allDone ? " is-done" : ""));
      btn.type = "button";

      btn.appendChild(el("span", "exrow__index", allDone ? "✓" : String(i + 1)));

      var body = el("span", "exrow__body");
      body.appendChild(el("span", "exrow__name", ex.nombre));
      body.appendChild(el("span", "exrow__meta", ex.variante + " · " + setsDone + "/" + ex.sets.length + " series"));
      btn.appendChild(body);

      var pips = el("span", "exrow__sets");
      ex.sets.forEach(function (s) {
        pips.appendChild(el("span", "exrow__pip" + (s.estado === "hecha" ? " is-done" : "")));
      });
      btn.appendChild(pips);

      btn.setAttribute("aria-label", ex.nombre + ", " + setsDone + " de " + ex.sets.length + " series registradas");
      btn.addEventListener("click", function () { openExercise(ex.id); });
      li.appendChild(btn);
      list.appendChild(li);
    });

    var stats = sessionStats();
    var pct = stats.setsTotal ? Math.round((stats.setsDone / stats.setsTotal) * 100) : 0;
    $("sessionProgressFill").style.width = pct + "%";
    $("sessionProgressText").textContent =
      stats.exDone + " de " + stats.exTotal + " ejercicios · " + stats.setsDone + " de " + stats.setsTotal + " series";
    $("sessionMeter").setAttribute("aria-label", "Progreso de la sesión: " + pct + " por ciento de las series registradas");

    var badges = $("sessionBadges");
    badges.innerHTML = "";
    if (session.state === "adaptada") badges.appendChild(el("span", "state state--adapted", "Sesión adaptada"));
    badges.appendChild(el("span", "state state--sim", "Pendiente de sincronizar (simulado)"));
  }

  /* =====================================================================
   * EJERCICIO — carriles de serie
   * ================================================================== */

  function openExercise(id) {
    currentExerciseId = id;
    var ex = findExercise(id);
    if (!ex) return;

    $("exerciseTitle").textContent = ex.nombre;
    $("exercisePattern").textContent = ex.patron;
    $("exerciseThumb").innerHTML = icon(ex.icon);
    $("exerciseVariant").textContent = ex.variante;
    $("exerciseObjective").textContent = ex.objetivo;
    $("exerciseLast").textContent = ex.ultimoTexto;
    $("btnVideo").href = ex.video;

    setExerciseMode("confirm");
    stopRestTimer();
    restAnchorIndex = null;
    restTimerRemaining = ex.restSeconds;
    renderDifficulty(ex);
    renderLanes(ex);

    showView("exercise");
  }

  function setExerciseMode(mode) {
    session.exerciseMode = mode;
    var confirmBtn = $("modeConfirm");
    var editBtn = $("modeEditAll");
    confirmBtn.classList.toggle("is-active", mode === "confirm");
    confirmBtn.setAttribute("aria-pressed", mode === "confirm" ? "true" : "false");
    editBtn.classList.toggle("is-active", mode === "editAll");
    editBtn.setAttribute("aria-pressed", mode === "editAll" ? "true" : "false");
  }

  function renderDifficulty(ex) {
    var btns = $("difficultyGroup").querySelectorAll(".picker__btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-pressed",
        btns[i].getAttribute("data-difficulty") === ex.difficulty ? "true" : "false");
    }
  }

  function renderLanes(ex) {
    var list = $("laneList");
    list.innerHTML = "";

    ex.sets.forEach(function (set, index) {
      var done = set.estado === "hecha";
      var li = el("li", "lane" + (done ? " is-done" : ""));

      li.appendChild(el("span", "lane__num", String(index + 1)));
      li.appendChild(buildLaneField(set, index, "peso", "kg", ex, done));
      li.appendChild(buildLaneField(set, index, "reps", "reps", ex, done));

      var state = el("span", "lane__state");
      if (session.exerciseMode === "confirm") {
        var btn = el("button", "setbtn" + (done ? " is-done" : ""), done ? "Hecha ✓" : "Confirmar");
        btn.type = "button";
        btn.setAttribute("aria-label",
          (done ? "Deshacer serie " : "Confirmar serie ") + (index + 1) + " de " + ex.nombre);
        btn.addEventListener("click", function () {
          set.estado = done ? "pendiente" : "hecha";
          if (!done) {
            restAnchorIndex = index;
            if (!restTimerHandle) restTimerRemaining = ex.restSeconds;
          }
          renderLanes(ex);
        });
        state.appendChild(btn);
      } else {
        state.appendChild(el("span", "lane__flag", done ? "Hecha ✓" : "Pendiente"));
      }
      li.appendChild(state);
      list.appendChild(li);

      if (restAnchorIndex === index) list.appendChild(buildRestLane(ex));
    });

    var footer = $("laneFooter");
    footer.innerHTML = "";
    if (session.exerciseMode === "editAll") {
      var allBtn = el("button", "btn btn--primary btn--block", "Confirmar todas las series");
      allBtn.type = "button";
      allBtn.addEventListener("click", function () {
        ex.sets.forEach(function (s) { s.estado = "hecha"; });
        restAnchorIndex = ex.sets.length - 1;
        if (!restTimerHandle) restTimerRemaining = ex.restSeconds;
        renderLanes(ex);
        showToast("Series de " + ex.nombre + " confirmadas.");
      });
      footer.appendChild(allBtn);
    }
  }

  function buildLaneField(set, index, prop, unit, ex, done) {
    var wrap = el("span", "lane__field");
    var input = document.createElement("input");
    input.type = "number";
    input.step = prop === "peso" ? "0.5" : "1";
    input.min = "0";
    input.value = set[prop];
    input.setAttribute("aria-label",
      (prop === "peso" ? "Peso en kilos, serie " : "Repeticiones, serie ") + (index + 1) + " de " + ex.nombre);
    input.disabled = done && session.exerciseMode === "confirm";
    input.addEventListener("input", function () {
      var value = prop === "peso" ? parseFloat(input.value) : parseInt(input.value, 10);
      set[prop] = isNaN(value) || value < 0 ? 0 : value;
    });
    wrap.appendChild(input);
    wrap.appendChild(el("span", "lane__unit", unit));
    return wrap;
  }

  /* ---- Descanso integrado en el flujo de carriles --------------------- */

  function buildRestLane(ex) {
    var running = !!restTimerHandle;
    var li = el("li", "restlane");

    var clock = el("span", "restlane__clock", formatTime(restTimerRemaining));
    clock.id = "restClock";
    clock.setAttribute("aria-live", "polite");
    li.appendChild(clock);

    var body = el("div", "restlane__body");
    body.appendChild(el("p", "restlane__label", running ? "Descansando" : "Descanso recomendado"));

    var edit = el("span", "restlane__edit");
    var input = document.createElement("input");
    input.type = "number";
    input.id = "restSeconds";
    input.min = "15";
    input.max = "300";
    input.step = "5";
    input.value = ex.restSeconds;
    input.disabled = running;
    input.setAttribute("aria-label", "Segundos de descanso recomendado");
    input.addEventListener("input", function () {
      var v = parseInt(input.value, 10);
      if (isNaN(v)) return;
      ex.restSeconds = v;
      if (!restTimerHandle) {
        restTimerRemaining = v;
        var c = $("restClock");
        if (c) c.textContent = formatTime(v);
      }
    });
    edit.appendChild(input);
    edit.appendChild(el("span", null, "s editables"));
    body.appendChild(edit);
    li.appendChild(body);

    var action = el("span", "restlane__action");
    var btn = el("button", "btn btn--ghost btn--sm", running ? "Detener" : "Iniciar");
    btn.type = "button";
    btn.addEventListener("click", function () {
      if (restTimerHandle) stopRestTimer();
      else startRestTimer(ex);
      renderLanes(ex);
    });
    action.appendChild(btn);
    li.appendChild(action);
    return li;
  }

  function formatTime(totalSeconds) {
    var s = Math.max(totalSeconds, 0);
    var m = Math.floor(s / 60);
    var rest = s % 60;
    return m + ":" + (rest < 10 ? "0" : "") + rest;
  }

  // El temporizador solo arranca con una acción explícita del usuario.
  function startRestTimer(ex) {
    if (restTimerHandle) return;
    restTimerRemaining = parseInt(ex.restSeconds, 10) || 0;
    if (restTimerRemaining <= 0) return;
    restTimerHandle = window.setInterval(function () {
      restTimerRemaining--;
      var clock = $("restClock");
      if (clock) clock.textContent = formatTime(restTimerRemaining);
      if (restTimerRemaining <= 0) {
        stopRestTimer();
        var current = findExercise(currentExerciseId);
        if (current) {
          restTimerRemaining = current.restSeconds;
          renderLanes(current);
        }
        showToast("Descanso terminado.");
      }
    }, 1000);
  }

  function stopRestTimer() {
    if (restTimerHandle) {
      window.clearInterval(restTimerHandle);
      restTimerHandle = null;
    }
  }

  function wireExerciseView() {
    $("modeConfirm").addEventListener("click", function () {
      setExerciseMode("confirm");
      renderLanes(findExercise(currentExerciseId));
    });
    $("modeEditAll").addEventListener("click", function () {
      setExerciseMode("editAll");
      renderLanes(findExercise(currentExerciseId));
    });

    var diffBtns = $("difficultyGroup").querySelectorAll(".picker__btn");
    for (var i = 0; i < diffBtns.length; i++) {
      diffBtns[i].addEventListener("click", function (e) {
        var ex = findExercise(currentExerciseId);
        if (!ex) return;
        var value = e.currentTarget.getAttribute("data-difficulty");
        ex.difficulty = ex.difficulty === value ? null : value;
        renderDifficulty(ex);
      });
    }

    $("btnBackToList").addEventListener("click", function () {
      stopRestTimer();
      showView("session");
    });
    $("btnChangeVariant").addEventListener("click", openVariantModal);
    $("btnGuide").addEventListener("click", openGuideModal);
  }

  /* =====================================================================
   * Variante y guía
   * ================================================================== */

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
      var wrap = el("div", "optgroup");
      wrap.appendChild(el("p", "optgroup__title", group.title));
      group.items.forEach(function (item) {
        var btn = el("button", "opt" + (item.nombre === ex.variante ? " is-current" : ""));
        btn.type = "button";
        btn.appendChild(el("span", "opt__name", item.nombre));
        btn.appendChild(el("span", "opt__meta", item.meta));
        btn.addEventListener("click", function () {
          ex.variante = item.nombre;
          ex.ultimoTexto = item.meta.indexOf("·") >= 0
            ? item.meta.split("·").pop().trim() + " (con esta variante)"
            : "sin historial previo, será tu primera vez";
          closeModal($("variantModal"));
          openExercise(ex.id);
          showToast("Variante actualizada a " + item.nombre + ".");
        });
        wrap.appendChild(btn);
      });
      body.appendChild(wrap);
    });

    var fav = el("div", "optgroup");
    fav.appendChild(el("p", "optgroup__title", "Tus favoritos guardados"));
    fav.appendChild(el("p", "lede small", OTHER_FAVORITES.join(" · ")));
    body.appendChild(fav);

    var customBtn = el("button", "btn btn--quiet", "+ Crear ejercicio personalizado");
    customBtn.type = "button";
    customBtn.addEventListener("click", function () {
      closeModal($("variantModal"));
      showToast("Ejercicio personalizado creado (no se guarda en este prototipo).");
    });
    body.appendChild(customBtn);

    openModal("variantModal");
  }

  function openGuideModal() {
    var ex = findExercise(currentExerciseId);
    var body = $("guideModalBody");
    body.innerHTML = "";

    var figure = el("div", "guide-figure");
    figure.innerHTML = icon(ex.icon).replace('width="24"', 'width="56"').replace('height="24"', 'height="56"');
    body.appendChild(figure);

    body.appendChild(el("p", "field__label", ex.nombre + " · " + ex.variante));

    var cues = el("ul", "cues");
    ex.guide.cues.forEach(function (c) { cues.appendChild(el("li", null, c)); });
    body.appendChild(cues);

    body.appendChild(el("p", "field__label", "Músculos implicados"));
    var tags = el("div", "tags");
    ex.guide.muscles.forEach(function (m) { tags.appendChild(el("span", "tag", m)); });
    body.appendChild(tags);

    body.appendChild(el("p", "lede small", "Guía informativa general, no sustituye la supervisión de un profesional."));
    openModal("guideModal");
  }

  /* =====================================================================
   * Terminar sesión: completa o parcial
   * ================================================================== */

  function wireFinishSession() {
    $("btnFinishSession").addEventListener("click", function () {
      var stats = sessionStats();
      if (stats.setsTotal > 0 && stats.setsDone === stats.setsTotal) {
        openClose("completa");
        return;
      }
      openFinishModal(stats);
    });

    $("btnCloseFinish").addEventListener("click", function () { closeModal($("finishModal")); });
  }

  function openFinishModal(stats) {
    var body = $("finishModalBody");
    body.innerHTML = "";
    body.appendChild(el("p", "lede",
      "Llevas " + stats.setsDone + " de " + stats.setsTotal + " series y " +
      stats.exDone + " de " + stats.exTotal + " ejercicios. Si guardas ahora se registrará como sesión parcial, no como completada."));

    var keep = el("button", "btn btn--primary btn--block", "Continuar registrando");
    keep.type = "button";
    keep.addEventListener("click", function () { closeModal($("finishModal")); });
    body.appendChild(keep);

    var partial = el("button", "btn btn--ghost btn--block", "Guardar como parcial");
    partial.type = "button";
    partial.addEventListener("click", function () {
      closeModal($("finishModal"));
      openClose("parcial");
    });
    body.appendChild(partial);

    openModal("finishModal");
  }

  function openClose(mode) {
    closeMode = mode;
    var stats = sessionStats();

    var summary = $("closeSummary");
    summary.className = "closesummary" + (mode === "parcial" ? " closesummary--partial" : "");
    summary.innerHTML = "";
    summary.appendChild(el("p", "closesummary__head",
      mode === "parcial" ? "Se guardará como parcial" : "Sesión completada"));
    summary.appendChild(el("p", "closesummary__meta",
      stats.exDone + " de " + stats.exTotal + " ejercicios · " +
      stats.setsDone + " de " + stats.setsTotal + " series registradas" +
      (session.state === "adaptada" ? " · versión adaptada" : "")));

    $("closeKicker").textContent = mode === "parcial" ? "Cierre parcial" : "Cierre";

    // La confirmación explícita de "he terminado la versión adaptada" solo tiene
    // sentido en un cierre parcial de una sesión que el usuario adaptó a propósito.
    var showAdapted = mode === "parcial" && session.state === "adaptada";
    $("adaptedDoneField").hidden = !showAdapted;
    if (!showAdapted) $("adaptedDoneCheck").checked = false;

    showView("close");
  }

  function wireCloseSession() {
    $("btnSaveClose").addEventListener("click", function () {
      var esfuerzo = getSelectedValue("esfuerzo");
      if (!esfuerzo) {
        showToast("Indica el esfuerzo global antes de guardar.");
        return;
      }

      var stats = sessionStats();
      var adaptedConfirmed = closeMode === "parcial" &&
        session.state === "adaptada" &&
        $("adaptedDoneCheck").checked;
      var isComplete = closeMode === "completa" || adaptedConfirmed;

      // Minutos proporcionales a lo realmente registrado: no se inflan.
      var minutes = stats.setsTotal
        ? Math.max(5, Math.round(FULL_SESSION_MINUTES * (stats.setsDone / stats.setsTotal)))
        : 5;

      var status = isComplete
        ? (session.state === "adaptada" ? "adapted" : "completed")
        : "partial";

      HISTORY.unshift({
        title: "Pull",
        meta: "Hoy · " + minutes + " min · " + stats.exDone + " de " + stats.exTotal + " ejercicios · " +
              stats.setsDone + " de " + stats.setsTotal + " series · esfuerzo " + esfuerzo,
        status: status
      });

      // Una sesión adaptada terminada cuenta como hecha (MVP §11), pero se etiqueta
      // "Adaptada", no "Completada": plan, carril e historial deben decir lo mismo.
      var pull = findSession("pull");
      pull.status = isComplete
        ? (session.state === "adaptada" ? "adaptada" : "completada")
        : "parcial";
      pull.duration = minutes;

      showToast(isComplete
        ? "Sesión guardada como completada."
        : "Sesión guardada como parcial: cuenta lo registrado, no la sesión entera.");
      showView("home");
    });
  }

  /* =====================================================================
   * Selectores rápidos (aria-pressed) y mapa corporal
   * ================================================================== */

  function getSelectedValue(groupName) {
    var group = document.querySelector('.picker[data-group="' + groupName + '"]');
    if (!group) return null;
    var selected = group.querySelector('[aria-pressed="true"]');
    return selected ? selected.getAttribute("data-value") : null;
  }

  function selectValue(groupName, value) {
    var group = document.querySelector('.picker[data-group="' + groupName + '"]');
    if (!group) return;
    var buttons = group.querySelectorAll(".picker__btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed",
        buttons[i].getAttribute("data-value") === value ? "true" : "false");
    }
  }

  function wirePickers() {
    var groups = document.querySelectorAll(".picker[data-group]");
    for (var g = 0; g < groups.length; g++) {
      (function (group) {
        var groupName = group.getAttribute("data-group");
        var buttons = group.querySelectorAll(".picker__btn");
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].addEventListener("click", function (e) {
            var btn = e.currentTarget;
            var already = btn.getAttribute("aria-pressed") === "true";
            for (var j = 0; j < buttons.length; j++) buttons[j].setAttribute("aria-pressed", "false");
            if (!already) btn.setAttribute("aria-pressed", "true");
            onPickerChange(groupName);
          });
        }
      })(groups[g]);
    }
  }

  function onPickerChange(groupName) {
    if (groupName === "molestias") {
      var value = getSelectedValue("molestias");
      checkinState.molestias = value;
      var showMap = !!value && value !== "ninguna";
      $("bodyMapSection").hidden = !showMap;
      if (showMap) selectValue("intensidadZona", value);
    }
    if (groupName === "intensidadZona" || groupName === "molestias") {
      $("importantPainNotice").hidden = getSelectedValue("intensidadZona") !== "importante";
    }
    if (groupName === "molestiasCierre") {
      $("closePainNotice").hidden = getSelectedValue("molestiasCierre") !== "importante";
    }
  }

  function wireBodyMap() {
    var zones = document.querySelectorAll(".zone");
    for (var i = 0; i < zones.length; i++) {
      zones[i].addEventListener("click", function (e) {
        var btn = e.currentTarget;
        var all = document.querySelectorAll(".zone");
        for (var j = 0; j < all.length; j++) all[j].setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-pressed", "true");
        checkinState.zona = btn.getAttribute("data-zone");
        checkinState.lado = btn.getAttribute("data-lado");
        // Las etiquetas abreviadas ya acaban en punto ("Hombro der."): no duplicarlo.
        checkinState.zonaTexto = btn.textContent.trim().replace(/\.$/, "");
        $("zoneSelectedText").textContent = "Zona seleccionada: " + checkinState.zonaTexto + ".";
      });
    }
  }

  /* =====================================================================
   * Pestañas con teclado (flechas, Inicio, Fin)
   * ================================================================== */

  function wireTabs() {
    var lists = document.querySelectorAll("[data-tabs]");
    for (var i = 0; i < lists.length; i++) {
      (function (list) {
        var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
        tabs.forEach(function (tab, index) {
          tab.addEventListener("click", function () { selectTab(tabs, index); });
          tab.addEventListener("keydown", function (e) {
            var next = null;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % tabs.length;
            else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
            else if (e.key === "Home") next = 0;
            else if (e.key === "End") next = tabs.length - 1;
            if (next === null) return;
            e.preventDefault();
            selectTab(tabs, next);
            tabs[next].focus();
          });
        });
      })(lists[i]);
    }
  }

  function selectTab(tabs, activeIndex) {
    tabs.forEach(function (tab, i) {
      var active = i === activeIndex;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      if (active) tab.removeAttribute("tabindex");
      else tab.setAttribute("tabindex", "-1");
      var panel = $(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !active;
    });
  }

  /* =====================================================================
   * Check-in y adaptación
   * ================================================================== */

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
    var apply = [];
    var duration = checkin.tiempo || "40";

    if (checkin.tiempo === "20" || checkin.tiempo === "40") {
      changes.push("Se retira el curl de bíceps para ajustarse a " + checkin.tiempo + " minutos disponibles.");
      apply.push(function () {
        var ex = findExercise("curl");
        if (ex) ex.included = false;
      });
    }

    if (checkin.molestias !== "ninguna" && checkin.zona === "hombro") {
      var lado = checkin.lado && checkin.lado !== "none" ? " " + checkin.lado : "";
      changes.push("Se reduce una serie de jalón al pecho y de remo sentado para bajar la carga sobre el hombro" + lado + " que indicaste.");
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
      // No decir "en la zona que indicaste": el recorte es genérico (siempre jalón),
      // no un ajuste dirigido a esa zona. No prometer precisión que el motor no tiene.
      changes.push("Se reduce ligeramente el volumen general de la sesión porque indicaste una molestia. No es un ajuste dirigido a una zona concreta; puedes editarlo.");
      apply.push(function () {
        var jalon = findExercise("jalon");
        if (jalon && jalon.sets.length > 2) jalon.sets.pop();
      });
    }

    if (checkin.energia === "baja") {
      changes.push("El descanso recomendado entre series sube 15 s para compensar la energía baja.");
      apply.push(function () {
        EXERCISES.forEach(function (ex) { ex.restSeconds += 15; });
      });
    }

    if (!changes.length) {
      changes.push("No se detectan ajustes necesarios: puedes mantener la sesión Pull tal como está prevista.");
    }

    var reason = ["energía " + checkin.energia, "motivación " + checkin.motivacion, checkin.tiempo + " min disponibles"];
    if (checkin.molestias !== "ninguna") {
      reason.push("molestia " + checkin.molestias + (checkin.zonaTexto ? " en " + checkin.zonaTexto.toLowerCase() : ""));
    }

    return {
      title: "Pull adaptado · " + duration + " min",
      changes: changes,
      reason: "Motivo: indicaste " + reason.join(", ") + ".",
      importantPain: checkin.molestias === "importante" || checkin.intensidadZona === "importante",
      apply: function () { apply.forEach(function (fn) { fn(); }); }
    };
  }

  function renderAdaptation(adaptation) {
    $("adaptationName").textContent = adaptation.title;
    var list = $("adaptationChanges");
    list.innerHTML = "";
    adaptation.changes.forEach(function (c) { list.appendChild(el("li", null, c)); });
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

  /* =====================================================================
   * Historial
   * ================================================================== */

  function renderHistory() {
    var list = $("historyList");
    list.innerHTML = "";
    HISTORY.forEach(function (item) { list.appendChild(buildLogItem(item)); });

    var marks = $("adherenceMarks");
    marks.innerHTML = "";
    ADHERENCE.forEach(function (hit) {
      marks.appendChild(el("span", "adherence__mark" + (hit ? " is-hit" : "")));
    });
  }

  function wireHistory() {
    $("btnViewProgress").addEventListener("click", function () {
      var body = $("progressModalBody");
      body.innerHTML = "";
      body.appendChild(el("p", "lede small", "Jalón al pecho · polea (agarre ancho)"));
      PROGRESS_EXAMPLE.forEach(function (p) {
        var row = el("div", "progressrow");
        row.appendChild(el("span", null, p.fecha));
        row.appendChild(el("b", null, p.valor));
        body.appendChild(row);
      });
      openModal("progressModal");
    });
  }

  /* =====================================================================
   * Hojas modales
   * ================================================================== */

  var lastFocusedEl = null;
  var activeOverlay = null;

  function getFocusable(container) {
    var nodes = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    return Array.prototype.filter.call(nodes, function (node) {
      return !node.disabled && node.offsetParent !== null;
    });
  }

  function openModal(overlayId) {
    var overlay = $(overlayId);
    if (overlay.hidden) lastFocusedEl = document.activeElement;
    overlay.hidden = false;
    activeOverlay = overlay;
    // Foco inicial en el primer control del cuerpo (la acción real), no en la ✕.
    var body = overlay.querySelector(".sheet__body");
    var focusable = getFocusable(body && getFocusable(body).length ? body : overlay);
    if (focusable.length) focusable[0].focus();
  }

  function closeModal(overlay) {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    if (overlay === activeOverlay) activeOverlay = null;

    // Si quien abrió el modal fue destruido por un re-render (renderPlan()
    // reconstruye la fila "Recolocar"), el foco vuelve al título de la vista.
    var target = lastFocusedEl && lastFocusedEl.isConnected && lastFocusedEl !== document.body
      ? lastFocusedEl
      : null;
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

    var overlays = document.querySelectorAll(".sheet-overlay");
    for (var i = 0; i < overlays.length; i++) {
      (function (overlay) {
        overlay.addEventListener("click", function (e) {
          if (e.target === overlay) closeModal(overlay);
        });
      })(overlays[i]);
    }

    document.addEventListener("keydown", function (e) {
      if (!activeOverlay) return;
      if (e.key === "Escape") {
        closeModal(activeOverlay);
        return;
      }
      if (e.key !== "Tab") return;
      var focusable = getFocusable(activeOverlay);
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
   * Tema y estado simulado
   * ================================================================== */

  function wireTheme() {
    $("themeToggle").addEventListener("click", function () {
      var root = document.documentElement;
      var toLight = root.getAttribute("data-theme") !== "light";
      if (toLight) {
        root.setAttribute("data-theme", "light");
        $("themeToggle").setAttribute("aria-pressed", "true");
        $("themeToggle").setAttribute("aria-label", "Cambiar a modo oscuro");
      } else {
        root.removeAttribute("data-theme");
        $("themeToggle").setAttribute("aria-pressed", "false");
        $("themeToggle").setAttribute("aria-label", "Cambiar a modo claro");
      }
    });
  }

  function wireSyncStatus() {
    $("syncStatus").addEventListener("click", function () {
      showToast("Estado simulado: en este prototipo no hay sincronización real.");
    });
  }

  /* =====================================================================
   * Arranque
   * ================================================================== */

  function init() {
    wireNav();
    wireTabs();
    wireExerciseView();
    wireFinishSession();
    wireCloseSession();
    wirePickers();
    wireBodyMap();
    wireReviewProposal();
    wireAdaptationDecision();
    wireHistory();
    wireModals();
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
