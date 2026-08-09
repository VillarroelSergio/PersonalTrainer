import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

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

test("hidrata un snapshot anterior para que el onboarding pueda mostrar deporte y entornos", () => {
  const context = vm.createContext({ window: {}, console });
  context.window.window = context.window;
  vm.runInContext(readFileSync(resolve("prototype/js/data.js"), "utf8"), context);
  const legacyData = JSON.parse(JSON.stringify(context.window.App.dataDefaults()));
  delete legacyData.DEPORTES;
  delete legacyData.ENTORNOS_ONBOARDING;
  delete legacyData.user.entornos;

  const data = loadWithSnapshot({ data: legacyData, sync: "local", theme: "dark" });

  assert.deepEqual(Array.from(data.DEPORTES), ["Fuerza", "Fuerza + correr", "Fuerza + bici", "Trail", "Senderismo"]);
  assert.deepEqual(Array.from(data.ENTORNOS_ONBOARDING), ["Gimnasio", "Casa", "Parque", "Cinta", "Exterior", "Viaje"]);
  assert.deepEqual(Array.from(data.user.entornos), []);
});
