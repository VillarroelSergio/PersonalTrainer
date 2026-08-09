/* =====================================================================
 * Trainer — dataset ficticio (LOTE 1)
 * Sin backend, sin fetch: todo vive en memoria bajo App.data.
 *
 * App.dataDefaults() devuelve una copia limpia (usada por App.reset()).
 * App.data es la copia mutable que usan las vistas.
 *
 * Modelo de sesiones: una sesión = un objeto con UN solo `day` (la clave de
 * DAYS en la que está programada). Recolocar cambia `day` y anota
 * `movedFrom`; nunca se duplica la sesión. `estado` es siempre uno de:
 * planificada | en_curso | completada | adaptada | parcial | omitida.
 * El día "hoy" del prototipo es fijo (App.data.hoy), no la fecha real del
 * sistema: es una demo, no un calendario en vivo.
 *
 * Lotes siguientes: añadid aquí los campos que os falten (no borréis los
 * existentes) y documentad el motivo en un comentario corto.
 * ================================================================== */
(function () {
  "use strict";

  var App = (window.App = window.App || {});

  // ---- Ficha de ejercicio (catalogo-visual-ejercicios-004) ---------------
  // Transcripción literal de prototype/assets/exercises/manifest.json. No se
  // lee con fetch (el prototipo debe seguir abriendo con file://): es una
  // constante local que replica los mismos exerciseId/file/status/alt del
  // manifiesto. Si se añade un recurso nuevo, actualizar AMBOS: el manifest
  // (documentación/origen) y esta tabla (lo que de verdad usa la UI).
  var EXERCISE_MEDIA = {
    "jalon-polea": { file: "illustrations/jalon-polea-agarre-ancho-v1.webp", status: "available", alt: "Persona sentada realizando un jalón al pecho en polea con agarre ancho." },
    "dominada-asistida": { file: null, status: "pending" },
    "dominada-libre": { file: null, status: "pending" },
    "remo-sentado-maquina": { file: null, status: "pending" },
    "remo-barra": { file: null, status: "pending" },
    "remo-punta-t": { file: null, status: "pending" },
    "face-pull-cuerda": { file: null, status: "pending" },
    "pajaros-mancuerna": { file: null, status: "pending" },
    "press-banca-barra": { file: null, status: "pending" },
    "press-banca-mancuernas": { file: null, status: "pending" },
    "press-maquina": { file: null, status: "pending" },
    "press-militar-barra": { file: null, status: "pending" },
    "press-militar-mancuernas": { file: null, status: "pending" },
    "elevacion-lateral-mancuerna": { file: null, status: "pending" },
    "fondos-maquina": { file: null, status: "pending" },
    "extension-triceps-cuerda": { file: null, status: "pending" },
    "press-frances": { file: null, status: "pending" },
    "curl-biceps-barra": { file: null, status: "pending" },
    "curl-biceps-mancuerna": { file: null, status: "pending" },
    "curl-biceps-polea": { file: null, status: "pending" },
    "sentadilla-barra": { file: null, status: "pending" },
    "sentadilla-goblet": { file: null, status: "pending" },
    "prensa-45": { file: null, status: "pending" },
    "zancada-mancuernas": { file: null, status: "pending" },
    "peso-muerto-rumano": { file: null, status: "pending" },
    "curl-femoral-maquina": { file: null, status: "pending" },
    "hip-thrust-barra": { file: null, status: "pending" },
    "elevacion-gemelo-maquina": { file: null, status: "pending" },
    "elevacion-gemelo-prensa": { file: null, status: "pending" },
    "aductor-maquina": { file: null, status: "pending" },
    "abductor-maquina": { file: null, status: "pending" },
    "crunch-polea": { file: null, status: "pending" },
    "plancha": { file: null, status: "pending" }
  };

  // ---- Helpers de dominio, reenganchados a cada copia de App.data --------
  function attachDataHelpers(data) {
    // ---- LOTE 3: reconstruye el mapa sessionId -> ejercicios en CADA
    // reenganche, no solo en dataDefaults(). App.load() reconstruye App.data
    // desde JSON.parse (localStorage), lo que rompe la identidad de objeto
    // entre data.EXERCISES y data.SESSION_EXERCISES.pull; sin este bloque
    // aquí, "pull" y "EXERCISES" pasarían a ser dos arrays distintos tras
    // una recarga y las mutaciones (omitir, series, variante) dejarían de
    // reflejarse en data.findExercise().
    if (data.EXERCISES) {
      data.SESSION_EXERCISES = {
        pull: data.EXERCISES,
        push: data.PUSH_EXERCISES,
        legs: data.LEGS_EXERCISES
      };
    }

    data.sessionOnDay = function (dayKey) {
      for (var i = 0; i < data.SESSIONS.length; i++) {
        if (data.SESSIONS[i].day === dayKey) return data.SESSIONS[i];
      }
      return null;
    };

    // Registro visual del día del que se movió una sesión (no es sesión activa).
    data.ghostOnDay = function (dayKey) {
      for (var i = 0; i < data.SESSIONS.length; i++) {
        if (data.SESSIONS[i].movedFrom === dayKey) return data.SESSIONS[i];
      }
      return null;
    };

    data.dayByKey = function (key) {
      for (var i = 0; i < data.DAYS.length; i++) {
        if (data.DAYS[i].key === key) return data.DAYS[i];
      }
      return null;
    };

    data.findSession = function (id) {
      for (var i = 0; i < data.SESSIONS.length; i++) {
        if (data.SESSIONS[i].id === id) return data.SESSIONS[i];
      }
      return null;
    };

    // Busca en todas las sesiones de fuerza conocidas (nota: un id de
    // ejercicio puede vivir en pull, push o legs; ya no asumimos que todo
    // está en data.EXERCISES).
    // Resuelve la ilustración real de un ejercicio a partir de su
    // exerciseId de catálogo (nota: NO uses el id de sesión aquí si difiere
    // del id de catálogo; usa exercise.catalogId cuando exista). Devuelve
    // siempre un objeto: { available: false, alt } cuando no hay recurso
    // (o el exerciseId no está en el manifest), nunca un src inválido.
    data.exerciseMedia = function (exerciseId) {
      var entry = EXERCISE_MEDIA[exerciseId];
      if (!entry || entry.status !== "available" || !entry.file) {
        return { available: false, alt: (entry && entry.alt) || null };
      }
      return { available: true, src: "assets/exercises/" + entry.file, alt: entry.alt || "" };
    };

    data.findExercise = function (id) {
      var lists = data.SESSION_EXERCISES ? Object.keys(data.SESSION_EXERCISES).map(function (k) { return data.SESSION_EXERCISES[k]; }) : [data.EXERCISES];
      for (var l = 0; l < lists.length; l++) {
        var list = lists[l] || [];
        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) return list[i];
        }
      }
      return null;
    };

    // Total previsto = SESSIONS.length: recolocar una sesión no lo altera.
    data.weekStats = function () {
      var previstas = data.SESSIONS.length;
      var hechas = 0;
      var minutos = 0;
      data.SESSIONS.forEach(function (s) {
        if (s.estado === "completada" || s.estado === "adaptada" || s.estado === "parcial") {
          hechas++;
          minutos += s.duracionPrevista || 0;
        }
      });
      return { previstas: previstas, hechas: hechas, minutos: minutos, constancia: data.plan.constanciaSemanas };
    };

    data.setSessionState = function (id, estado) {
      var s = data.findSession(id);
      if (!s) return null;
      s.estado = estado;
      // Cualquier otra decisión sobre la sesión invalida un deshacer pendiente
      // de esa misma sesión (nota 15: "deshacer solo revierte una acción que
      // no haya sido sustituida por otra decisión posterior").
      if (data.lastAction && data.lastAction.sessionId === id) data.lastAction = null;
      return s;
    };

    // ---- LOTE 2: ciclo de vida del calendario (nota 15) -------------------
    // ponytail: un único slot de deshacer global (no una pila por sesión).
    // Cubre los flujos reales del prototipo (una acción, deshacer inmediato).
    // Si hiciera falta deshacer acciones antiguas tras otras decisiones,
    // habría que pasar a una pila de acciones por sesión.
    data.lastAction = null;

    data.weekPlannedMinutes = function () {
      var total = 0;
      data.SESSIONS.forEach(function (s) { total += s.duracionPrevista || 0; });
      return total;
    };

    // Elige día destino sin sesión activa (evita colisión de dos sesiones el
    // mismo día; recolocar solo se ofrece hacia huecos libres).
    data.freeDays = function (excludeDayKey) {
      return data.DAYS.filter(function (d) {
        if (d.key === excludeDayKey) return false;
        return !data.sessionOnDay(d.key);
      });
    };

    // Choque de carga: sesión de piernas pesada junto a resistencia intensa,
    // en cualquiera de los dos sentidos, en un día adyacente (sin envolver la
    // semana: el domingo no es "adyacente" al lunes).
    function isLegsHeavy(s) { return s.tipo === "fuerza" && /legs/i.test(s.nombre || s.id || ""); }
    function isIntenseCardio(s) { return s.tipo === "resistencia" && !!s.intense; }

    data.findConflict = function (sessionsList, dayKey, candidate) {
      var idx = -1;
      for (var i = 0; i < data.DAYS.length; i++) { if (data.DAYS[i].key === dayKey) idx = i; }
      if (idx < 0) return null;
      var neighborKeys = [];
      if (idx > 0) neighborKeys.push(data.DAYS[idx - 1].key);
      if (idx < data.DAYS.length - 1) neighborKeys.push(data.DAYS[idx + 1].key);
      var conflict = null;
      neighborKeys.forEach(function (nk) {
        var other = null;
        for (var j = 0; j < sessionsList.length; j++) {
          if (sessionsList[j].day === nk && sessionsList[j].id !== candidate.id) { other = sessionsList[j]; break; }
        }
        if (!other) return;
        if ((isLegsHeavy(candidate) && isIntenseCardio(other)) || (isIntenseCardio(candidate) && isLegsHeavy(other))) {
          conflict = other;
        }
      });
      return conflict;
    };

    data.wouldConflict = function (session, targetDayKey) {
      return data.findConflict(data.SESSIONS, targetDayKey, session);
    };

    // ---- prioridad-hibrida-006: guardarraíl de carga para la semana activa.
    // Reutiliza findConflict (ya detecta el choque piernas/cardio intenso) en
    // vez de reimplementar la regla; solo recorre las sesiones de resistencia
    // para devolver siempre { session: <resistencia>, conflict: <fuerza> },
    // así home.js y plan.js pueden construir la misma frase sin duplicar
    // lógica. Devuelve el primer choque encontrado (ponytail: un aviso a la
    // vez basta para el prototipo, igual que findActiveDiscomfort).
    data.weeklyLoadWarning = function () {
      for (var i = 0; i < data.SESSIONS.length; i++) {
        var s = data.SESSIONS[i];
        if (s.tipo !== "resistencia") continue;
        var conflict = data.findConflict(data.SESSIONS, s.day, s);
        if (conflict) return { session: s, conflict: conflict };
      }
      return null;
    };

    data.moveSession = function (id, targetDayKey) {
      var s = data.findSession(id);
      if (!s) return null;
      var originDay = s.day;
      data.lastAction = { type: "recolocar", sessionId: id, before: { day: originDay, movedFrom: s.movedFrom, sync: s.sync } };
      s.movedFrom = originDay;
      s.day = targetDayKey;
      s.sync = "local";
      return s;
    };

    data.skipSession = function (id, motivo) {
      var s = data.findSession(id);
      if (!s) return null;
      data.lastAction = { type: "omitir", sessionId: id, before: { estado: s.estado, motivo: s.motivoOmision, sync: s.sync } };
      s.estado = "omitida";
      s.motivoOmision = motivo || null;
      s.sync = "local";
      return s;
    };

    data.editSession = function (id, changes) {
      var s = data.findSession(id);
      if (!s) return null;
      if (data.lastAction && data.lastAction.sessionId === id) data.lastAction = null;
      if (changes.nombre) s.nombre = changes.nombre;
      if (changes.tipo) s.tipo = changes.tipo;
      s.sync = "local";
      return s;
    };

    data.undoLastAction = function () {
      var action = data.lastAction;
      if (!action) return false;
      var s = data.findSession(action.sessionId);
      if (!s) return false;
      if (action.type === "recolocar") {
        s.day = action.before.day;
        s.movedFrom = action.before.movedFrom;
        s.sync = action.before.sync;
      } else if (action.type === "omitir") {
        s.estado = action.before.estado;
        s.motivoOmision = action.before.motivo;
        s.sync = action.before.sync;
      }
      data.lastAction = null;
      return true;
    };

    // ---- LOTE 2: fases con propósito en lenguaje llano ---------------------
    data.buildFasesFromTemplate = function (semanaActual) {
      var actual = semanaActual || 1;
      var acc = 0;
      return data.PHASE_TEMPLATE.map(function (t) {
        var start = acc + 1, end = acc + t.semanas;
        acc = end;
        var estado = actual > end ? "completada" : (actual >= start ? "actual" : "pendiente");
        return {
          nombre: t.nombre,
          proposito: t.proposito,
          span: t.semanas,
          semanas: t.semanas === 1 ? ("Semana " + start) : ("Semanas " + start + "-" + end),
          estado: estado
        };
      });
    };

    // ---- LOTE 2 (mejoras-ux-ui-004): generación de semana para el creador
    // guiado, REALMENTE híbrida. Antes, la resistencia solo se colocaba en
    // días que quedaran totalmente libres tras poner la fuerza, así que con
    // pocos días libres podía acabar en 0 sesiones de resistencia pese a que
    // la persona pidió correr/bici/andar (bug diagnosticado). Ahora
    // `diasDisponibles` es el total de días CON sesión (fuerza + resistencia
    // juntas), nunca solo los de fuerza: se reparte ese cupo entre ambas en
    // vez de añadir resistencia por encima.
    // Mapea actividad + intensidad a una clave YA existente de
    // ENDURANCE_OBJECTIVES (no se crea catálogo nuevo). Trail/Senderismo/
    // Andar intensos son una tirada larga y dura, no series de pista, así que
    // van a "fondo-tirada-larga" en vez de "intervalos".
    var ENDURANCE_OBJETIVO_POR_ACTIVIDAD = {
      "Correr": { intense: "intervalos", suave: "continua-suave" },
      "Bici": { intense: "intervalos", suave: "bici" },
      "Andar": { intense: "fondo-tirada-larga", suave: "caminata" },
      "Trail": { intense: "fondo-tirada-larga", suave: "caminata" },
      "Senderismo": { intense: "fondo-tirada-larga", suave: "caminata" }
    };
    function enduranceObjetivoFor(cardioActividad, isIntense) {
      var pair = ENDURANCE_OBJETIVO_POR_ACTIVIDAD[cardioActividad] || ENDURANCE_OBJETIVO_POR_ACTIVIDAD.Correr;
      return isIntense ? pair.intense : pair.suave;
    }

    // Devuelve { sessions, infeasible, explanation, totalDays, freq,
    // strengthDays, suggestReduceFreq, suggestExtraDay }. `sessions` es la
    // lista a usar (vacía si infeasible); `explanation` es siempre texto
    // llano listo para mostrar en el paso 7.
    data.generatePlanWeek = function (opts) {
      var minutosPorDuracion = { "20 min": 20, "40 min": 40, "60 min": 60, "90+ min": 90 };
      var minutos = minutosPorDuracion[opts.duracionHabitual] || 40;
      var pattern, proposito;

      if (opts.modo === "cero") {
        pattern = [opts.primeraSesionNombre || "Sesión principal"];
        proposito = {};
        proposito[pattern[0]] = "Tu sesión inicial, definida a medida.";
      } else {
        var tmpl = data.PLAN_TEMPLATES[opts.plantilla] || data.PLAN_TEMPLATES.ppl;
        pattern = tmpl.pattern;
        proposito = tmpl.proposito;
      }

      var totalDays = Math.min(Math.max(parseInt(opts.diasDisponibles, 10) || 3, 1), 6);
      var cardioOn = !!(opts.cardioActividad && opts.cardioActividad !== "Ninguna");
      var freq = cardioOn ? Math.min(Math.max(parseInt(opts.cardioFrecuencia, 10) || 0, 0), 3) : 0;
      var strengthDays = totalDays - freq;

      // Caso imposible: no queda ni un día para la sesión de fuerza/base.
      // Nunca se ignora en silencio la elección de resistencia: se explica y
      // se ofrece una alternativa concreta y reaplicable.
      if (freq > 0 && strengthDays < 1) {
        return {
          sessions: [],
          infeasible: true,
          totalDays: totalDays, freq: freq, strengthDays: 0,
          suggestReduceFreq: Math.max(1, totalDays - 1),
          suggestExtraDay: Math.min(6, totalDays + 1),
          explanation: "Con " + totalDays + " día" + (totalDays === 1 ? "" : "s") + " disponible" + (totalDays === 1 ? "" : "s") +
            " y " + freq + (freq === 1 ? " sesión" : " sesiones") + " de " + opts.cardioActividad.toLowerCase() +
            " a la semana no queda ningún día para tu sesión de fuerza. Reduce las sesiones de resistencia o añade un día disponible."
        };
      }

      // Reparte los días elegidos a lo largo de la semana en vez de agruparlos.
      var step = Math.max(1, Math.floor(7 / totalDays));
      var chosenDays = [];
      for (var i = 0; i < totalDays; i++) chosenDays.push(data.DAYS[(i * step) % 7]);
      var strengthDayObjs = chosenDays.slice(0, strengthDays);
      var cardioDayObjs = chosenDays.slice(strengthDays);

      var sessions = [];
      strengthDayObjs.forEach(function (day, idx) {
        var kind = pattern[idx % pattern.length];
        sessions.push({
          id: "gen-" + day.key + "-fuerza-" + idx,
          tipo: opts.modo === "cero" ? opts.primeraSesionTipo : "fuerza",
          nombre: kind,
          day: day.key,
          estado: "planificada",
          duracionPrevista: minutos,
          movedFrom: null,
          procedencia: "local",
          sync: "local",
          proposito: proposito[kind] || "Sesión de fuerza.",
          intense: /legs/i.test(kind)
        });
      });

      if (cardioDayObjs.length) {
        // Elige qué día de resistencia lleva la sesión intensa: preferimos
        // uno que NO quede junto a una sesión de piernas pesada. Si todos
        // chocan, se coloca igual (nunca se descarta la elección de la
        // persona) y el aviso notice--warn por día ya existente lo explica.
        var intenseIdx = 0;
        for (var c = 0; c < cardioDayObjs.length; c++) {
          var probe = { id: "probe", tipo: "resistencia", intense: true };
          if (!data.findConflict(sessions, cardioDayObjs[c].key, probe)) { intenseIdx = c; break; }
        }
        cardioDayObjs.forEach(function (day, idx) {
          var isIntense = idx === intenseIdx;
          sessions.push({
            id: "gen-" + day.key + "-resistencia-" + idx,
            tipo: "resistencia",
            nombre: opts.cardioActividad + (isIntense ? " intensa" : " suave"),
            day: day.key,
            estado: "planificada",
            duracionPrevista: isIntense ? 45 : 30,
            movedFrom: null,
            procedencia: "local",
            sync: "local",
            proposito: isIntense ? "Estímulo cardiovascular más exigente de la semana." : "Resistencia suave: ayuda a recuperar sin sumar fatiga.",
            intense: isIntense,
            // ---- corrección bloqueante (revisora, criterio 4): sin `objetivo`
            // data.enduranceTemplate() devuelve null y endurance.js no puede
            // mostrar la guía sin reloj. Reutiliza las claves YA existentes en
            // ENDURANCE_OBJECTIVES (ninguna plantilla nueva).
            objetivo: enduranceObjetivoFor(opts.cardioActividad, isIntense)
          });
        });
      }

      // Bloques del patrón (p. ej. Legs) que no caben esta semana con los
      // días de fuerza elegidos. Nunca se eliminan en silencio: se nombran
      // aquí y se explican como rotación a la semana siguiente, no como
      // sesiones perdidas (criterio: "no puede eliminar Legs u otro bloque
      // de fuerza silenciosamente").
      var rotatedKinds = (strengthDayObjs.length > 0 && strengthDayObjs.length < pattern.length)
        ? pattern.slice(strengthDayObjs.length)
        : [];

      var explanationParts = [
        "Repartimos tus " + totalDays + " día" + (totalDays === 1 ? "" : "s") + " disponibles en " +
        strengthDayObjs.length + (strengthDayObjs.length === 1 ? " sesión" : " sesiones") + " de fuerza" +
        (cardioDayObjs.length ? " y " + cardioDayObjs.length + " de " + opts.cardioActividad.toLowerCase() + "." : ".")
      ];
      if (rotatedKinds.length) {
        explanationParts.push(
          "Con estos días no entra " + rotatedKinds.join(" ni ") + " esta semana: no se elimina de tu plan, " +
          "rota como primera" + (rotatedKinds.length > 1 ? "s sesiones" : " sesión") + " de la semana siguiente."
        );
      }
      if (cardioDayObjs.length) {
        explanationParts.push("Separamos, cuando ha sido posible, la sesión de resistencia más intensa de tus piernas pesadas para no acumular fatiga el mismo día.");
      }
      explanationParts.push("Puedes editar, mover u omitir cualquier sesión después desde el calendario.");

      return {
        sessions: sessions,
        infeasible: false,
        totalDays: totalDays, freq: freq, strengthDays: strengthDayObjs.length,
        rotatedKinds: rotatedKinds,
        explanation: explanationParts.join(" ")
      };
    };

    // ponytail: comprobación mínima de generatePlanWeek (no una suite). No se
    // ejecuta sola al cargar la página: llamar a mano desde la consola con
    // App.data.__selftest(). Cubre el bug real diagnosticado (Correr con
    // pocos días libres podía acabar sin ninguna sesión de resistencia) y el
    // límite de días elegidos.
    data.__selftest = function () {
      var diasList = ["3", "4", "5", "6"];
      var freqList = ["1", "2", "3"];
      var pass = true;
      diasList.forEach(function (d) {
        freqList.forEach(function (f) {
          var totalDays = parseInt(d, 10);
          var freq = parseInt(f, 10);
          var result = data.generatePlanWeek({
            modo: "plantilla", plantilla: "ppl",
            diasDisponibles: d, duracionHabitual: "40 min",
            cardioActividad: "Correr", cardioFrecuencia: f
          });
          var label = d + " días / " + f + "x correr";
          if (totalDays - freq < 1) {
            var okInfeasible = result.infeasible === true;
            console.assert(okInfeasible, label + ": debía marcarse infeasible.");
            pass = pass && okInfeasible;
            return;
          }
          var cardioCount = result.sessions.filter(function (s) { return s.tipo === "resistencia"; }).length;
          var okFeasible = result.infeasible === false;
          var okCardio = cardioCount >= 1;
          var okBudget = result.sessions.length <= totalDays;
          console.assert(okFeasible, label + ": no debía marcarse infeasible.");
          console.assert(okCardio, label + ": se esperaba >=1 sesión de resistencia, hubo " + cardioCount + ".");
          console.assert(okBudget, label + ": " + result.sessions.length + " sesiones exceden los " + totalDays + " días elegidos.");
          pass = pass && okFeasible && okCardio && okBudget;
        });
      });
      console.log(pass ? "data.__selftest(): OK, todos los casos límite pasan." : "data.__selftest(): FALLO, revisa los console.assert anteriores.");
      return pass;
    };

    // ---- LOTE 3: check-in, molestias, recuperación y sesión de fuerza -------

    // Sesiones semilla (push/pull/legs) resuelven por id de catálogo. Las
    // sesiones generadas por onboarding/creador guiado usan ids sintéticos
    // (gen-lunes-fuerza-0) que nunca coinciden con SESSION_EXERCISES: sin
    // este fallback por tipo de bloque (session.nombre), quedaban con 0
    // ejercicios (bug crítico, criterio "toda sesión de fuerza generada
    // debe incluir ejercicios, series y repeticiones").
    function exercisesForKind(kind) {
      if (kind === "Push") return data.PUSH_EXERCISES || null;
      if (kind === "Pull") return data.EXERCISES || null;
      if (kind === "Legs") return data.LEGS_EXERCISES || null;
      if (kind && kind.indexOf("Full body") === 0) {
        // Sin catálogo propio de full body: combina un tramo distinto de
        // push/pull/legs para cada letra (A/B/C) en vez de inventar
        // ejercicios nuevos fuera de MVP-DEFINITION.md §9.
        var idx = Math.max(0, kind.charCodeAt(kind.length - 1) - 65);
        var pick = function (list) { return (list || []).slice(idx * 2, idx * 2 + 2); };
        return pick(data.PUSH_EXERCISES).concat(pick(data.EXERCISES), pick(data.LEGS_EXERCISES));
      }
      return null;
    }

    data.exercisesForSession = function (sessionId) {
      var direct = data.SESSION_EXERCISES && data.SESSION_EXERCISES[sessionId];
      if (direct) return direct;
      var session = data.findSession(sessionId);
      return (session && exercisesForKind(session.nombre)) || null;
    };

    data.sessionProgress = function (sessionId) {
      if (!data.SESSION_PROGRESS[sessionId]) {
        data.SESSION_PROGRESS[sessionId] = { openExerciseId: null, mode: "confirm" };
      }
      return data.SESSION_PROGRESS[sessionId];
    };

    data.sessionStats = function (sessionId) {
      var list = (data.exercisesForSession(sessionId) || []).filter(function (ex) {
        return ex.included && !ex.omitido;
      });
      var setsTotal = 0, setsDone = 0, exDone = 0;
      list.forEach(function (ex) {
        var done = ex.sets.filter(function (s) { return s.estado === "hecha"; }).length;
        setsTotal += ex.sets.length;
        setsDone += done;
        if (ex.sets.length > 0 && done === ex.sets.length) exDone++;
      });
      return { exTotal: list.length, exDone: exDone, setsTotal: setsTotal, setsDone: setsDone };
    };

    // ---- Molestias (nota 16): la persona declara zona/lado/intensidad/tipo;
    // el sistema nunca los infiere. ponytail: un único aviso activo a la vez
    // basta para el prototipo (no hay historial de molestias por zona).
    data.findActiveDiscomfort = function () {
      for (var i = 0; i < data.DISCOMFORTS.length; i++) {
        var d = data.DISCOMFORTS[i];
        if (d.estado === "activo_reutilizable" || d.estado === "editado_hoy") return d;
      }
      return null;
    };

    data.saveDiscomfort = function (payload, reuseId) {
      var existing = reuseId ? data.DISCOMFORTS.filter(function (d) { return d.id === reuseId; })[0] : null;
      if (existing) {
        existing.zona = payload.zona;
        existing.lado = payload.lado;
        existing.zonaTexto = payload.zonaTexto;
        existing.intensidad = payload.intensidad;
        existing.tipo = payload.tipo;
        existing.estado = "editado_hoy";
        return existing;
      }
      var created = {
        id: "disc-" + Date.now(),
        zona: payload.zona, lado: payload.lado, zonaTexto: payload.zonaTexto,
        intensidad: payload.intensidad, tipo: payload.tipo,
        estado: "nuevo"
      };
      data.DISCOMFORTS.push(created);
      return created;
    };

    data.closeDiscomfort = function (id) {
      var d = data.DISCOMFORTS.filter(function (x) { return x.id === id; })[0];
      if (!d) return null;
      d.estado = "cerrado";
      return d;
    };

    // ---- Recuperación (nota 17): solo movilidad/cardio cuentan como
    // adherencia si sustituyen la sesión prevista de hoy; descansar es una
    // decisión registrada, no una alternativa "completada" del plan. --------
    data.completeRecovery = function (kind, opts) {
      opts = opts || {};
      var block = data.RECOVERY_BLOCKS[kind];
      var today = data.sessionOnDay(data.hoy);
      var minutos = opts.minutos || 0;
      if (block && today && (today.estado === "planificada" || today.estado === "en_curso")) {
        today.estado = "adaptada";
        today.duracionPrevista = minutos;
        today.esAdaptada = true;
        today.procedencia = "adaptado";
        today.sync = "local";
      }
      data.HISTORY.unshift({
        id: "hist-" + Date.now(),
        tipo: "recuperacion",
        fecha: "Hoy",
        semanasAtras: 0,
        nombre: block ? block.nombre : "Descanso",
        meta: "Hoy · " + (minutos ? minutos + " min · " : "") +
          (opts.esfuerzo ? "esfuerzo " + opts.esfuerzo : "registrado sin penalización"),
        estado: (block && today && today.esAdaptada) ? "adaptada" : "completada",
        procedencia: "adaptado",
        sync: "local",
        detalle: { minutos: minutos },
        versions: []
      });
      return today;
    };

    // ---- Cierre de sesión de fuerza: minutos proporcionales a lo realmente
    // registrado (nota 05), nunca la duración completa. ----------------------
    data.closeStrengthSession = function (session, opts) {
      var stats = data.sessionStats(session.id);
      var reference = (data.SESSION_REFERENCE_MINUTES && data.SESSION_REFERENCE_MINUTES[session.id]) || session.duracionPrevista || 45;
      var minutos = stats.setsTotal
        ? Math.max(5, Math.round(reference * (stats.setsDone / stats.setsTotal)))
        : 5;
      var estado = opts.completa
        ? (session.esAdaptada ? "adaptada" : "completada")
        : "parcial";
      data.setSessionState(session.id, estado);
      session.duracionPrevista = minutos;
      session.sync = "local";
      if (session.esAdaptada) session.procedencia = "adaptado";

      var metaParts = [
        "Hoy", minutos + " min",
        stats.exDone + " de " + stats.exTotal + " ejercicios",
        stats.setsDone + " de " + stats.setsTotal + " series"
      ];
      if (opts.esfuerzo) metaParts.push("esfuerzo " + opts.esfuerzo);
      // ---- LOTE 6: campos añadidos (tipo/fecha/detalle/versions) para que
      // history.js pueda filtrar, mostrar detalle de fuerza y versionar
      // correcciones. No se quita ningún campo existente (nombre/meta/estado/
      // procedencia/sync), solo se añaden.
      data.HISTORY.unshift({
        id: "hist-" + Date.now(),
        tipo: "fuerza",
        fecha: "Hoy",
        semanasAtras: 0,
        nombre: session.nombre,
        meta: metaParts.join(" · "),
        estado: estado,
        procedencia: session.esAdaptada ? "adaptado" : "local",
        sync: "local",
        detalle: { ejercicios: buildStrengthDetail(session.id) },
        // ---- CORRECCIÓN C4: la molestia y el comentario declarados al
        // cerrar se guardan aquí; antes se recibían en `opts` y se perdían
        // sin persistirse en ningún sitio. Señal declarada, nunca
        // diagnóstico: se guarda tal cual, sin inferir zona/intensidad/causa.
        molestia: opts.molestia || "Ninguna",
        comentario: opts.comentario || "",
        versions: []
      });
      return { session: session, stats: stats, minutos: minutos, estado: estado };
    };

    // ---- LOTE 6: resumen de series realmente registradas por ejercicio,
    // para el detalle de fuerza en el historial (carga, repeticiones y
    // volumen; nota 09). Usa solo series con estado "hecha".
    function buildStrengthDetail(sessionId) {
      var list = data.exercisesForSession(sessionId) || [];
      return list.filter(function (ex) { return ex.included && !ex.omitido; }).map(function (ex) {
        var done = ex.sets.filter(function (s) { return s.estado === "hecha"; });
        var volumen = done.reduce(function (sum, s) { return sum + (s.peso || 0) * (s.reps || 0); }, 0);
        var last = done.length ? done[done.length - 1] : (ex.sets[0] || { peso: 0, reps: 0 });
        return { nombre: ex.nombre, carga: last.peso, reps: last.reps, series: done.length, volumen: Math.round(volumen * 10) / 10 };
      });
    }

    // ---- LOTE 4: catálogo, favoritas, variantes y ejercicio propio (nota 08) --

    data.findCatalogItem = function (id) {
      for (var i = 0; i < data.EXERCISE_CATALOG.length; i++) {
        if (data.EXERCISE_CATALOG[i].id === id) return data.EXERCISE_CATALOG[i];
      }
      return null;
    };

    data.toggleFavorite = function (id) {
      var item = data.findCatalogItem(id);
      if (!item) return null;
      item.favorito = !item.favorito;
      return item;
    };

    data.addRecent = function (id) {
      data.RECENT_EXERCISE_IDS = [id].concat(
        data.RECENT_EXERCISE_IDS.filter(function (x) { return x !== id; })
      ).slice(0, 8);
    };

    data.searchCatalog = function (filters) {
      filters = filters || {};
      var q = (filters.query || "").trim().toLowerCase();
      return data.EXERCISE_CATALOG.filter(function (item) {
        if (filters.favoritosOnly && !item.favorito) return false;
        if (filters.patron && item.patron !== filters.patron) return false;
        if (filters.grupo && item.grupo !== filters.grupo) return false;
        if (filters.equipo && item.equipo !== filters.equipo) return false;
        if (q) {
          var hay = (item.nombre + " " + item.patron + " " + item.grupo + " " + item.equipo).toLowerCase();
          if (hay.indexOf(q) < 0) return false;
        }
        return true;
      });
    };

    // Orden obligatorio (nota 08): favoritas → recientes → mismo patrón →
    // catálogo general. Cada ítem aparece una sola vez (el primer grupo al
    // que pertenece "se lo queda").
    data.catalogAlternatives = function (item) {
      var favoritas = [], recientes = [], mismoPatron = [], catalogo = [];
      var seen = {};
      seen[item.id] = true;

      data.EXERCISE_CATALOG.forEach(function (other) {
        if (seen[other.id]) return;
        if (other.favorito) { favoritas.push(other); seen[other.id] = true; }
      });
      data.RECENT_EXERCISE_IDS.forEach(function (id) {
        if (seen[id]) return;
        var other = data.findCatalogItem(id);
        if (other) { recientes.push(other); seen[id] = true; }
      });
      data.EXERCISE_CATALOG.forEach(function (other) {
        if (seen[other.id]) return;
        if (other.patron === item.patron) { mismoPatron.push(other); seen[other.id] = true; }
      });
      data.EXERCISE_CATALOG.forEach(function (other) {
        if (seen[other.id]) return;
        catalogo.push(other); seen[other.id] = true;
      });
      return { favoritas: favoritas, recientes: recientes, mismoPatron: mismoPatron, catalogo: catalogo };
    };

    // ---- Ejercicio propio: recurso secundario, editable y eliminable por su
    // creador (nota 08). Vive en el mismo array que el catálogo general para
    // que aparezca en búsquedas y alternativas sin lógica duplicada. --------
    data.createCustomExercise = function (payload) {
      var id = "custom-" + Date.now();
      var item = {
        id: id, nombre: payload.nombre, patron: payload.patron || "Personalizado",
        grupo: payload.grupo || "Personalizado", equipo: payload.equipo || "Peso corporal",
        objetivo: payload.objetivo || "3 × 10-12 reps", favorito: false, custom: true, icon: "custom",
        guide: {
          cues: ["Ejercicio creado por ti: contrasta la técnica con una fuente fiable o un profesional."],
          muscles: []
        },
        video: "https://www.youtube.com/results?search_query=" + encodeURIComponent(payload.nombre + " técnica"),
        reference: { cargaInicial: 0, ultima: null, proxima: null, notaSugerencia: null }
      };
      data.EXERCISE_CATALOG.push(item);
      return item;
    };

    data.updateCustomExercise = function (id, payload) {
      var item = data.findCatalogItem(id);
      if (!item || !item.custom) return null;
      if (payload.nombre) item.nombre = payload.nombre;
      if (payload.patron) item.patron = payload.patron;
      if (payload.grupo) item.grupo = payload.grupo;
      if (payload.equipo) item.equipo = payload.equipo;
      if (payload.objetivo) item.objetivo = payload.objetivo;
      return item;
    };

    data.deleteCustomExercise = function (id) {
      var item = data.findCatalogItem(id);
      if (!item || !item.custom) return false;
      data.EXERCISE_CATALOG = data.EXERCISE_CATALOG.filter(function (x) { return x.id !== id; });
      data.RECENT_EXERCISE_IDS = data.RECENT_EXERCISE_IDS.filter(function (x) { return x !== id; });
      return true;
    };

    // ---- Referencia de carga y progresión por variante (nota 23) ------------
    // Regla conservadora y explicada, EXPLÍCITAMENTE pendiente de validación
    // profesional antes de producción (ver aviso mostrado en la ficha).
    data.suggestNextReference = function (objetivo, peso, reps, facilidad) {
      var m = /(\d+)\s*-\s*(\d+)/.exec(objetivo || "");
      var pesoNum = parseFloat(peso) || 0;
      var repsNum = parseInt(reps, 10) || 0;
      var min = m ? parseInt(m[1], 10) : repsNum;
      var max = m ? parseInt(m[2], 10) : repsNum;
      var step = Math.max(Math.round(pesoNum * 0.05 * 2) / 2, 1.25);
      var nextPeso, nota;

      if (repsNum >= max && (facilidad === "facil" || facilidad === "adecuada")) {
        nextPeso = Math.round((pesoNum + step) * 2) / 2;
        nota = "Dentro de rango y facilidad adecuada: se sugiere un progreso pequeño para la próxima vez.";
      } else if (repsNum < min || facilidad === "dura") {
        nextPeso = Math.max(0, Math.round((pesoNum - step) * 2) / 2);
        nota = "Quedó corto o resultó demasiado dura: se sugiere mantener o reducir.";
      } else {
        nextPeso = pesoNum;
        nota = "Dentro de rango: se mantiene la referencia.";
      }
      return { peso: nextPeso, reps: min || repsNum, nota: nota };
    };

    data.recordCatalogResult = function (catalogId, payload) {
      var item = data.findCatalogItem(catalogId);
      if (!item) return null;
      var suggestion = data.suggestNextReference(item.objetivo, payload.peso, payload.reps, payload.facilidad);
      item.reference.ultima = { peso: payload.peso, reps: payload.reps, facilidad: payload.facilidad };
      item.reference.proxima = { peso: suggestion.peso, reps: suggestion.reps };
      item.reference.notaSugerencia = suggestion.nota;
      data.addRecent(catalogId);
      return item;
    };

    // El resultado real prevalece: una edición manual posterior sustituye la
    // sugerencia calculada (nota 23).
    data.setNextReference = function (catalogId, peso, reps) {
      var item = data.findCatalogItem(catalogId);
      if (!item) return null;
      item.reference.proxima = { peso: peso, reps: reps };
      item.reference.notaSugerencia = "Editado a mano: esta referencia prevalece sobre la sugerencia calculada.";
      return item;
    };

    // ---- Añadir desde el catálogo a la sesión de hoy (nota 08/20) -----------
    // Mismo esquema de objeto que SESSION_EXERCISES para que strength.js lo
    // trate como cualquier otro ejercicio de sesión, sin lógica especial.
    data.buildSessionExerciseFromCatalog = function (item) {
      var pesoRef = item.reference.ultima ? item.reference.ultima.peso : (item.reference.cargaInicial || 0);
      return {
        id: "cat-" + item.id + "-" + Date.now(),
        nombre: item.nombre, variante: item.nombre, patron: item.patron, icon: item.icon,
        objetivo: item.objetivo,
        ultimoTexto: item.reference.ultima
          ? (item.reference.ultima.peso + " kg × " + item.reference.ultima.reps + " reps")
          : "Sin historial previo con esta variante",
        restSeconds: 90, difficulty: null, included: true, omitido: false,
        sets: [
          { peso: pesoRef, reps: 0, estado: "pendiente" },
          { peso: pesoRef, reps: 0, estado: "pendiente" },
          { peso: pesoRef, reps: 0, estado: "pendiente" }
        ],
        variantes: { favoritas: [], recientes: [], mismoPatron: [], catalogo: [] },
        guide: item.guide, video: item.video
      };
    };

    data.addCatalogExerciseToSession = function (sessionId, item) {
      var list = data.exercisesForSession(sessionId);
      if (!list) return null;
      var ex = data.buildSessionExerciseFromCatalog(item);
      list.push(ex);
      data.addRecent(item.id);
      return ex;
    };

    // Añadir al "bloque del borrador" no modifica ningún plan activo; ver nota
    // sobre DRAFT_BLOCK_EXERCISES en dataDefaults().
    data.addToDraftBlock = function (item) {
      data.DRAFT_BLOCK_EXERCISES.push({ catalogId: item.id, nombre: item.nombre, patron: item.patron });
      return data.DRAFT_BLOCK_EXERCISES;
    };

    // =====================================================================
    // resistencia-reloj-importacion-007: objetivos y transferencia al reloj.
    // La app YA NO ejecuta la actividad (sustituye a la antigua ejecución por
    // tramos de la nota 21): no hay tramo "en curso", pausa ni cronómetro.
    // La sesión se prepara, se confirma como creada en el reloj y el
    // resultado real llega por importación — ver data.saveImportedActivity.
    // Los ajustes de propuesta (duración/repeticiones/entorno) viven como
    // campos simples de la sesión (entorno, repeticionesExtra), sin una
    // estructura de estado por tramo que sincronizar.
    // =====================================================================

    data.enduranceTemplate = function (key) {
      for (var i = 0; i < data.ENDURANCE_OBJECTIVES.length; i++) {
        if (data.ENDURANCE_OBJECTIVES[i].key === key) return data.ENDURANCE_OBJECTIVES[i];
      }
      return null;
    };

    function stripRepIndex(nombre) { return nombre.replace(/\s*\d+$/, "").trim(); }

    // Estructura de SOLO LECTURA para la pantalla de sesión y para "Preparar
    // en mi reloj": agrupa repeticiones consecutivas idénticas (trabajo +
    // recuperación) en un único bloque "Repite N veces" en vez de listar cada
    // repetición por separado (nota 31). session.repeticionesExtra (añadidas
    // desde "Ajustar propuesta") se suman al primer grupo repetible.
    // Devuelve null si el objetivo es continuo (sin tramos).
    data.enduranceStructure = function (session) {
      var tmpl = data.enduranceTemplate(session.objetivo);
      if (!tmpl || !tmpl.segments) return null;
      var segments = tmpl.segments;
      var out = [];
      var extra = session.repeticionesExtra || 0;
      var extraApplied = false;
      var i = 0;
      while (i < segments.length) {
        var seg = segments[i], next = segments[i + 1];
        if (seg.tipo === "trabajo" && next && next.tipo === "recuperacion") {
          var count = 1, j = i + 2;
          while (segments[j] && segments[j + 1] &&
            segments[j].tipo === "trabajo" && segments[j].duracionTexto === seg.duracionTexto && segments[j].objetivoTexto === seg.objetivoTexto &&
            segments[j + 1].tipo === "recuperacion" && segments[j + 1].duracionTexto === next.duracionTexto && segments[j + 1].objetivoTexto === next.objetivoTexto) {
            count++; j += 2;
          }
          if (!extraApplied && extra) { count += extra; extraApplied = true; }
          out.push({
            tipo: "grupo", repeticiones: count,
            nombre: stripRepIndex(seg.nombre), duracionTexto: seg.duracionTexto, objetivoTexto: seg.objetivoTexto,
            recNombre: stripRepIndex(next.nombre), recDuracionTexto: next.duracionTexto, recObjetivoTexto: next.objetivoTexto
          });
          i = j;
        } else {
          out.push({ tipo: seg.tipo, nombre: seg.nombre, duracionTexto: seg.duracionTexto, objetivoTexto: seg.objetivoTexto });
          i++;
        }
      }
      return out;
    };

    // ponytail: comprobación mínima de la agrupación (no una suite). Llamar a
    // mano desde la consola con App.data.__enduranceStructureSelftest().
    data.__enduranceStructureSelftest = function () {
      var s1 = data.enduranceStructure({ objetivo: "intervalos", repeticionesExtra: 0 });
      var okBase = s1.length === 3 && s1[1].tipo === "grupo" && s1[1].repeticiones === 4;
      console.assert(okBase, "enduranceStructure: se esperaban 3 bloques con 4 repeticiones en 'intervalos'.");
      var s2 = data.enduranceStructure({ objetivo: "intervalos", repeticionesExtra: 2 });
      var okExtra = s2[1].repeticiones === 6;
      console.assert(okExtra, "enduranceStructure: repeticionesExtra debía sumarse al grupo.");
      var pass = okBase && okExtra;
      console.log(pass ? "data.__enduranceStructureSelftest(): OK." : "data.__enduranceStructureSelftest(): FALLO.");
      return pass;
    };

    // Entorno elegido para la sesión: editable desde "Ajustar propuesta"
    // (session.entorno); si no se ha tocado, un valor por defecto razonable
    // según el objetivo. Nunca se exige ni se valida contra un dispositivo.
    data.enduranceEnv = function (session) {
      if (session.entorno) return session.entorno;
      return session.objetivo === "bici" ? "Bici estática" : "Exterior";
    };

    // Transiciones de estado explícitas de resistencia (nota 31): la persona
    // las confirma con un botón, nunca ocurren solas al abrir la pantalla.
    data.markEnduranceScheduled = function (session) {
      data.setSessionState(session.id, "programada_reloj");
      session.sync = "local";
      return session;
    };
    data.markEnduranceAwaitingImport = function (session) {
      data.setSessionState(session.id, "realizada_pendiente_importar");
      session.sync = "local";
      return session;
    };
    data.markEnduranceNoResult = function (session) {
      data.setSessionState(session.id, "sin_resultado");
      session.sync = "local";
      return session;
    };

    // =====================================================================
    // LOTE 5: importación manual simulada (nota 07) y su influencia en el
    // contexto de carga (punto 24: influye visualmente, nunca reescribe el
    // plan por sí sola).
    // =====================================================================

    data.findImportFile = function (id) {
      for (var i = 0; i < data.IMPORT_FILES.length; i++) {
        if (data.IMPORT_FILES[i].id === id) return data.IMPORT_FILES[i];
      }
      return null;
    };

    // Si se asocia a una sesión de resistencia pendiente de resultado, esa
    // sesión pasa a "importada_asociada" o "asociada_adaptacion" (nota 31).
    // Criterio de adaptación, simple y explicable (sin umbral fijado por el
    // encargo, decisión de prototipo): la propuesta ya llegaba adaptada
    // (session.esAdaptada, por un "Ajustar propuesta" previo) o la duración
    // real difiere de la prevista en más de un 20%. La duración PREVISTA
    // nunca se sobrescribe con la real: se guarda aparte en
    // `duracionRealizada` para que la comparación siga siendo posible
    // después de guardar. Si no se asocia ninguna sesión, solo entra en el
    // historial como actividad suelta: el calendario no cambia (verificado
    // explícitamente: `linked` queda null y no se toca nada de SESSIONS).
    data.saveImportedActivity = function (file, edits) {
      edits = edits || {};
      var nombre = (edits.nombre || file.nombre).trim();
      var tipo = edits.tipo || (file.analisis && file.analisis.tipo) || "Actividad";
      var record = {
        id: "act-" + Date.now(),
        nombre: nombre, tipo: tipo,
        analisis: file.analisis,
        procedencia: "importado",
        sync: "local",
        sessionId: edits.sessionId || null
      };
      data.ACTIVITY_IMPORTS.push(record);

      var linked = edits.sessionId ? data.findSession(edits.sessionId) : null;
      var esAdaptacion = false;
      if (linked && linked.tipo === "resistencia") {
        var previsto = linked.duracionPrevista;
        var real = file.analisis && file.analisis.duracionMin;
        esAdaptacion = !!linked.esAdaptada || !!(previsto && real && Math.abs(real - previsto) / previsto > 0.2);
        linked.estado = esAdaptacion ? "asociada_adaptacion" : "importada_asociada";
        linked.procedencia = "importado";
        if (real != null) linked.duracionRealizada = real;
        linked.sync = "local";
      }

      var metaParts = ["Hoy"];
      if (file.analisis) {
        metaParts.push(file.analisis.duracionMin + " min");
        if (file.analisis.distanciaKm) metaParts.push(file.analisis.distanciaKm + " km");
      }
      data.HISTORY.unshift({
        id: "hist-" + Date.now(),
        tipo: "resistencia",
        fecha: "Hoy",
        semanasAtras: 0,
        nombre: nombre,
        meta: metaParts.join(" · "),
        estado: esAdaptacion ? "adaptada" : "completada",
        procedencia: "importado",
        sync: "local",
        detalle: file.analisis ? {
          duracionMin: file.analisis.duracionMin, distanciaKm: file.analisis.distanciaKm,
          ritmo: file.analisis.ritmo, fcMedia: file.analisis.fcMedia, cargaEstimada: file.analisis.cargaEstimada
        } : null,
        versions: []
      });
      return record;
    };

    // Mensaje explicable de contexto de carga: NUNCA cambia el calendario ni
    // el plan por sí solo (punto 24). Solo se muestra como información.
    data.loadContext = function () {
      var recentImport = data.ACTIVITY_IMPORTS[data.ACTIVITY_IMPORTS.length - 1];
      if (recentImport && recentImport.analisis &&
        (recentImport.analisis.cargaEstimada === "alta" || recentImport.analisis.cargaEstimada === "media")) {
        return "Tu última actividad importada (" + recentImport.nombre + ") tuvo una carga estimada " +
          recentImport.analisis.cargaEstimada + ". Puede influir en cómo llegas a tu próxima sesión; " +
          "no hemos cambiado tu plan por esto.";
      }
      var recentIntense = data.HISTORY.filter(function (h) {
        return (h.estado === "completada" || h.estado === "adaptada") && /intervalos|larga|sprint/i.test(h.nombre);
      })[0];
      if (recentIntense) {
        return "Tu sesión reciente (" + recentIntense.nombre + ") fue exigente. Puede influir en cómo llegas a tu próxima sesión; no hemos cambiado tu plan por esto.";
      }
      return null;
    };

    // ---- prioridad-hibrida-006: resumen de bienestar general (nunca
    // diagnóstico) a partir de HISTORY, con solo tres estados posibles.
    // Reutilizable desde recovery.js y como frase de home.js. Basado en lo
    // que ya hay registrado, nunca en algo inferido más allá del dato.
    data.readinessSummary = function () {
      var recent = data.HISTORY.filter(function (h) { return (h.semanasAtras || 0) === 0; });
      var recentStruggle = recent.filter(function (h) { return h.estado === "parcial" || h.estado === "omitida"; });
      var recentIntense = recent.filter(function (h) {
        return (h.estado === "completada" || h.estado === "adaptada") && /intervalos|larga|sprint|legs/i.test(h.nombre);
      });
      if (recentStruggle.length) {
        return { estado: "recuperacion", texto: "Recuperación recomendada: tu registro más reciente (" + recentStruggle[0].nombre + ") quedó " + recentStruggle[0].estado + ". Señal de bienestar general, no un diagnóstico." };
      }
      if (recentIntense.length >= 2) {
        return { estado: "carga", texto: "Carga acumulada: has encadenado varias sesiones exigentes esta semana. Nada clínico, solo para que dosifiques si te apetece." };
      }
      return { estado: "fresco", texto: "Fresco: tu carga reciente ha sido moderada." };
    };

    // =====================================================================
    // LOTE 6: historial/filtros/versionado, adherencia y logros, métricas
    // personales, compartir/copia independiente y plataforma (PWA/estados
    // de demo). Notas 09, 25, 27, 10, 24, 11, 29.
    // =====================================================================

    data.findHistoryEntry = function (id) {
      for (var i = 0; i < data.HISTORY.length; i++) {
        if (data.HISTORY[i].id === id) return data.HISTORY[i];
      }
      return null;
    };

    // Filtro combinado de historial (nota 09). periodo: "" | "semana" | "4sem".
    // tipo: "" | fuerza | resistencia | recuperacion. estado: "" | completada
    // | adaptada | parcial | omitida.
    data.filterHistory = function (filters) {
      filters = filters || {};
      return data.HISTORY.filter(function (h) {
        var semanas = h.semanasAtras || 0;
        if (filters.periodo === "semana" && semanas > 0) return false;
        if (filters.periodo === "4sem" && semanas > 4) return false;
        if (filters.tipo && h.tipo !== filters.tipo) return false;
        if (filters.estado && h.estado !== filters.estado) return false;
        return true;
      });
    };

    // Corrección versionada (nota 09): el registro original NUNCA se
    // reescribe sin dejar rastro. Se guarda una copia del estado ANTERIOR
    // dentro de `versions` (con su motivo) y el registro pasa a reflejar el
    // valor vigente. `versions` queda siempre consultable desde el detalle.
    data.correctHistoryEntry = function (id, changes, motivo) {
      var entry = data.findHistoryEntry(id);
      if (!entry) return null;
      var snapshot = { nombre: entry.nombre, meta: entry.meta, detalle: entry.detalle, motivo: motivo || "Sin motivo indicado", corregidoEl: "Hoy" };
      entry.versions = entry.versions || [];
      entry.versions.unshift(snapshot);
      if (changes.nombre) entry.nombre = changes.nombre;
      if (changes.meta) entry.meta = changes.meta;
      if (changes.detalle) entry.detalle = changes.detalle;
      entry.sync = "local";
      return entry;
    };

    // Adherencia (nota 25): completada, adaptada y recuperación válida SUMAN;
    // parcial y omitida se conservan en el historial sin sumar hito. Como
    // toda recuperación registrada ya se guarda con estado completada/
    // adaptada (ver completeRecovery), basta con sumar por estado.
    data.adherenceSummary = function () {
      var out = { completadas: 0, adaptadas: 0, recuperacionValida: 0, parciales: 0, omitidas: 0, totalAdherencia: 0 };
      data.HISTORY.forEach(function (h) {
        if (h.estado === "completada") {
          out.completadas++;
          if (h.tipo === "recuperacion") out.recuperacionValida++;
        } else if (h.estado === "adaptada") {
          out.adaptadas++;
          if (h.tipo === "recuperacion") out.recuperacionValida++;
        } else if (h.estado === "parcial") {
          out.parciales++;
        } else if (h.estado === "omitida") {
          out.omitidas++;
        }
      });
      out.totalAdherencia = out.completadas + out.adaptadas;
      return out;
    };

    // Un logro alcanzado y uno cercano (nota 25): privados, discretos, nunca
    // basados solo en calorías o peso, sin comparación con otras personas.
    data.pickAchievements = function () {
      var alcanzado = null, cercano = null;
      data.ACHIEVEMENTS.forEach(function (a) {
        if (a.alcanzado && !alcanzado) alcanzado = a;
        if (!a.alcanzado && !cercano) cercano = a;
      });
      return { alcanzado: alcanzado, cercano: cercano };
    };

    // ---- Métricas personales opcionales (nota 27) --------------------------
    data.findMetric = function (id) {
      for (var i = 0; i < data.BODY_METRICS.length; i++) {
        if (data.BODY_METRICS[i].id === id) return data.BODY_METRICS[i];
      }
      return null;
    };

    data.addMetric = function (payload) {
      var entry = {
        id: "metric-" + Date.now(),
        tipo: payload.tipo, valor: payload.valor, unidad: payload.unidad,
        zona: payload.zona || null, fecha: payload.fecha,
        procedencia: "local", sync: "local", versions: []
      };
      data.BODY_METRICS.push(entry);
      return entry;
    };

    // Corrección versionada: el valor anterior queda en `versions`, nunca se
    // borra silenciosamente (mismo criterio que el historial de sesiones).
    data.correctMetric = function (id, changes, motivo) {
      var entry = data.findMetric(id);
      if (!entry) return null;
      entry.versions = entry.versions || [];
      entry.versions.unshift({ valor: entry.valor, unidad: entry.unidad, fecha: entry.fecha, motivo: motivo || "Sin motivo indicado" });
      if (changes.valor !== undefined) entry.valor = changes.valor;
      if (changes.unidad) entry.unidad = changes.unidad;
      if (changes.fecha) entry.fecha = changes.fecha;
      entry.sync = "local";
      return entry;
    };

    // Tendencia simple y privada (nota 27): nunca un objetivo competitivo,
    // solo diferencia entre el primer y el último registro de ese tipo.
    data.metricTrend = function (tipo) {
      var list = data.BODY_METRICS.filter(function (m) { return m.tipo === tipo; })
        .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
      if (list.length < 2) return null;
      var first = list[0], last = list[list.length - 1];
      var diff = Math.round((last.valor - first.valor) * 100) / 100;
      var signo = diff > 0 ? "+" : "";
      return {
        texto: signo + diff + " " + last.unidad + " desde tu primer registro (" + first.fecha + " → " + last.fecha + "). " +
          "Tendencia informativa y privada, no un objetivo.",
        diff: diff
      };
    };

    // ---- Compartir rutina y copia independiente (nota 10) ------------------
    data.findShareLink = function (id) {
      for (var i = 0; i < data.SHARED_ROUTINES.length; i++) {
        if (data.SHARED_ROUTINES[i].id === id) return data.SHARED_ROUTINES[i];
      }
      return null;
    };

    data.generateShareLink = function (scope) {
      var code = Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      var link = {
        id: "share-" + Date.now(),
        planNombre: data.plan.nombre,
        scope: { estructura: !!scope.estructura, notas: !!scope.notas, ejercicios: !!scope.ejercicios },
        estado: "activo",
        enlace: "trainer-demo://compartir/" + code,
        creadoEl: "Hoy"
      };
      data.SHARED_ROUTINES.unshift(link);
      return link;
    };

    data.revokeShareLink = function (id) {
      var link = data.findShareLink(id);
      if (!link) return null;
      link.estado = "revocado"; // Impide NUEVAS copias; las ya creadas siguen existiendo (nota 10).
      return link;
    };

    // La copia nace de una FOTO independiente del original (deep clone del
    // snapshot simulado, no una referencia): a partir de aquí, adaptar la
    // copia o el original nunca se propaga al otro lado.
    data.createRoutineCopy = function (shareId) {
      var link = data.findShareLink(shareId);
      if (!link || link.estado !== "activo") return null;
      var copy = {
        id: "copy-" + Date.now(),
        fromShareId: shareId,
        nombre: link.planNombre + " (copia)",
        creadaEl: "Hoy",
        calendario: JSON.parse(JSON.stringify(data.SHARE_ORIGINAL.calendario)),
        cargas: JSON.parse(JSON.stringify(data.SHARE_ORIGINAL.cargas)),
        historialCount: 1
      };
      data.ROUTINE_COPIES.unshift(copy);
      return copy;
    };

    data.findRoutineCopy = function (id) {
      for (var i = 0; i < data.ROUTINE_COPIES.length; i++) {
        if (data.ROUTINE_COPIES[i].id === id) return data.ROUTINE_COPIES[i];
      }
      return null;
    };

    // Adapta SOLO la copia (nota 10: cambios futuros del propietario no
    // afectan a la copia, y viceversa). ejercicio identifica la clave dentro
    // de copy.cargas.
    data.adaptCopyLoad = function (copyId, ejercicio, nuevaCarga) {
      var copy = data.findRoutineCopy(copyId);
      if (!copy) return null;
      copy.cargas[ejercicio] = nuevaCarga;
      copy.historialCount = (copy.historialCount || 0) + 1;
      return copy;
    };

    // Adapta SOLO el original simulado (independiente de cualquier copia ya
    // creada).
    data.adaptOriginalLoad = function (ejercicio, nuevaCarga) {
      data.SHARE_ORIGINAL.cargas[ejercicio] = nuevaCarga;
      return data.SHARE_ORIGINAL;
    };

    return data;
  }

  App.dataDefaults = function () {
    var data = {
      user: {
        email: "",
        nombre: "",
        objetivo: "Ganar músculo",
        experiencia: "Intermedia",
        diasDisponibles: null,
        duracionHabitual: null,
        entorno: null,
        // ---- prioridad-hibrida-006: deporte principal/combinación elegido en
        // el onboarding nuevo (ver DEPORTES) y entornos habituales en
        // multi-selección (ver ENTORNOS_ONBOARDING). `entorno` (singular) se
        // conserva para no romper el creador guiado / Perfil existentes.
        deporte: null,
        entornos: [],
        unidades: "kg",
        consentimiento: { aceptado: false, fecha: null },
        // ---- LOTE 6: contraseña simulada (nota 24) para poder validar el
        // cambio de contraseña en Perfil; no está ligada al acceso real de
        // access.js (que usa una constante fija), esto es una demo aparte.
        password: "demo1234",
        deletionRequested: null
      },

      auth: { estado: "anonimo", primerUso: true },

      // Día "hoy" fijo del prototipo (no la fecha real). ponytail: constante de
      // demo, no un reloj; si hiciera falta un calendario real habría que
      // sustituir esto por Date().
      hoy: "mie",

      plan: {
        id: "plan-1",
        nombre: "Bloque de hipertrofia",
        estado: "activo",
        semanaActual: 3,
        semanasTotales: 8,
        constanciaSemanas: 4,
        fases: [
          { nombre: "Adaptación", proposito: "Aprender la técnica y preparar tejidos con cargas moderadas.", semanas: "Semanas 1-2", span: 2, estado: "completada" },
          { nombre: "Progresión · hipertrofia", proposito: "Subir el estímulo poco a poco para ganar músculo.", semanas: "Semanas 3-6", span: 4, estado: "actual" },
          { nombre: "Descarga", proposito: "Bajar el volumen para recuperar antes de seguir subiendo.", semanas: "Semana 7", span: 1, estado: "pendiente" },
          { nombre: "Mantenimiento", proposito: "Sostener lo ganado con el mínimo esfuerzo necesario.", semanas: "Semana 8", span: 1, estado: "pendiente" }
        ]
      },

      // ---- LOTE 2: gestión de planes (nota 22) --------------------------
      // data.plan ES el mismo objeto que la entrada "activo" de PLANS: no hay
      // dos copias que sincronizar. Duplicar clona en JSON aparte.
      PLANS: [],

      // ---- prioridad-hibrida-006: fuente única de deporte/entorno, reusada
      // por access.js (onboarding) y plan-builder.js (creador guiado), en vez
      // de duplicar estas listas en cada vista.
      DEPORTES: ["Fuerza", "Fuerza + correr", "Fuerza + bici", "Trail", "Senderismo"],

      // Cada deporte mapea a los mismos parámetros que ya entiende
      // generatePlanWeek (cardioActividad/cardioFrecuencia/plantilla). Trail y
      // senderismo llevan más días de resistencia por defecto para que la
      // propuesta no se vea como un PPL disfrazado (nota del contrato).
      DEPORTE_CARDIO_MAP: {
        "Fuerza": { cardioActividad: "Ninguna", cardioFrecuencia: "0", plantilla: "ppl" },
        "Fuerza + correr": { cardioActividad: "Correr", cardioFrecuencia: "2", plantilla: "hibrido" },
        "Fuerza + bici": { cardioActividad: "Bici", cardioFrecuencia: "2", plantilla: "hibrido" },
        "Trail": { cardioActividad: "Trail", cardioFrecuencia: "3", plantilla: "hibrido" },
        "Senderismo": { cardioActividad: "Senderismo", cardioFrecuencia: "2", plantilla: "hibrido" }
      },

      CARDIO_ACTIVIDADES: ["Ninguna", "Correr", "Bici", "Andar", "Trail", "Senderismo"],

      // Seis entornos habituales (multi-selección en el onboarding, selección
      // única en el paso de entorno del creador guiado).
      ENTORNOS_ONBOARDING: ["Gimnasio", "Casa", "Parque", "Cinta", "Exterior", "Viaje"],

      PLAN_TEMPLATES: {
        ppl: {
          nombre: "Push Pull Legs",
          pattern: ["Push", "Pull", "Legs"],
          proposito: {
            "Push": "Empuje: pecho, hombro y tríceps.",
            "Pull": "Tracción: espalda y bíceps.",
            "Legs": "Piernas y core: la sesión más exigente de la semana."
          }
        },
        fullbody: {
          nombre: "Full body",
          pattern: ["Full body A", "Full body B", "Full body C"],
          proposito: {
            "Full body A": "Cuerpo completo con énfasis en tren inferior.",
            "Full body B": "Cuerpo completo con énfasis en tren superior.",
            "Full body C": "Cuerpo completo con énfasis en core y accesorios."
          }
        },
        hibrido: {
          nombre: "Híbrido fuerza + resistencia",
          pattern: ["Push", "Pull", "Legs"],
          proposito: {
            "Push": "Empuje: pecho, hombro y tríceps.",
            "Pull": "Tracción: espalda y bíceps.",
            "Legs": "Piernas y core, combinada con tu resistencia semanal."
          }
        }
      },

      PHASE_TEMPLATE: [
        { nombre: "Adaptación", proposito: "Aprender la técnica y preparar tejidos con cargas moderadas.", semanas: 2 },
        { nombre: "Progresión", proposito: "Subir el estímulo poco a poco para ganar fuerza o músculo.", semanas: 4 },
        { nombre: "Descarga", proposito: "Bajar el volumen para recuperar antes de seguir subiendo.", semanas: 1 },
        { nombre: "Mantenimiento", proposito: "Sostener lo ganado con el mínimo esfuerzo necesario.", semanas: 1 }
      ],

      SKIP_REASONS: ["Falta de tiempo", "Cansancio", "Molestia o dolor", "Imprevisto", "Sin ganas hoy"],

      DAYS: [
        { key: "lun", nombre: "Lunes", abrev: "Lun" },
        { key: "mar", nombre: "Martes", abrev: "Mar" },
        { key: "mie", nombre: "Miércoles", abrev: "Mié" },
        { key: "jue", nombre: "Jueves", abrev: "Jue" },
        { key: "vie", nombre: "Viernes", abrev: "Vie" },
        { key: "sab", nombre: "Sábado", abrev: "Sáb" },
        { key: "dom", nombre: "Domingo", abrev: "Dom" }
      ],

      SESSIONS: [
        {
          id: "push", tipo: "fuerza", nombre: "Push", day: "lun",
          estado: "completada", duracionPrevista: 50, movedFrom: null, procedencia: "local",
          sync: "sincronizado", motivoOmision: null, esAdaptada: false
        },
        {
          id: "run-easy", tipo: "resistencia", nombre: "Carrera suave", day: "mar",
          estado: "completada", duracionPrevista: 30, movedFrom: null, procedencia: "importado",
          sync: "sincronizado", motivoOmision: null, objetivo: "continua-suave"
        },
        {
          id: "pull", tipo: "fuerza", nombre: "Pull", day: "mie",
          estado: "planificada", duracionPrevista: 48, movedFrom: null, procedencia: "local",
          sync: "sincronizado", motivoOmision: null, esAdaptada: false
        },
        // ---- LOTE 5: nueva sesión de intervalos, junto a Legs (adyacente
        // jue-vie) para poder demostrar el ajuste explicable por choque de
        // carga (nota 06) con datos reales del calendario. -------------------
        {
          id: "resistencia-intervalos", tipo: "resistencia", nombre: "Intervalos", day: "jue",
          estado: "planificada", duracionPrevista: 33, movedFrom: null, procedencia: "local", intense: true,
          sync: "local", motivoOmision: null, objetivo: "intervalos"
        },
        {
          id: "legs", tipo: "fuerza", nombre: "Legs", day: "vie",
          estado: "planificada", duracionPrevista: 55, movedFrom: null, procedencia: "local", intense: true,
          sync: "sincronizado", motivoOmision: null, esAdaptada: false
        },
        {
          id: "run-long", tipo: "resistencia", nombre: "Carrera larga", day: "dom",
          estado: "planificada", duracionPrevista: 75, movedFrom: null, procedencia: "local", intense: true,
          sync: "sincronizado", motivoOmision: null, objetivo: "fondo-tirada-larga"
        }
      ],

      // ---- LOTE 6: historial ampliado a varias semanas, con tipo, fecha,
      // procedencia, sincronización y detalle por tipo (nota 09). semanasAtras
      // es la clave numérica que usan los filtros de periodo. El registro
      // "hist-legs-s1" trae ya una versión previa para poder mostrar la
      // corrección versionada sin depender de que la persona corrija algo
      // primero durante la demo.
      HISTORY: [
        {
          id: "hist-push-s0", tipo: "fuerza", fecha: "Lunes", semanasAtras: 0,
          nombre: "Push", meta: "Lunes · 52 min · 4 de 4 ejercicios", estado: "completada",
          procedencia: "local", sync: "sincronizado",
          detalle: { ejercicios: [
            { nombre: "Press banca", carga: 60, reps: 8, series: 3, volumen: 1440 },
            { nombre: "Press militar", carga: 16, reps: 8, series: 3, volumen: 384 }
          ] },
          versions: []
        },
        {
          id: "hist-run-easy-s0", tipo: "resistencia", fecha: "Martes", semanasAtras: 0,
          nombre: "Carrera suave", meta: "Martes · 30 min", estado: "completada",
          procedencia: "importado", sync: "sincronizado",
          detalle: { duracionMin: 30, distanciaKm: 4.8, ritmo: "6:15 min/km", fcMedia: 138, cargaEstimada: "baja" },
          versions: []
        },
        {
          id: "hist-pull-s1", tipo: "fuerza", fecha: "Semana pasada", semanasAtras: 1,
          nombre: "Pull", meta: "Semana pasada · 48 min · 5 de 5 ejercicios", estado: "completada",
          procedencia: "local", sync: "sincronizado",
          detalle: { ejercicios: [
            { nombre: "Jalón al pecho", carga: 52.5, reps: 11, series: 3, volumen: 1732.5 },
            { nombre: "Remo sentado", carga: 45, reps: 12, series: 3, volumen: 1575 }
          ] },
          versions: []
        },
        {
          id: "hist-legs-s1", tipo: "fuerza", fecha: "Semana pasada", semanasAtras: 1,
          nombre: "Legs", meta: "Semana pasada · adaptada por fatiga · 45 min", estado: "adaptada",
          procedencia: "adaptado", sync: "sincronizado",
          detalle: { ejercicios: [
            { nombre: "Sentadilla", carga: 65, reps: 8, series: 2, volumen: 1040 },
            { nombre: "Prensa", carga: 130, reps: 10, series: 3, volumen: 3900 }
          ] },
          versions: [
            { nombre: "Legs", meta: "Semana pasada · adaptada por fatiga · 40 min", detalle: { ejercicios: [
              { nombre: "Sentadilla", carga: 60, reps: 8, series: 2, volumen: 960 }
            ] }, motivo: "Se me olvidó anotar la prensa al cerrar la sesión.", corregidoEl: "Hace 4 días" }
          ]
        },
        {
          id: "hist-recovery-s1", tipo: "recuperacion", fecha: "Semana pasada", semanasAtras: 1,
          nombre: "Movilidad suave", meta: "Semana pasada · 12 min · registrado sin penalización", estado: "completada",
          procedencia: "adaptado", sync: "sincronizado", detalle: { minutos: 12 }, versions: []
        },
        {
          id: "hist-push-s2", tipo: "fuerza", fecha: "Hace 2 semanas", semanasAtras: 2,
          nombre: "Push", meta: "Hace 2 semanas · parcial, 2 de 4 ejercicios", estado: "parcial",
          procedencia: "local", sync: "sincronizado",
          detalle: { ejercicios: [
            { nombre: "Press banca", carga: 57.5, reps: 8, series: 3, volumen: 1380 }
          ] },
          versions: []
        },
        {
          id: "hist-runlong-s2", tipo: "resistencia", fecha: "Hace 2 semanas", semanasAtras: 2,
          nombre: "Carrera larga", meta: "Hace 2 semanas · omitida y recolocada", estado: "omitida",
          procedencia: "local", sync: "sincronizado", detalle: null, versions: []
        },
        {
          id: "hist-pull-s2", tipo: "fuerza", fecha: "Hace 2 semanas", semanasAtras: 2,
          nombre: "Pull", meta: "Hace 2 semanas · 46 min · 5 de 5 ejercicios", estado: "completada",
          procedencia: "local", sync: "sincronizado",
          detalle: { ejercicios: [
            { nombre: "Jalón al pecho", carga: 50, reps: 12, series: 3, volumen: 1800 }
          ] },
          versions: []
        },
        {
          id: "hist-intervalos-s3", tipo: "resistencia", fecha: "Hace 3 semanas", semanasAtras: 3,
          nombre: "Intervalos", meta: "Hace 3 semanas · 28 min", estado: "parcial",
          procedencia: "local", sync: "sincronizado",
          detalle: { duracionMin: 28, distanciaKm: 4.1, ritmo: "5:50 min/km", fcMedia: 161, cargaEstimada: "alta" },
          versions: []
        },
        {
          id: "hist-legs-s3", tipo: "fuerza", fecha: "Hace 3 semanas", semanasAtras: 3,
          nombre: "Legs", meta: "Hace 3 semanas · 53 min · 4 de 4 ejercicios", estado: "completada",
          procedencia: "local", sync: "sincronizado",
          detalle: { ejercicios: [
            { nombre: "Sentadilla", carga: 62.5, reps: 9, series: 3, volumen: 1687.5 }
          ] },
          versions: []
        },
        {
          id: "hist-recovery-s4", tipo: "recuperacion", fecha: "Hace 4 semanas", semanasAtras: 4,
          nombre: "Cardio suave", meta: "Hace 4 semanas · 18 min · esfuerzo bajo", estado: "adaptada",
          procedencia: "adaptado", sync: "sincronizado", detalle: { minutos: 18 }, versions: []
        }
      ],

      ADHERENCE: [true, true, false, true, true, false],

      ACHIEVEMENTS: [
        { id: "racha3", titulo: "A una sesión de tu racha de 3 semanas seguidas", tipo: "cercano", alcanzado: false },
        { id: "primeraSemana", titulo: "Completaste tu primera semana completa", tipo: "alcanzado", alcanzado: true }
      ],

      // ---- Datos de fuerza migrados del app.js anterior (para lotes 3 y 4) ----
      EXERCISES: [
        {
          id: "jalon", nombre: "Jalón al pecho", variante: "Polea (agarre ancho)",
          // Enlace explícito al catálogo (nota Opus, catalogo-visual-ejercicios-004):
          // los IDs de sesión y de catálogo no coinciden hoy ("jalon" vs.
          // "jalon-polea"). Este es el único ejercicio de sesión con una
          // contraparte de catálogo clara; el resto sigue sin catalogId y usa
          // su propio id de sesión para buscar ilustración (mostrará
          // "Ilustración próximamente" si no está en el manifest).
          catalogId: "jalon-polea",
          patron: "Tracción vertical", icon: "pull",
          objetivo: "3 × 10-12 reps", ultimoTexto: "52.5 kg × 11 reps",
          restSeconds: 90, difficulty: null, included: true, omitido: false,
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
          restSeconds: 90, difficulty: null, included: true, omitido: false,
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
          restSeconds: 60, difficulty: null, included: true, omitido: false,
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
          restSeconds: 75, difficulty: null, included: true, omitido: false,
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
          restSeconds: 60, difficulty: null, included: true, omitido: false,
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
      ],

      // ---- LOTE 3: ejercicios interactivos de Push y Legs (nota 05) ----------
      // Mismo esquema exacto que EXERCISES (Pull) para que strength.js trate
      // cualquier sesión de fuerza de forma uniforme.
      PUSH_EXERCISES: [
        {
          id: "press-banca", nombre: "Press banca", variante: "Barra libre",
          patron: "Empuje horizontal", icon: "press",
          objetivo: "3 × 8-10 reps", ultimoTexto: "60 kg × 9 reps",
          restSeconds: 100, difficulty: null, included: true, omitido: false,
          sets: [
            { peso: 60, reps: 9, estado: "pendiente" },
            { peso: 60, reps: 8, estado: "pendiente" },
            { peso: 55, reps: 10, estado: "pendiente" }
          ],
          variantes: {
            favoritas: [{ nombre: "Barra libre", meta: "Tu variante habitual · 60 kg × 9" }],
            recientes: [{ nombre: "Press banca con mancuernas", meta: "Hace 3 semanas · 22 kg × 10" }],
            mismoPatron: [{ nombre: "Press inclinado (máquina)", meta: "Mismo patrón: empuje horizontal" }],
            catalogo: [{ nombre: "Press en máquina Smith", meta: "Catálogo general" }]
          },
          guide: {
            cues: [
              "Escápulas retraídas y apoyadas en el banco.",
              "Baja la barra de forma controlada hasta el pecho.",
              "Empuja en línea recta sin bloquear el codo de golpe.",
              "Pies firmes en el suelo durante todo el movimiento."
            ],
            muscles: ["Pectoral", "Tríceps", "Deltoide anterior"]
          },
          video: "https://www.youtube.com/results?search_query=press+banca+tecnica"
        },
        {
          id: "press-militar", nombre: "Press militar", variante: "Mancuernas",
          patron: "Empuje vertical", icon: "shoulderpress",
          objetivo: "3 × 8-10 reps", ultimoTexto: "16 kg × 9 reps",
          restSeconds: 90, difficulty: null, included: true, omitido: false,
          sets: [
            { peso: 16, reps: 9, estado: "pendiente" },
            { peso: 16, reps: 8, estado: "pendiente" },
            { peso: 14, reps: 10, estado: "pendiente" }
          ],
          variantes: {
            favoritas: [], recientes: [],
            mismoPatron: [{ nombre: "Press militar con barra", meta: "Mismo patrón: empuje vertical" }],
            catalogo: [{ nombre: "Press en máquina de hombro", meta: "Catálogo general" }]
          },
          guide: {
            cues: ["Core firme, sin arquear la zona lumbar.", "Empuja hacia arriba sin balancear el torso.", "Baja controlando hasta la altura del hombro."],
            muscles: ["Deltoide", "Tríceps", "Trapecio superior"]
          },
          video: "https://www.youtube.com/results?search_query=press+militar+tecnica"
        },
        {
          id: "fondos", nombre: "Fondos en máquina", variante: "Máquina asistida",
          patron: "Empuje horizontal/tríceps", icon: "dip",
          objetivo: "3 × 10-12 reps", ultimoTexto: "Asistencia 20 kg × 11 reps",
          restSeconds: 75, difficulty: null, included: true, omitido: false,
          sets: [
            { peso: 20, reps: 11, estado: "pendiente" },
            { peso: 20, reps: 10, estado: "pendiente" },
            { peso: 25, reps: 12, estado: "pendiente" }
          ],
          variantes: {
            favoritas: [], recientes: [],
            mismoPatron: [{ nombre: "Fondos en paralelas", meta: "Mismo patrón: empuje horizontal/tríceps" }],
            catalogo: [{ nombre: "Extensión de tríceps en polea", meta: "Catálogo general" }]
          },
          guide: {
            cues: ["Torso ligeramente inclinado adelante.", "Baja hasta sentir estiramiento sin forzar el hombro.", "Empuja sin bloquear el codo con violencia."],
            muscles: ["Tríceps", "Pectoral inferior", "Deltoide anterior"]
          },
          video: "https://www.youtube.com/results?search_query=fondos+en+maquina+tecnica"
        },
        {
          id: "elevaciones-laterales", nombre: "Elevaciones laterales", variante: "Mancuernas",
          patron: "Abducción de hombro", icon: "lateral",
          objetivo: "3 × 12-15 reps", ultimoTexto: "8 kg × 14 reps",
          restSeconds: 60, difficulty: null, included: true, omitido: false,
          sets: [
            { peso: 8, reps: 14, estado: "pendiente" },
            { peso: 8, reps: 13, estado: "pendiente" },
            { peso: 7, reps: 15, estado: "pendiente" }
          ],
          variantes: {
            favoritas: [], recientes: [],
            mismoPatron: [{ nombre: "Elevaciones en polea", meta: "Mismo patrón: abducción de hombro" }],
            catalogo: [{ nombre: "Elevaciones en máquina", meta: "Catálogo general" }]
          },
          guide: {
            cues: ["Codos con ligera flexión fija.", "Sube hasta la altura del hombro, sin impulso.", "Baja controlando, sin dejar caer el peso."],
            muscles: ["Deltoide medio"]
          },
          video: "https://www.youtube.com/results?search_query=elevaciones+laterales+tecnica"
        }
      ],

      LEGS_EXERCISES: [
        {
          id: "sentadilla", nombre: "Sentadilla", variante: "Barra libre",
          patron: "Dominante de rodilla", icon: "squat",
          objetivo: "3 × 8-10 reps", ultimoTexto: "70 kg × 9 reps",
          restSeconds: 120, difficulty: null, included: true, omitido: false,
          sets: [
            { peso: 70, reps: 9, estado: "pendiente" },
            { peso: 70, reps: 8, estado: "pendiente" },
            { peso: 65, reps: 10, estado: "pendiente" }
          ],
          variantes: {
            favoritas: [{ nombre: "Barra libre", meta: "Tu variante habitual · 70 kg × 9" }],
            recientes: [], mismoPatron: [{ nombre: "Sentadilla en Smith", meta: "Mismo patrón: dominante de rodilla" }],
            catalogo: [{ nombre: "Sentadilla goblet", meta: "Catálogo general" }]
          },
          guide: {
            cues: ["Pecho alto, mirada al frente.", "Rodillas siguen la dirección de los pies.", "Baja hasta donde la técnica se mantenga sólida."],
            muscles: ["Cuádriceps", "Glúteo", "Core"]
          },
          video: "https://www.youtube.com/results?search_query=sentadilla+tecnica"
        },
        {
          id: "prensa", nombre: "Prensa", variante: "Máquina 45°",
          patron: "Dominante de rodilla", icon: "legpress",
          objetivo: "3 × 10-12 reps", ultimoTexto: "140 kg × 11 reps",
          restSeconds: 100, difficulty: null, included: true, omitido: false,
          sets: [
            { peso: 140, reps: 11, estado: "pendiente" },
            { peso: 140, reps: 10, estado: "pendiente" },
            { peso: 130, reps: 12, estado: "pendiente" }
          ],
          variantes: {
            favoritas: [], recientes: [],
            mismoPatron: [{ nombre: "Prensa horizontal", meta: "Mismo patrón: dominante de rodilla" }],
            catalogo: [{ nombre: "Sentadilla hack", meta: "Catálogo general" }]
          },
          guide: {
            cues: ["Zona lumbar apoyada en el respaldo.", "No bloquees la rodilla al extender.", "Recorrido controlado en ambas fases."],
            muscles: ["Cuádriceps", "Glúteo"]
          },
          video: "https://www.youtube.com/results?search_query=prensa+de+piernas+tecnica"
        },
        {
          id: "curl-femoral", nombre: "Curl femoral", variante: "Máquina tumbado",
          patron: "Dominante de cadera", icon: "hamcurl",
          objetivo: "3 × 12-15 reps", ultimoTexto: "35 kg × 13 reps",
          restSeconds: 75, difficulty: null, included: true, omitido: false,
          sets: [
            { peso: 35, reps: 13, estado: "pendiente" },
            { peso: 35, reps: 12, estado: "pendiente" },
            { peso: 30, reps: 15, estado: "pendiente" }
          ],
          variantes: {
            favoritas: [], recientes: [],
            mismoPatron: [{ nombre: "Curl femoral sentado", meta: "Mismo patrón: dominante de cadera" }],
            catalogo: [{ nombre: "Peso muerto rumano", meta: "Catálogo general" }]
          },
          guide: {
            cues: ["Cadera apoyada y estable.", "Flexiona sin despegar la cadera del banco.", "Baja controlando, sin soltar el peso."],
            muscles: ["Isquiotibiales"]
          },
          video: "https://www.youtube.com/results?search_query=curl+femoral+tecnica"
        },
        {
          id: "gemelo", nombre: "Elevación de gemelo", variante: "Máquina de pie",
          patron: "Flexión plantar", icon: "calf",
          objetivo: "3 × 15 reps", ultimoTexto: "50 kg × 15 reps",
          restSeconds: 60, difficulty: null, included: true, omitido: false,
          sets: [
            { peso: 50, reps: 15, estado: "pendiente" },
            { peso: 50, reps: 15, estado: "pendiente" },
            { peso: 45, reps: 15, estado: "pendiente" }
          ],
          variantes: {
            favoritas: [], recientes: [],
            mismoPatron: [{ nombre: "Elevación de gemelo sentado", meta: "Mismo patrón: flexión plantar" }],
            catalogo: [{ nombre: "Elevación de gemelo en prensa", meta: "Catálogo general" }]
          },
          guide: {
            cues: ["Recorrido completo, arriba y abajo.", "Pausa breve en la posición alta.", "Sin rebotar en la parte baja."],
            muscles: ["Gemelo", "Sóleo"]
          },
          video: "https://www.youtube.com/results?search_query=elevacion+de+gemelo+tecnica"
        }
      ],

      // ---- LOTE 3: catálogo breve para "Añadir ejercicio" (punto de entrada;
      // el catálogo completo llega en el lote 4) --------------------------
      CATALOG_QUICK_ADD: [
        { nombre: "Remo en punta T", patron: "Tracción horizontal", objetivo: "3 × 10-12 reps" },
        { nombre: "Extensión de tríceps en polea", patron: "Extensión de codo", objetivo: "3 × 12-15 reps" },
        { nombre: "Aductor en máquina", patron: "Aducción de cadera", objetivo: "3 × 12-15 reps" },
        { nombre: "Abdominales en polea alta", patron: "Flexión de tronco", objetivo: "3 × 15 reps" }
      ],

      // ---- LOTE 3: molestias declaradas por la persona (nota 16) -------------
      // El sistema nunca infiere zona ni intensidad: siempre las declara la
      // persona. Estados: nuevo · activo_reutilizable · editado_hoy · cerrado.
      DISCOMFORTS: [
        {
          id: "disc-1", zona: "hombro", lado: "derecho", zonaTexto: "Hombro der.",
          intensidad: "leve", tipo: "rigidez", estado: "activo_reutilizable"
        }
      ],

      // ---- LOTE 3: zonas del mapa corporal, frontal y trasera (nota 16) ------
      // Geometría heredada del prototipo anterior (ya verificada en accesibilidad
      // y sin solape). % relativos al contenedor .bodymap, ancla centrada.
      BODY_ZONES: {
        frontal: [
          { zona: "cabeza-cuello", lado: "none", texto: "Cabeza / cuello", top: "8%", left: "44%" },
          { zona: "hombro", lado: "izquierdo", texto: "Hombro izq.", top: "20%", left: "14%" },
          { zona: "hombro", lado: "derecho", texto: "Hombro der.", top: "20%", left: "74%" },
          { zona: "pecho-torso", lado: "none", texto: "Pecho / torso", top: "32%", left: "44%" },
          { zona: "brazo", lado: "izquierdo", texto: "Brazo izq.", top: "40%", left: "12%" },
          { zona: "brazo", lado: "derecho", texto: "Brazo der.", top: "40%", left: "76%" },
          { zona: "cadera", lado: "none", texto: "Cadera", top: "52%", left: "44%" },
          { zona: "pierna", lado: "izquierdo", texto: "Pierna izq.", top: "68%", left: "30%" },
          { zona: "pierna", lado: "derecho", texto: "Pierna der.", top: "68%", left: "60%" },
          { zona: "rodilla-tobillo", lado: "izquierdo", texto: "Rodilla / tobillo izq.", top: "87%", left: "30%" },
          { zona: "rodilla-tobillo", lado: "derecho", texto: "Rodilla / tobillo der.", top: "87%", left: "60%" }
        ],
        trasera: [
          { zona: "hombro", lado: "izquierdo", texto: "Hombro izq.", top: "20%", left: "14%" },
          { zona: "hombro", lado: "derecho", texto: "Hombro der.", top: "20%", left: "74%" },
          { zona: "espalda-alta", lado: "none", texto: "Espalda alta", top: "34%", left: "44%" },
          { zona: "espalda-baja", lado: "none", texto: "Espalda baja", top: "50%", left: "44%" },
          { zona: "gluteo", lado: "none", texto: "Glúteo", top: "62%", left: "44%" },
          { zona: "pierna", lado: "izquierdo", texto: "Pierna izq.", top: "76%", left: "30%" },
          { zona: "pierna", lado: "derecho", texto: "Pierna der.", top: "76%", left: "60%" }
        ]
      },

      // ---- LOTE 3: bloques de recuperación (nota 17) --------------------------
      RECOVERY_BLOCKS: {
        movilidad: {
          nombre: "Movilidad suave", duracion: "10-15 min", esfuerzoEsperado: "Muy bajo · sin carga",
          guia: [
            "Movilidad de hombro en círculos, 10 repeticiones por lado.",
            "Movilidad de cadera: rotaciones y balanceos suaves.",
            "Movilidad de tobillo y sentadilla profunda sostenida.",
            "Cierra con respiración calmada y estiramientos suaves."
          ]
        },
        cardio: {
          nombre: "Cardio suave", duracion: "15-20 min", esfuerzoEsperado: "Bajo · activa sin fatigar",
          guia: [
            "Ritmo cómodo: debes poder mantener una conversación.",
            "Bici, elíptica o caminar rápido, lo que tengas a mano.",
            "Termina con 2-3 min aún más suaves para bajar el ritmo."
          ]
        },
        // ---- prioridad-hibrida-006: alternativas por entorno (nota 17
        // ampliada). caminata para quien declaró exterior/parque, cinta para
        // días de lluvia o entorno "Cinta". Mismo esquema que movilidad/cardio.
        caminata: {
          nombre: "Caminata suave", duracion: "15-25 min", esfuerzoEsperado: "Muy bajo · exterior",
          guia: [
            "Paso cómodo, sin buscar ritmo.",
            "Aprovecha para respirar y despejarte, no es un entrenamiento.",
            "Termina cuando quieras: no hay un mínimo obligatorio."
          ]
        },
        cinta: {
          nombre: "Cinta suave (si llueve)", duracion: "15-20 min", esfuerzoEsperado: "Bajo · bajo techo",
          guia: [
            "Velocidad de paseo o trote muy suave.",
            "Sin inclinación o mínima: el objetivo es moverte, no fatigarte.",
            "Buena alternativa cuando el exterior no es una opción."
          ]
        }
      },

      OTHER_FAVORITES: [
        "Jalón al pecho en polea",
        "Remo sentado en máquina",
        "Extensión de tríceps con cuerda"
      ],

      PROGRESS_EXAMPLE: [
        { fecha: "Hoy", valor: "52.5 kg × 11 reps" },
        { fecha: "Hace 1 semana", valor: "50 kg × 12 reps" },
        { fecha: "Hace 2 semanas", valor: "50 kg × 10 reps" },
        { fecha: "Hace 3 semanas", valor: "47.5 kg × 11 reps" },
        { fecha: "Hace 4 semanas", valor: "47.5 kg × 9 reps" }
      ],

      // Duración de referencia de la sesión Pull completa (dato ficticio).
      FULL_SESSION_MINUTES: 48,

      // ---- LOTE 3: minutos de referencia por sesión de fuerza, para calcular
      // minutos proporcionales al cerrar una sesión parcial (nota 05). --------
      SESSION_REFERENCE_MINUTES: { pull: 48, push: 50, legs: 55 },

      // ---- LOTE 3: progreso de sesión persistente en el modelo (nota 13):
      // orden local, ejercicio abierto y modo de registro. Vive en App.data
      // (no en variables locales de vista) para que "Entrenar" recupere la
      // sesión en curso donde se quedó. ponytail: un progreso por sessionId,
      // suficiente para el prototipo (una sesión en curso a la vez).
      SESSION_PROGRESS: {},

      // ---- LOTE 4: catálogo completo (nota 08/09, punto 19) -------------------
      // Organizado por patrón de movimiento → grupo muscular → equipamiento
      // general → variante concreta, tal como pide MVP-DEFINITION.md §9. Cada
      // entrada es YA una variante concreta (ejemplo del MVP: "tracción
      // vertical → jalón en polea / dominada asistida / dominada libre" son
      // tres entradas separadas, cada una con su propia referencia de carga).
      // `reference.ultima` es null cuando no hay historial todavía (nota 23,
      // camino "no existe resultado anterior"); se rellena en un puñado de
      // entradas para poder demostrar también el camino "sí existe".
      EXERCISE_CATALOG: [
        {
          id: "jalon-polea", nombre: "Jalón en polea", patron: "Tracción vertical",
          grupo: "Espalda", equipo: "Polea", objetivo: "3 × 10-12 reps",
          favorito: true, custom: false, icon: "pull",
          guide: {
            cues: ["Escápulas abajo y atrás antes de tirar.", "Guía la barra hacia la parte alta del pecho.", "Controla la bajada, no sueltes de golpe."],
            muscles: ["Dorsal ancho", "Bíceps", "Trapecio inferior"]
          },
          video: "https://www.youtube.com/results?search_query=jalon+en+polea+tecnica",
          reference: { cargaInicial: 40, ultima: { peso: 52.5, reps: 11, facilidad: "adecuada" }, proxima: { peso: 55, reps: 10 }, notaSugerencia: "Dentro de rango y facilidad adecuada: se sugirió un progreso pequeño." }
        },
        {
          id: "dominada-asistida", nombre: "Dominada asistida", patron: "Tracción vertical",
          grupo: "Espalda", equipo: "Máquina", objetivo: "3 × 8-10 reps",
          favorito: false, custom: false, icon: "pull",
          guide: {
            cues: ["Cuanta menos asistencia, más exigente: sube el peso de asistencia poco a poco.", "Sube hasta que la barbilla pase la barra sin balancear el cuerpo."],
            muscles: ["Dorsal ancho", "Bíceps", "Core"]
          },
          video: "https://www.youtube.com/results?search_query=dominada+asistida+tecnica",
          reference: { cargaInicial: 25, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "dominada-libre", nombre: "Dominada libre", patron: "Tracción vertical",
          grupo: "Espalda", equipo: "Peso corporal", objetivo: "3 × 6-8 reps",
          favorito: false, custom: false, icon: "pull",
          guide: {
            cues: ["Evita el balanceo (kipping) si buscas fuerza controlada.", "Baja hasta la extensión completa del brazo."],
            muscles: ["Dorsal ancho", "Bíceps", "Antebrazo"]
          },
          video: "https://www.youtube.com/results?search_query=dominada+libre+tecnica",
          reference: { cargaInicial: 0, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "remo-sentado-maquina", nombre: "Remo sentado en máquina", patron: "Tracción horizontal",
          grupo: "Espalda", equipo: "Máquina", objetivo: "3 × 10-12 reps",
          favorito: true, custom: false, icon: "row",
          guide: {
            cues: ["Pecho apoyado o torso estable, sin balanceo.", "Tira llevando los codos cerca del cuerpo.", "Aprieta omóplatos al final del recorrido."],
            muscles: ["Dorsal ancho", "Romboides", "Trapecio medio"]
          },
          video: "https://www.youtube.com/results?search_query=remo+sentado+en+maquina+tecnica",
          reference: { cargaInicial: 30, ultima: { peso: 45, reps: 12, facilidad: "facil" }, proxima: { peso: 47.5, reps: 10 }, notaSugerencia: "Dentro de rango y facilidad adecuada: se sugirió un progreso pequeño." }
        },
        {
          id: "remo-barra", nombre: "Remo con barra", patron: "Tracción horizontal",
          grupo: "Espalda", equipo: "Barra", objetivo: "3 × 8-10 reps",
          favorito: false, custom: false, icon: "row",
          guide: {
            cues: ["Bisagra de cadera con espalda neutra.", "Tira hacia el abdomen, codos cerca del cuerpo."],
            muscles: ["Dorsal ancho", "Romboides", "Lumbar"]
          },
          video: "https://www.youtube.com/results?search_query=remo+con+barra+tecnica",
          reference: { cargaInicial: 30, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "remo-punta-t", nombre: "Remo en punta T", patron: "Tracción horizontal",
          grupo: "Espalda", equipo: "Máquina", objetivo: "3 × 10-12 reps",
          favorito: false, custom: false, icon: "row",
          guide: {
            cues: ["Pecho apoyado, evita el impulso lumbar.", "Recorrido completo y controlado."],
            muscles: ["Dorsal ancho", "Trapecio medio"]
          },
          video: "https://www.youtube.com/results?search_query=remo+en+punta+t+tecnica",
          reference: { cargaInicial: 20, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "face-pull-cuerda", nombre: "Face pull con cuerda", patron: "Rotación externa de hombro",
          grupo: "Hombro", equipo: "Polea", objetivo: "3 × 15 reps",
          favorito: false, custom: false, icon: "facepull",
          guide: {
            cues: ["Tira hacia la cara con los codos altos.", "Peso ligero: prioriza técnica sobre carga."],
            muscles: ["Deltoide posterior", "Manguito rotador"]
          },
          video: "https://www.youtube.com/results?search_query=face+pull+tecnica",
          reference: { cargaInicial: 10, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "pajaros-mancuerna", nombre: "Pájaros con mancuerna", patron: "Rotación externa de hombro",
          grupo: "Hombro", equipo: "Mancuernas", objetivo: "3 × 15 reps",
          favorito: false, custom: false, icon: "facepull",
          guide: {
            cues: ["Torso inclinado adelante, espalda neutra.", "Eleva sin impulso, codos con ligera flexión."],
            muscles: ["Deltoide posterior", "Trapecio medio"]
          },
          video: "https://www.youtube.com/results?search_query=pajaros+con+mancuerna+tecnica",
          reference: { cargaInicial: 4, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "press-banca-barra", nombre: "Press banca con barra", patron: "Empuje horizontal",
          grupo: "Pecho", equipo: "Barra", objetivo: "3 × 8-10 reps",
          favorito: false, custom: false, icon: "press",
          guide: {
            cues: ["Escápulas retraídas y apoyadas en el banco.", "Baja de forma controlada hasta el pecho.", "Empuja en línea recta sin bloquear el codo de golpe."],
            muscles: ["Pectoral", "Tríceps", "Deltoide anterior"]
          },
          video: "https://www.youtube.com/results?search_query=press+banca+con+barra+tecnica",
          reference: { cargaInicial: 30, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "press-banca-mancuernas", nombre: "Press banca con mancuernas", patron: "Empuje horizontal",
          grupo: "Pecho", equipo: "Mancuernas", objetivo: "3 × 8-10 reps",
          favorito: false, custom: false, icon: "press",
          guide: {
            cues: ["Mayor rango de recorrido: baja hasta sentir estiramiento sin forzar el hombro.", "Empuja en línea recta hacia arriba."],
            muscles: ["Pectoral", "Tríceps", "Deltoide anterior"]
          },
          video: "https://www.youtube.com/results?search_query=press+banca+con+mancuernas+tecnica",
          reference: { cargaInicial: 10, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "press-maquina", nombre: "Press en máquina", patron: "Empuje horizontal",
          grupo: "Pecho", equipo: "Máquina", objetivo: "3 × 10-12 reps",
          favorito: false, custom: false, icon: "press",
          guide: {
            cues: ["Ajusta el asiento para que el agarre quede a la altura del pecho.", "Empuja sin bloquear el codo con violencia."],
            muscles: ["Pectoral", "Tríceps"]
          },
          video: "https://www.youtube.com/results?search_query=press+en+maquina+tecnica",
          reference: { cargaInicial: 20, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "press-militar-barra", nombre: "Press militar con barra", patron: "Empuje vertical",
          grupo: "Hombro", equipo: "Barra", objetivo: "3 × 8-10 reps",
          favorito: false, custom: false, icon: "shoulderpress",
          guide: {
            cues: ["Core firme, sin arquear la zona lumbar.", "Empuja hacia arriba sin balancear el torso."],
            muscles: ["Deltoide", "Tríceps", "Trapecio superior"]
          },
          video: "https://www.youtube.com/results?search_query=press+militar+con+barra+tecnica",
          reference: { cargaInicial: 15, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "press-militar-mancuernas", nombre: "Press militar con mancuernas", patron: "Empuje vertical",
          grupo: "Hombro", equipo: "Mancuernas", objetivo: "3 × 8-10 reps",
          favorito: false, custom: false, icon: "shoulderpress",
          guide: {
            cues: ["Codos ligeramente por delante del torso al empezar.", "Baja controlando hasta la altura del hombro."],
            muscles: ["Deltoide", "Tríceps"]
          },
          video: "https://www.youtube.com/results?search_query=press+militar+con+mancuernas+tecnica",
          reference: { cargaInicial: 8, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "elevacion-lateral-mancuerna", nombre: "Elevación lateral con mancuerna", patron: "Abducción de hombro",
          grupo: "Hombro", equipo: "Mancuernas", objetivo: "3 × 12-15 reps",
          favorito: false, custom: false, icon: "lateral",
          guide: {
            cues: ["Codos con ligera flexión fija.", "Sube hasta la altura del hombro, sin impulso."],
            muscles: ["Deltoide medio"]
          },
          video: "https://www.youtube.com/results?search_query=elevacion+lateral+con+mancuerna+tecnica",
          reference: { cargaInicial: 4, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "fondos-maquina", nombre: "Fondos en máquina asistida", patron: "Empuje horizontal / tríceps",
          grupo: "Tríceps", equipo: "Máquina", objetivo: "3 × 10-12 reps",
          favorito: false, custom: false, icon: "dip",
          guide: {
            cues: ["Torso ligeramente inclinado adelante.", "Baja hasta sentir estiramiento sin forzar el hombro."],
            muscles: ["Tríceps", "Pectoral inferior"]
          },
          video: "https://www.youtube.com/results?search_query=fondos+en+maquina+tecnica",
          reference: { cargaInicial: 25, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "extension-triceps-cuerda", nombre: "Extensión de tríceps con cuerda", patron: "Extensión de codo",
          grupo: "Tríceps", equipo: "Polea", objetivo: "3 × 12-15 reps",
          favorito: true, custom: false, icon: "dip",
          guide: {
            cues: ["Codos pegados al cuerpo durante todo el recorrido.", "Abre la cuerda ligeramente al final del movimiento."],
            muscles: ["Tríceps"]
          },
          video: "https://www.youtube.com/results?search_query=extension+de+triceps+con+cuerda+tecnica",
          reference: { cargaInicial: 12, ultima: { peso: 20, reps: 15, facilidad: "adecuada" }, proxima: { peso: 22.5, reps: 12 }, notaSugerencia: "Dentro de rango y facilidad adecuada: se sugirió un progreso pequeño." }
        },
        {
          id: "press-frances", nombre: "Press francés con barra", patron: "Extensión de codo",
          grupo: "Tríceps", equipo: "Barra", objetivo: "3 × 10-12 reps",
          favorito: false, custom: false, icon: "dip",
          guide: {
            cues: ["Codos fijos apuntando al techo.", "Baja controlando hacia la frente sin abrir los codos."],
            muscles: ["Tríceps"]
          },
          video: "https://www.youtube.com/results?search_query=press+frances+con+barra+tecnica",
          reference: { cargaInicial: 10, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "curl-biceps-barra", nombre: "Curl de bíceps con barra Z", patron: "Flexión de codo",
          grupo: "Bíceps", equipo: "Barra", objetivo: "3 × 10-12 reps",
          favorito: false, custom: false, icon: "curl",
          guide: {
            cues: ["Codos pegados al cuerpo durante todo el recorrido.", "Sube sin balancear el torso hacia atrás."],
            muscles: ["Bíceps braquial", "Antebrazo"]
          },
          video: "https://www.youtube.com/results?search_query=curl+de+biceps+barra+z+tecnica",
          reference: { cargaInicial: 15, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "curl-biceps-mancuerna", nombre: "Curl con mancuernas alterno", patron: "Flexión de codo",
          grupo: "Bíceps", equipo: "Mancuernas", objetivo: "3 × 10-12 reps",
          favorito: false, custom: false, icon: "curl",
          guide: {
            cues: ["Rota la muñeca al subir (supinación).", "Controla la bajada, no dejes caer el peso."],
            muscles: ["Bíceps braquial", "Braquial anterior"]
          },
          video: "https://www.youtube.com/results?search_query=curl+con+mancuernas+alterno+tecnica",
          reference: { cargaInicial: 6, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "curl-biceps-polea", nombre: "Curl en polea con cuerda", patron: "Flexión de codo",
          grupo: "Bíceps", equipo: "Polea", objetivo: "3 × 12-15 reps",
          favorito: false, custom: false, icon: "curl",
          guide: {
            cues: ["Tensión constante gracias a la polea.", "Rango completo sin bloquear el codo con fuerza."],
            muscles: ["Bíceps braquial"]
          },
          video: "https://www.youtube.com/results?search_query=curl+en+polea+con+cuerda+tecnica",
          reference: { cargaInicial: 10, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "sentadilla-barra", nombre: "Sentadilla con barra libre", patron: "Dominante de rodilla",
          grupo: "Piernas", equipo: "Barra", objetivo: "3 × 8-10 reps",
          favorito: false, custom: false, icon: "squat",
          guide: {
            cues: ["Pecho alto, mirada al frente.", "Rodillas siguen la dirección de los pies.", "Baja hasta donde la técnica se mantenga sólida."],
            muscles: ["Cuádriceps", "Glúteo", "Core"]
          },
          video: "https://www.youtube.com/results?search_query=sentadilla+con+barra+tecnica",
          reference: { cargaInicial: 40, ultima: { peso: 70, reps: 7, facilidad: "dura" }, proxima: { peso: 67.5, reps: 8 }, notaSugerencia: "Quedó corto o resultó exigente: se sugirió mantener o reducir." }
        },
        {
          id: "sentadilla-goblet", nombre: "Sentadilla goblet", patron: "Dominante de rodilla",
          grupo: "Piernas", equipo: "Mancuernas", objetivo: "3 × 10-12 reps",
          favorito: false, custom: false, icon: "squat",
          guide: {
            cues: ["Sujeta la mancuerna pegada al pecho.", "Codos rozando el interior de las rodillas al bajar."],
            muscles: ["Cuádriceps", "Glúteo"]
          },
          video: "https://www.youtube.com/results?search_query=sentadilla+goblet+tecnica",
          reference: { cargaInicial: 12, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "prensa-45", nombre: "Prensa 45°", patron: "Dominante de rodilla",
          grupo: "Piernas", equipo: "Máquina", objetivo: "3 × 10-12 reps",
          favorito: false, custom: false, icon: "legpress",
          guide: {
            cues: ["Zona lumbar apoyada en el respaldo.", "No bloquees la rodilla al extender."],
            muscles: ["Cuádriceps", "Glúteo"]
          },
          video: "https://www.youtube.com/results?search_query=prensa+de+piernas+45+tecnica",
          reference: { cargaInicial: 60, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "zancada-mancuernas", nombre: "Zancada con mancuernas", patron: "Dominante de rodilla",
          grupo: "Piernas", equipo: "Mancuernas", objetivo: "3 × 10-12 reps por pierna",
          favorito: false, custom: false, icon: "squat",
          guide: {
            cues: ["Paso amplio, rodilla trasera casi roza el suelo.", "Torso erguido durante todo el recorrido."],
            muscles: ["Cuádriceps", "Glúteo"]
          },
          video: "https://www.youtube.com/results?search_query=zancada+con+mancuernas+tecnica",
          reference: { cargaInicial: 8, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "peso-muerto-rumano", nombre: "Peso muerto rumano", patron: "Dominante de cadera",
          grupo: "Piernas", equipo: "Barra", objetivo: "3 × 8-10 reps",
          favorito: false, custom: false, icon: "hamcurl",
          guide: {
            cues: ["Bisagra de cadera, espalda neutra en todo momento.", "La barra se desliza cerca de las piernas."],
            muscles: ["Isquiotibiales", "Glúteo", "Lumbar"]
          },
          video: "https://www.youtube.com/results?search_query=peso+muerto+rumano+tecnica",
          reference: { cargaInicial: 30, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "curl-femoral-maquina", nombre: "Curl femoral en máquina", patron: "Dominante de cadera",
          grupo: "Piernas", equipo: "Máquina", objetivo: "3 × 12-15 reps",
          favorito: false, custom: false, icon: "hamcurl",
          guide: {
            cues: ["Cadera apoyada y estable.", "Flexiona sin despegar la cadera del banco."],
            muscles: ["Isquiotibiales"]
          },
          video: "https://www.youtube.com/results?search_query=curl+femoral+en+maquina+tecnica",
          reference: { cargaInicial: 20, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "hip-thrust-barra", nombre: "Hip thrust con barra", patron: "Dominante de cadera",
          grupo: "Glúteo", equipo: "Barra", objetivo: "3 × 10-12 reps",
          favorito: false, custom: false, icon: "hipthrust",
          guide: {
            cues: ["Barra apoyada sobre la cadera con protección.", "Empuja llevando la cadera a la extensión completa, sin arquear en exceso."],
            muscles: ["Glúteo", "Isquiotibiales"]
          },
          video: "https://www.youtube.com/results?search_query=hip+thrust+con+barra+tecnica",
          reference: { cargaInicial: 20, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "elevacion-gemelo-maquina", nombre: "Elevación de gemelo de pie", patron: "Flexión plantar",
          grupo: "Pantorrilla", equipo: "Máquina", objetivo: "3 × 15 reps",
          favorito: false, custom: false, icon: "calf",
          guide: {
            cues: ["Recorrido completo, arriba y abajo.", "Sin rebotar en la parte baja."],
            muscles: ["Gemelo", "Sóleo"]
          },
          video: "https://www.youtube.com/results?search_query=elevacion+de+gemelo+de+pie+tecnica",
          reference: { cargaInicial: 30, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "elevacion-gemelo-prensa", nombre: "Elevación de gemelo en prensa", patron: "Flexión plantar",
          grupo: "Pantorrilla", equipo: "Máquina", objetivo: "3 × 15 reps",
          favorito: false, custom: false, icon: "calf",
          guide: {
            cues: ["Empuja solo con la punta del pie, talones libres.", "Pausa breve en la posición alta."],
            muscles: ["Gemelo", "Sóleo"]
          },
          video: "https://www.youtube.com/results?search_query=elevacion+de+gemelo+en+prensa+tecnica",
          reference: { cargaInicial: 40, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "aductor-maquina", nombre: "Aductor en máquina", patron: "Aducción de cadera",
          grupo: "Piernas", equipo: "Máquina", objetivo: "3 × 12-15 reps",
          favorito: false, custom: false, icon: "adductor",
          guide: {
            cues: ["Movimiento controlado hacia el centro, sin golpear el tope.", "Espalda apoyada en el respaldo."],
            muscles: ["Aductores"]
          },
          video: "https://www.youtube.com/results?search_query=aductor+en+maquina+tecnica",
          reference: { cargaInicial: 20, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "abductor-maquina", nombre: "Abductor en máquina", patron: "Abducción de cadera",
          grupo: "Glúteo", equipo: "Máquina", objetivo: "3 × 12-15 reps",
          favorito: false, custom: false, icon: "adductor",
          guide: {
            cues: ["Torso estable, evita el impulso.", "Abre controlando la vuelta al centro."],
            muscles: ["Glúteo medio"]
          },
          video: "https://www.youtube.com/results?search_query=abductor+en+maquina+tecnica",
          reference: { cargaInicial: 20, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "crunch-polea", nombre: "Abdominales en polea alta", patron: "Flexión de tronco",
          grupo: "Core", equipo: "Polea", objetivo: "3 × 15 reps",
          favorito: false, custom: false, icon: "core",
          guide: {
            cues: ["Flexiona desde el tronco, no tires con los brazos.", "Exhala al flexionar hacia abajo."],
            muscles: ["Recto abdominal"]
          },
          video: "https://www.youtube.com/results?search_query=abdominales+en+polea+alta+tecnica",
          reference: { cargaInicial: 15, ultima: null, proxima: null, notaSugerencia: null }
        },
        {
          id: "plancha", nombre: "Plancha frontal", patron: "Estabilización de tronco",
          grupo: "Core", equipo: "Peso corporal", objetivo: "3 × 30-45 s",
          favorito: false, custom: false, icon: "plank",
          guide: {
            cues: ["Línea recta de cabeza a talones, sin elevar la cadera.", "Respiración continua, sin apnea."],
            muscles: ["Recto abdominal", "Transverso"]
          },
          video: "https://www.youtube.com/results?search_query=plancha+frontal+tecnica",
          reference: { cargaInicial: 0, ultima: null, proxima: null, notaSugerencia: null }
        }
      ],

      // ---- LOTE 4: recientes de ejemplo (nota 08: prioridad favoritas → recientes
      // → mismo patrón → catálogo general). Ids distintos de las 3 favoritas. --
      RECENT_EXERCISE_IDS: ["press-banca-barra", "sentadilla-barra", "curl-biceps-mancuerna"],

      // ---- LOTE 4: "bloque del borrador" (nota 08: añadir a sesión o a bloque
      // del borrador). No hay estructura de bloques por ejercicio en el plan
      // todavía (lotes 2/5/6 no la definen); esta lista mínima y aditiva deja
      // constancia de la intención sin tocar PLANS ni fases. Lotes futuros
      // pueden migrarla a una estructura de bloque real si hace falta. -------
      DRAFT_BLOCK_EXERCISES: [],

      // ---- LOTE 5: objetivos de resistencia (nota 06) --------------------
      // Catálogo navegable de los 6 objetivos del encargo. `segments` es la
      // PLANTILLA de tramos (calentamiento/trabajo/recuperación/vuelta a la
      // calma); una sesión concreta clona esta plantilla en `session.segmentos`
      // la primera vez que se abre (data.sessionSegments), para llevar su
      // propio estado de ejecución sin mutar el catálogo compartido.
      ENDURANCE_OBJECTIVES: [
        {
          key: "continua-suave", nombre: "Continua suave / recuperación",
          duracionTexto: "20-30 min", intensidadTexto: "Esfuerzo bajo: debes poder mantener una conversación.",
          estructuraTexto: "Sin tramos: ritmo constante de principio a fin.",
          proposito: "Activa la recuperación sin sumar fatiga extra a la semana.",
          segments: null
        },
        {
          key: "fondo-tirada-larga", nombre: "Fondo o tirada larga",
          duracionTexto: "60-90 min", intensidadTexto: "Esfuerzo moderado y sostenido, más largo de lo habitual.",
          estructuraTexto: "Sin tramos: un único ritmo continuo de principio a fin.",
          proposito: "Construye la resistencia de base de la semana.",
          segments: null
        },
        {
          key: "intervalos", nombre: "Intervalos",
          duracionTexto: "30-40 min", intensidadTexto: "Alterna esfuerzo alto y recuperación.",
          estructuraTexto: "Calentamiento, varios tramos de trabajo y recuperación, y vuelta a la calma.",
          proposito: "Mejora tu capacidad a ritmos exigentes.",
          segments: [
            { tipo: "calentamiento", nombre: "Calentamiento", duracionTexto: "8 min", objetivoTexto: "Ritmo suave para preparar el cuerpo." },
            { tipo: "trabajo", nombre: "Tramo de trabajo 1", duracionTexto: "3 min", objetivoTexto: "Esfuerzo alto, notorio pero sostenible." },
            { tipo: "recuperacion", nombre: "Recuperación 1", duracionTexto: "2 min", objetivoTexto: "Trote o caminata suave." },
            { tipo: "trabajo", nombre: "Tramo de trabajo 2", duracionTexto: "3 min", objetivoTexto: "Esfuerzo alto, notorio pero sostenible." },
            { tipo: "recuperacion", nombre: "Recuperación 2", duracionTexto: "2 min", objetivoTexto: "Trote o caminata suave." },
            { tipo: "trabajo", nombre: "Tramo de trabajo 3", duracionTexto: "3 min", objetivoTexto: "Esfuerzo alto, notorio pero sostenible." },
            { tipo: "recuperacion", nombre: "Recuperación 3", duracionTexto: "2 min", objetivoTexto: "Trote o caminata suave." },
            { tipo: "trabajo", nombre: "Tramo de trabajo 4", duracionTexto: "3 min", objetivoTexto: "Esfuerzo alto, notorio pero sostenible." },
            { tipo: "recuperacion", nombre: "Recuperación 4", duracionTexto: "2 min", objetivoTexto: "Trote o caminata suave." },
            { tipo: "vuelta_calma", nombre: "Vuelta a la calma", duracionTexto: "5 min", objetivoTexto: "Ritmo muy suave para cerrar." }
          ]
        },
        {
          key: "sprints", nombre: "Sprints",
          duracionTexto: "25-30 min", intensidadTexto: "Esfuerzo muy alto en tramos cortos, con recuperación amplia.",
          estructuraTexto: "Calentamiento, sprints breves con recuperación entre medias, y vuelta a la calma.",
          proposito: "Trabaja la velocidad máxima sin acumular mucho volumen.",
          segments: [
            { tipo: "calentamiento", nombre: "Calentamiento", duracionTexto: "8 min", objetivoTexto: "Ritmo suave y algunas activaciones cortas." },
            { tipo: "trabajo", nombre: "Sprint 1", duracionTexto: "30 s", objetivoTexto: "Esfuerzo casi máximo." },
            { tipo: "recuperacion", nombre: "Recuperación 1", duracionTexto: "90 s", objetivoTexto: "Caminata o trote muy suave." },
            { tipo: "trabajo", nombre: "Sprint 2", duracionTexto: "30 s", objetivoTexto: "Esfuerzo casi máximo." },
            { tipo: "recuperacion", nombre: "Recuperación 2", duracionTexto: "90 s", objetivoTexto: "Caminata o trote muy suave." },
            { tipo: "trabajo", nombre: "Sprint 3", duracionTexto: "30 s", objetivoTexto: "Esfuerzo casi máximo." },
            { tipo: "recuperacion", nombre: "Recuperación 3", duracionTexto: "90 s", objetivoTexto: "Caminata o trote muy suave." },
            { tipo: "vuelta_calma", nombre: "Vuelta a la calma", duracionTexto: "5 min", objetivoTexto: "Ritmo muy suave para cerrar." }
          ]
        },
        {
          key: "bici", nombre: "Bici",
          duracionTexto: "40-50 min", intensidadTexto: "Esfuerzo bajo a moderado.",
          estructuraTexto: "Sin tramos: ritmo constante, adaptable al terreno.",
          proposito: "Cardio de bajo impacto para las articulaciones.",
          segments: null
        },
        {
          key: "caminata", nombre: "Caminata",
          duracionTexto: "30-40 min", intensidadTexto: "Esfuerzo muy bajo.",
          estructuraTexto: "Sin tramos: paso constante de principio a fin.",
          proposito: "Movimiento suave, ideal en días de poca energía.",
          segments: null
        }
      ],

      // ---- LOTE 5: archivos ficticios de importación (nota 07) -------------
      // No hay parser real ni <input type="file">: elegir uno de esta lista
      // simula el archivo local. `formato` fuera de FIT/TCX/GPX/CSV dispara el
      // camino "no admitido"; `valido:false` dispara "inválido" con su causa;
      // `duplicadoDe` señala el id de la sesión/actividad con la que coincide.
      IMPORT_FILES: [
        {
          id: "imp-fit-valido", nombre: "actividad_jueves.fit", formato: "FIT", tamanoKB: 145, valido: true, duplicadoDe: null,
          analisis: {
            tipo: "Carrera", duracionMin: 42, distanciaKm: 6.8, ritmo: "6:10 min/km",
            fcMedia: 152, fcMax: 171,
            zonas: [{ zona: "Z1", min: 4 }, { zona: "Z2", min: 18 }, { zona: "Z3", min: 15 }, { zona: "Z4", min: 5 }],
            cargaEstimada: "media"
          }
        },
        {
          id: "imp-gpx-sin-fc", nombre: "ruta_domingo.gpx", formato: "GPX", tamanoKB: 60, valido: true, duplicadoDe: null,
          analisis: {
            tipo: "Carrera", duracionMin: 78, distanciaKm: 12.4, ritmo: "6:17 min/km",
            fcMedia: null, fcMax: null, zonas: null, cargaEstimada: "alta"
          }
        },
        {
          id: "imp-no-admitido", nombre: "entreno_reloj.pwx", formato: "PWX", tamanoKB: 30, valido: null, duplicadoDe: null, analisis: null
        },
        {
          id: "imp-invalido", nombre: "actividad_corrupta.fit", formato: "FIT", tamanoKB: 2, valido: false, duplicadoDe: null, analisis: null,
          motivoInvalido: "El archivo pesa 2 KB: demasiado pequeño para contener una actividad completa. Vuelve a exportarlo desde tu reloj o app."
        },
        {
          id: "imp-duplicado", nombre: "carrera_suave_martes.fit", formato: "FIT", tamanoKB: 130, valido: true, duplicadoDe: "run-easy",
          analisis: {
            tipo: "Carrera", duracionMin: 30, distanciaKm: 4.5, ritmo: "6:40 min/km",
            fcMedia: 145, fcMax: 160,
            zonas: [{ zona: "Z1", min: 6 }, { zona: "Z2", min: 20 }, { zona: "Z3", min: 4 }],
            cargaEstimada: "baja"
          }
        }
      ],

      // ---- LOTE 5: actividades ya importadas y registradas (nota 29) -------
      ACTIVITY_IMPORTS: [],

      // ---- LOTE 6: métricas personales opcionales (nota 27) ----------------
      // Dos puntos de peso para que exista tendencia, y una medida suelta.
      // La primera entrada de peso ya trae una versión corregida de ejemplo.
      BODY_METRICS: [
        {
          id: "metric-peso-1", tipo: "peso", valor: 78.4, unidad: "kg", zona: null, fecha: "2026-07-11",
          procedencia: "local", sync: "sincronizado",
          versions: [{ valor: 79.0, unidad: "kg", fecha: "2026-07-11", motivo: "Anoté mal el decimal la primera vez." }]
        },
        {
          id: "metric-peso-2", tipo: "peso", valor: 77.6, unidad: "kg", zona: null, fecha: "2026-08-01",
          procedencia: "local", sync: "local", versions: []
        },
        {
          id: "metric-medida-1", tipo: "medida", valor: 82, unidad: "cm", zona: "Cintura", fecha: "2026-07-20",
          procedencia: "local", sync: "sincronizado", versions: []
        }
      ],

      // ---- LOTE 6: compartir rutina y copia independiente (nota 10) --------
      // SHARE_ORIGINAL es una FOTO simulada y autocontenida de "lo que se
      // comparte" (no la estructura real de PLANS/SESSIONS de otros lotes):
      // suficiente para demostrar independencia bidireccional sin acoplar
      // este lote al motor de calendario. Ver adaptOriginalLoad/adaptCopyLoad.
      SHARE_ORIGINAL: {
        calendario: [
          { dia: "Lunes", sesion: "Push" }, { dia: "Miércoles", sesion: "Pull" }, { dia: "Viernes", sesion: "Legs" }
        ],
        cargas: { "Jalón en polea": 52.5, "Sentadilla": 70, "Press banca": 60 }
      },
      SHARED_ROUTINES: [
        { id: "share-demo-1", planNombre: "Bloque de hipertrofia", scope: { estructura: true, notas: true, ejercicios: true }, estado: "activo", enlace: "trainer-demo://compartir/DEMO-0001", creadoEl: "Hace 3 días" }
      ],
      ROUTINE_COPIES: [],

      // ---- LOTE 6: plataforma — instalación y actualización simuladas ------
      PWA: { instalada: false, promptDismissed: false, updateDisponible: true }
    };

    // ---- LOTE 2: lista de planes con los seis estados del ciclo de vida ----
    // data.plan es la MISMA referencia que la entrada "activo": mutar uno
    // muta el otro porque son el mismo objeto (no hay que sincronizar nada).
    data.PLANS = [
      data.plan,
      {
        id: "plan-borrador-1",
        nombre: "Full body para viajar",
        estado: "borrador",
        semanaActual: 0,
        semanasTotales: 6,
        constanciaSemanas: 0,
        fases: [],
        plantilla: "fullbody"
      },
      {
        id: "plan-archivado-1",
        nombre: "Base de fuerza (bloque anterior)",
        estado: "archivado",
        semanaActual: 10,
        semanasTotales: 10,
        constanciaSemanas: 8,
        fases: [],
        plantilla: "ppl"
      }
    ];

    // data.SESSION_EXERCISES (pull/push/legs) se construye dentro de
    // attachDataHelpers(), que se ejecuta a continuación: así se reconstruye
    // igual tanto en la primera carga como tras leer localStorage.
    return attachDataHelpers(data);
  };

  // Expuesto para que App.load() pueda reenganchar los helpers tras leer localStorage.
  App._attachDataHelpers = attachDataHelpers;

  App.data = App.dataDefaults();
})();
