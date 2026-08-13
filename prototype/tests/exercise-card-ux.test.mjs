import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const strengthView = readFileSync(resolve("prototype/js/views/strength.js"), "utf8");

test("la tarjeta agrupa acciones secundarias en Opciones", () => {
  assert.match(strengthView, /"Opciones"/);
  assert.match(strengthView, /openExerciseOptionsSheet/);
  assert.doesNotMatch(strengthView, /var guideBtn = App\.el\("button", "chip", "Ver guía"\)/);
});
