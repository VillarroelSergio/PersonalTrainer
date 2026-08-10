import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

// Mismo patrón que core-load-compatibility.test.mjs: sin DOM real, solo
// data.js (+ core.js cuando hace falta App.load()) evaluado en un contexto
// vm aislado.

function loadDataOnly() {
  const context = vm.createContext({ window: {}, console });
  context.window.window = context.window;
  vm.runInContext(readFileSync(resolve("prototype/js/data.js"), "utf8"), context);
  return context.window.App;
}

function loadWithSnapshot(snapshot) {
  const storage = new Map([["trainer-demo-v3", JSON.stringify(snapshot)]]);
  const documentElement = { setAttribute() {}, getAttribute() { return null; } };
  const window = {
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key)
    }
  };
  const context = vm.createContext({ window, document: { documentElement }, console });
  vm.runInContext(readFileSync(resolve("prototype/js/data.js"), "utf8"), context);
  vm.runInContext(readFileSync(resolve("prototype/js/core.js"), "utf8"), context);
  assert.equal(window.App.load(), true);
  return window.App.data;
}

test("validateOnboardingPhysical: casos válidos no producen error en ningún campo", () => {
  const App = loadDataOnly();
  const errors = App.data.validateOnboardingPhysical({ edad: 30, alturaCm: 175, pesoKg: 72 });
  assert.equal(errors.edad, null);
  assert.equal(errors.alturaCm, null);
  assert.equal(errors.pesoKg, null);
});

test("validateOnboardingPhysical: edad fuera de 12-100 o no entera produce error", () => {
  const App = loadDataOnly();
  const base = { alturaCm: 175, pesoKg: 72 };
  assert.notEqual(App.data.validateOnboardingPhysical({ ...base, edad: 11 }).edad, null);
  assert.notEqual(App.data.validateOnboardingPhysical({ ...base, edad: 101 }).edad, null);
  assert.notEqual(App.data.validateOnboardingPhysical({ ...base, edad: 30.5 }).edad, null);
  assert.notEqual(App.data.validateOnboardingPhysical({ ...base, edad: null }).edad, null);
  assert.equal(App.data.validateOnboardingPhysical({ ...base, edad: 12 }).edad, null);
  assert.equal(App.data.validateOnboardingPhysical({ ...base, edad: 100 }).edad, null);
});

test("validateOnboardingPhysical: altura fuera de 100-250 cm produce error", () => {
  const App = loadDataOnly();
  const base = { edad: 30, pesoKg: 72 };
  assert.notEqual(App.data.validateOnboardingPhysical({ ...base, alturaCm: 99 }).alturaCm, null);
  assert.notEqual(App.data.validateOnboardingPhysical({ ...base, alturaCm: 251 }).alturaCm, null);
  assert.notEqual(App.data.validateOnboardingPhysical({ ...base, alturaCm: "" }).alturaCm, null);
  assert.equal(App.data.validateOnboardingPhysical({ ...base, alturaCm: 100 }).alturaCm, null);
  assert.equal(App.data.validateOnboardingPhysical({ ...base, alturaCm: 250 }).alturaCm, null);
});

test("validateOnboardingPhysical: peso fuera de 30-300 kg produce error", () => {
  const App = loadDataOnly();
  const base = { edad: 30, alturaCm: 175 };
  assert.notEqual(App.data.validateOnboardingPhysical({ ...base, pesoKg: 29 }).pesoKg, null);
  assert.notEqual(App.data.validateOnboardingPhysical({ ...base, pesoKg: 301 }).pesoKg, null);
  assert.notEqual(App.data.validateOnboardingPhysical({ ...base, pesoKg: null }).pesoKg, null);
  assert.equal(App.data.validateOnboardingPhysical({ ...base, pesoKg: 30 }).pesoKg, null);
  assert.equal(App.data.validateOnboardingPhysical({ ...base, pesoKg: 300 }).pesoKg, null);
});

test("ENTORNOS_ONBOARDING no incluye 'Viaje' y tiene los 5 valores del encargo", () => {
  const App = loadDataOnly();
  assert.deepEqual(Array.from(App.data.ENTORNOS_ONBOARDING), ["Gimnasio completo", "Gimnasio básico", "Casa", "Exterior", "Cinta/bici estática"]);
  assert.equal(App.data.ENTORNOS_ONBOARDING.indexOf("Viaje"), -1);
});

test("generatePlanWeek: las nuevas etiquetas de DURACIONES_SESION producen la duración prevista esperada", () => {
  const App = loadDataOnly();
  const cases = [
    ["30-40 min", 35],
    ["45-60 min", 50],
    ["60-75 min", 65],
    ["más de 75 min", 80]
  ];
  cases.forEach(([duracionHabitual, minutosEsperados]) => {
    const result = App.data.generatePlanWeek({
      modo: "plantilla", plantilla: "ppl",
      diasDisponibles: "3", duracionHabitual,
      cardioActividad: "Ninguna", cardioFrecuencia: "0"
    });
    assert.equal(result.infeasible, false);
    assert.ok(result.sessions.length > 0, `sin sesiones para ${duracionHabitual}`);
    result.sessions.forEach((s) => {
      assert.equal(s.duracionPrevista, minutosEsperados, `duración incorrecta para ${duracionHabitual}`);
    });
  });
});

test("generatePlanWeek: explanation nunca es vacío/undefined, con o sin resistencia", () => {
  const App = loadDataOnly();
  const soloFuerza = App.data.generatePlanWeek({
    modo: "plantilla", plantilla: "ppl",
    diasDisponibles: "4", duracionHabitual: "45-60 min",
    cardioActividad: "Ninguna", cardioFrecuencia: "0"
  });
  assert.ok(soloFuerza.explanation && soloFuerza.explanation.length > 0);

  const conResistencia = App.data.generatePlanWeek({
    modo: "plantilla", plantilla: "hibrido",
    diasDisponibles: "5", duracionHabitual: "60-75 min",
    cardioActividad: "Correr", cardioFrecuencia: "2"
  });
  assert.ok(conResistencia.explanation && conResistencia.explanation.length > 0);

  const infeasible = App.data.generatePlanWeek({
    modo: "plantilla", plantilla: "hibrido",
    diasDisponibles: "1", duracionHabitual: "30-40 min",
    cardioActividad: "Correr", cardioFrecuencia: "2"
  });
  assert.equal(infeasible.infeasible, true);
  assert.ok(infeasible.explanation && infeasible.explanation.length > 0);
});

test("hidratación de snapshot antiguo (sin campos del onboarding guiado) rellena los valores por defecto", () => {
  const App = loadDataOnly();
  const legacyData = JSON.parse(JSON.stringify(App.dataDefaults()));
  delete legacyData.user.equipoPorEntorno;
  delete legacyData.user.alturaCm;
  delete legacyData.user.pesoKg;
  delete legacyData.user.recommendationMode;
  delete legacyData.user.externalRecordingMode;
  delete legacyData.EQUIPAMIENTO_POR_ENTORNO;
  delete legacyData.OBJETIVOS_ONBOARDING;

  const data = loadWithSnapshot({ data: legacyData, sync: "local", theme: "dark" });

  assert.deepEqual(Object.keys(data.user.equipoPorEntorno), []);
  assert.equal(data.user.alturaCm, null);
  assert.equal(data.user.pesoKg, null);
  assert.equal(data.user.recommendationMode, "proactive_confirmed");
  assert.equal(data.user.externalRecordingMode, "manual_watch_import");
  assert.deepEqual(Array.from(data.OBJETIVOS_ONBOARDING), ["Ganar músculo", "Ganar fuerza", "Quemar grasa", "Mejorar rendimiento exterior", "Mantenerme activo"]);
  assert.ok(data.EQUIPAMIENTO_POR_ENTORNO["Gimnasio completo"].length > 0);
});

/* ---- Corrección onboarding-guiado-010: objetivos multi-selección --------- */

test("OBJETIVOS_ONBOARDING incluye 'Quemar grasa' entre las 5 opciones combinables", () => {
  const App = loadDataOnly();
  assert.ok(App.data.OBJETIVOS_ONBOARDING.indexOf("Quemar grasa") > -1);
  assert.equal(App.data.OBJETIVOS_ONBOARDING.length, 5);
});

test("dataDefaults().user expone goals/primaryGoal/birthDate para la selección múltiple", () => {
  const App = loadDataOnly();
  const user = App.dataDefaults().user;
  assert.deepEqual(Array.from(user.goals), []);
  assert.equal(user.primaryGoal, null);
  assert.equal(user.birthDate, null);
});

/* ---- Corrección onboarding-guiado-010: fecha de nacimiento por rueda ----- */

test("ageFromBirthDate calcula la edad a partir de la fecha, no de un campo escrito a mano", () => {
  const App = loadDataOnly();
  const today = new Date();
  const y = today.getFullYear();

  // Determinista y libre de flakiness estacional: una fecha de nacimiento
  // exactamente "hoy hace 25 años" siempre da edad 25, sea cual sea el mes.
  const exactBirthDate = `${y - 25}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  assert.equal(App.data.ageFromBirthDate(exactBirthDate), 25);

  assert.equal(App.data.ageFromBirthDate(null), null);
  assert.equal(App.data.ageFromBirthDate(""), null);
});

test("migración: un snapshot antiguo con 'edad' pero sin 'birthDate' recibe una fecha compatible al cargar", () => {
  const App = loadDataOnly();
  const legacyData = JSON.parse(JSON.stringify(App.dataDefaults()));
  legacyData.user.edad = 30;
  delete legacyData.user.birthDate;

  const data = loadWithSnapshot({ data: legacyData, sync: "local", theme: "dark" });
  assert.match(data.user.birthDate, /^\d{4}-01-01$/);
  assert.equal(data.user.edad, 30);
});

test("reinicio de demo (dataDefaults) sigue produciendo un perfil físico válido, sin datos inventados", () => {
  const App = loadDataOnly();
  const user = App.dataDefaults().user;
  assert.equal(user.birthDate, null);
  assert.equal(user.alturaCm, null);
  assert.equal(user.pesoKg, null);
  assert.equal(user.unidadesAltura, "cm");
  assert.equal(user.unidades, "kg");
});

/* ---- Corrección onboarding-guiado-010: sin ft/in ni lb en el onboarding -- */

test("access.js ya no ofrece unidades ft/in o lb en el onboarding (rueda fija a cm/kg)", () => {
  const source = readFileSync(resolve("prototype/js/views/access.js"), "utf8");
  // Las funciones y el toggle que permitían elegir ft-in/lb en el onboarding
  // se eliminaron junto con el formulario de texto que sustituyen las ruedas.
  assert.equal(source.indexOf("function unitToggle"), -1);
  assert.equal(source.indexOf("cmFromFtIn"), -1);
  assert.equal(source.indexOf("ftInFromCm"), -1);
  assert.equal(source.indexOf('["cm", "cm"], ["ft-in"'), -1);
  assert.equal(source.indexOf('["kg", "kg"], ["lb"'), -1);
  // Las tres pantallas de rueda sí deben existir.
  assert.ok(source.indexOf("function renderNacimiento") > -1);
  assert.ok(source.indexOf("function renderAltura") > -1);
  assert.ok(source.indexOf("function renderPeso") > -1);
});

/* ---- Corrección onboarding-guiado-010: paso de equipamiento (default-on) - */

test("el equipamiento de cada entorno empieza seleccionado (deseleccionado vacío = todo disponible)", () => {
  const App = loadDataOnly();
  App.data.ENTORNOS_ONBOARDING.forEach((entorno) => {
    const grupoKeys = Array.from(App.data.EQUIPAMIENTO_GRUPOS_POR_ENTORNO[entorno]);
    assert.ok(grupoKeys.length > 0, `${entorno} sin grupos de equipamiento`);
    // Con deseleccionado = [] (estado inicial de cada entorno en el
    // onboarding), toda categoría de equipo que aparece en sus grupos debe
    // contar como disponible: nada queda excluido por defecto.
    const disponibles = App.data.equipoDisponiblePorEntorno(entorno, []);
    const categoriasEsperadas = new Set();
    grupoKeys.forEach((key) => {
      const grupo = Array.from(App.data.EQUIPAMIENTO_GRUPOS).find((g) => g.key === key);
      Array.from(grupo.items).forEach((item) => {
        const categoria = App.data.EQUIPO_ITEM_A_CATEGORIA[item];
        if (categoria) categoriasEsperadas.add(categoria);
      });
    });
    categoriasEsperadas.forEach((categoria) => {
      assert.equal(disponibles[categoria], true, `${entorno}/${categoria} debería empezar disponible`);
    });
  });
});

test("'Gimnasio completo' muestra los 6 grupos y ningún otro entorno usa un grupo que no le corresponde", () => {
  const App = loadDataOnly();
  assert.equal(Array.from(App.data.EQUIPAMIENTO_GRUPOS_POR_ENTORNO["Gimnasio completo"]).length, App.data.EQUIPAMIENTO_GRUPOS.length);
  const clavesValidas = new Set(Array.from(App.data.EQUIPAMIENTO_GRUPOS).map((g) => g.key));
  Object.keys(App.data.EQUIPAMIENTO_GRUPOS_POR_ENTORNO).forEach((entorno) => {
    Array.from(App.data.EQUIPAMIENTO_GRUPOS_POR_ENTORNO[entorno]).forEach((key) => {
      assert.ok(clavesValidas.has(key), `${entorno} referencia un grupo inexistente: ${key}`);
    });
  });
});

test("desmarcar un ítem persiste al avanzar y volver (mutación del mismo array, sin reinicio implícito)", () => {
  const App = loadDataOnly();
  // Simula lo que hace access.js: la primera vez que se entra al paso se
  // inicializa el array vacío; en visitas posteriores solo se lee la misma
  // referencia, nunca se vuelve a crear vacía.
  const equipoPorEntorno = {};
  function entrarAlPaso(entorno) {
    if (!equipoPorEntorno[entorno]) equipoPorEntorno[entorno] = [];
    return equipoPorEntorno[entorno];
  }
  let deseleccionado = entrarAlPaso("Gimnasio completo");
  assert.deepEqual(deseleccionado, []);
  deseleccionado.push("Máquina Smith"); // el usuario desmarca un ítem

  // "Avanzar" (siguiente paso) y "volver" (paso anterior) en el onboarding
  // real no reconstruyen ctx.form: siguen leyendo el mismo objeto.
  const alVolver = entrarAlPaso("Gimnasio completo");
  assert.deepEqual(Array.from(alVolver), ["Máquina Smith"]);
  // El ítem concreto sigue desmarcado tras volver; la categoría "Máquina"
  // sigue disponible porque otros ítems del grupo (Prensa, Remo en
  // máquina...) siguen seleccionados: desmarcar uno no bloquea la categoría.
  assert.equal(App.data.equipoDisponiblePorEntorno("Gimnasio completo", alVolver)["Máquina"], true);
});

test("priorizarPorEquipoDisponible reordena el catálogo real sin ocultar ningún ejercicio", () => {
  const App = loadDataOnly();
  const catalogo = Array.from(App.data.EXERCISE_CATALOG);
  assert.ok(catalogo.some((e) => e.equipo === "Polea"));
  assert.ok(catalogo.some((e) => e.equipo === "Barra"));

  // Entorno "Casa" no incluye el grupo "poleas-torso": los ejercicios con
  // equipo "Polea" deben quedar relegados al final, pero seguir presentes.
  const resultado = App.data.priorizarPorEquipoDisponible(catalogo, "Casa", []);
  assert.equal(resultado.length, catalogo.length, "nunca debe ocultar ejercicios del catálogo");
  const idsOriginales = new Set(catalogo.map((e) => e.id));
  const idsResultado = new Set(Array.from(resultado).map((e) => e.id));
  assert.deepEqual(idsResultado, idsOriginales);

  const primeraPoleaIdx = resultado.findIndex((e) => e.equipo === "Polea");
  const primeraBarraIdx = resultado.findIndex((e) => e.equipo === "Barra");
  assert.ok(primeraBarraIdx > -1 && primeraPoleaIdx > -1);
  assert.ok(primeraBarraIdx < primeraPoleaIdx, "Barra (disponible en Casa) debe priorizarse antes que Polea (no disponible en Casa)");
});

test("desmarcar todo el material de una categoría la saca de la priorización, sin bloquear el catálogo", () => {
  const App = loadDataOnly();
  const catalogo = Array.from(App.data.EXERCISE_CATALOG);
  // "Gimnasio completo" trae Polea disponible por defecto (deseleccionado = []).
  const conPolea = App.data.equipoDisponiblePorEntorno("Gimnasio completo", []);
  assert.equal(conPolea["Polea"], true);

  // Desmarcar todos los ítems de "poleas-torso" que mapean a "Polea" quita
  // la categoría de disponibles, pero priorizarPorEquipoDisponible sigue
  // devolviendo la lista completa (solo reordena).
  const grupoPoleas = Array.from(App.data.EQUIPAMIENTO_GRUPOS).find((g) => g.key === "poleas-torso");
  const deseleccionado = Array.from(grupoPoleas.items);
  const sinPolea = App.data.equipoDisponiblePorEntorno("Gimnasio completo", deseleccionado);
  assert.equal(sinPolea["Polea"], undefined);

  const resultado = App.data.priorizarPorEquipoDisponible(catalogo, "Gimnasio completo", deseleccionado);
  assert.equal(resultado.length, catalogo.length);
});

/* ---- Corrección prioritaria: pantalla inmersiva de generación (círculo 0→99%) */

function loadWithApp() {
  const documentElement = { setAttribute() {}, getAttribute() { return null; } };
  const window = {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    matchMedia: () => ({ matches: false })
  };
  const context = vm.createContext({ window, document: { documentElement }, console });
  vm.runInContext(readFileSync(resolve("prototype/js/data.js"), "utf8"), context);
  vm.runInContext(readFileSync(resolve("prototype/js/core.js"), "utf8"), context);
  vm.runInContext(readFileSync(resolve("prototype/js/views/access.js"), "utf8"), context);
  return window.App;
}

test("genPercentForElapsed: empieza en 0 y satura en 99 (nunca en 100)", () => {
  const App = loadWithApp();
  assert.equal(App._genPercentForElapsed(0, App._GEN_DURATION_MS), 0);
  assert.equal(App._genPercentForElapsed(App._GEN_DURATION_MS, App._GEN_DURATION_MS), 99);
  assert.equal(App._genPercentForElapsed(App._GEN_DURATION_MS + 500, App._GEN_DURATION_MS), 99);
});

test("la generación está configurada para durar exactamente 5000 ms", () => {
  const App = loadWithApp();
  assert.equal(App._GEN_DURATION_MS, 5000);
});

test("genPhaseForPercent recorre las tres frases de fase del encargo en sus rangos", () => {
  const App = loadWithApp();
  assert.equal(JSON.stringify(App._GEN_PHASES.map((p) => p.text)), JSON.stringify([
    "Ordenamos tu semana",
    "Equilibramos fuerza y actividad exterior",
    "Preparamos alternativas compatibles"
  ]));
  assert.equal(App._genPhaseForPercent(0).text, "Ordenamos tu semana");
  assert.equal(App._genPhaseForPercent(34).text, "Ordenamos tu semana");
  assert.equal(App._genPhaseForPercent(35).text, "Equilibramos fuerza y actividad exterior");
  assert.equal(App._genPhaseForPercent(69).text, "Equilibramos fuerza y actividad exterior");
  assert.equal(App._genPhaseForPercent(70).text, "Preparamos alternativas compatibles");
  assert.equal(App._genPhaseForPercent(99).text, "Preparamos alternativas compatibles");
});

test("la pantalla de generación se cancela limpiamente si el nodo sale del documento", () => {
  const source = readFileSync(resolve("prototype/js/views/access.js"), "utf8");
  const body = source.slice(source.indexOf("function renderTransition"), source.indexOf("function buildGuidedProposal"));
  // El bucle de requestAnimationFrame comprueba que el círculo sigue en el
  // documento antes de seguir programando frames: si el usuario retrocede o
  // reinicia la demo (mount.innerHTML se limpia en otra vista), el nodo deja
  // de estar en el documento y el paso siguiente nunca se agenda.
  assert.match(body, /document\.body\.contains\(circle\)/);
  assert.match(body, /requestAnimationFrame\(step\)/);
  // Nada de setInterval/múltiples setTimeout encadenados para el progreso.
  assert.equal(body.indexOf("setInterval"), -1);
});

test("al llegar a 99% se genera la propuesta y se navega automáticamente a 'proposal' (Tu plan inicial)", () => {
  const source = readFileSync(resolve("prototype/js/views/access.js"), "utf8");
  const body = source.slice(source.indexOf("function renderTransition"), source.indexOf("function buildGuidedProposal"));
  const finish = body.slice(body.indexOf("function finishTransition"), body.indexOf("function finishTransition") + 200);
  assert.match(finish, /buildGuidedProposal\(ctx\)/);
  assert.match(finish, /ctx\.form\.step = "proposal"/);
  assert.match(finish, /renderStep\(mount, ctx\)/);
  // Nunca se pinta 100%: el tope expuesto en el rol accesible es 99.
  assert.match(body, /aria-valuemax/);
  assert.match(body, /String\(GEN_MAX_PERCENT\)/);
});

test("acceso.js: el paso de equipamiento parte de todo seleccionado, sin 'dejar vacío y seguir', y el CTA queda activo desde el inicio", () => {
  const source = readFileSync(resolve("prototype/js/views/access.js"), "utf8");
  assert.ok(source.indexOf("Partimos de una selección completa. Quita solo lo que no tengas disponible.") > -1);
  assert.ok(source.indexOf("Podrás ajustarlo después en Perfil.") > -1);
  assert.equal(source.indexOf("dejar vacío y seguir"), -1);
  assert.equal(source.indexOf("Marca lo que sueles tener disponible"), -1);
  // El checkbox de cada fila arranca marcado salvo que el ítem esté
  // explícitamente desmarcado (índice -1 en el array de deseleccionados).
  assert.ok(source.indexOf('checkbox.checked = deseleccionado.indexOf(item) === -1;') > -1);
  // renderEquipo debe devolver `true` sin condición (CTA activo de inicio).
  const renderEquipoBody = source.slice(source.indexOf("function renderEquipo"), source.indexOf("function equipRow"));
  assert.ok(/\n\s*return true;\s*\n\s*\}/.test(renderEquipoBody));
});
