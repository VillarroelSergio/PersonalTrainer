import { expect, test } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.beforeEach(async ({ page }) => {
  if (!process.env.E2E_BASE_URL || !email || !password) {
    throw new Error("E2E_BASE_URL, E2E_EMAIL and E2E_PASSWORD must be configured as GitHub secrets before running production E2E.");
  }

  await page.goto("/login");
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/hoy$/);
  await expect(page.getByRole("heading", { name: "Tu camino" })).toBeVisible();
});

test("mobile production smoke: authenticated read-only navigation", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Navegación principal" });

  for (const [label, url, heading] of [
    ["Plan", /\/plan$/, "Tu plan"],
    ["Ejercicios", /\/ejercicios$/, "Ejercicios"],
    ["Historial", /\/historial$/, "Historial"],
    ["Inicio", /\/hoy$/, "Tu camino"]
  ] as const) {
    await navigation.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
});
