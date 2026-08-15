import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

function requireProductionE2eConfiguration() {
  if (!process.env.E2E_BASE_URL || !email || !password) {
    throw new Error("E2E_BASE_URL, E2E_EMAIL and E2E_PASSWORD must be configured as GitHub secrets before running production E2E.");
  }
}

async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("This browser does not support service workers.");
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active || registration.active.state !== "activated") {
      throw new Error("The Trainer service worker did not reach the activated state.");
    }
  });
}

async function hasCachedNavigation(page: Page, targetUrl: string) {
  return page.evaluate(async (expectedUrl) => {
    const cacheNames = (await caches.keys()).filter((name) => name.startsWith("trainer-nav-v3-"));
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      if (requests.some((request) => request.url === expectedUrl)) return true;
    }
    return false;
  }, targetUrl);
}

async function waitForCachedNavigation(page: Page, targetHref: string) {
  const targetUrl = new URL(targetHref, await page.url()).href;
  await expect
    .poll(() => hasCachedNavigation(page, targetUrl), {
      timeout: 30_000,
      message: `The account shell did not cache ${targetUrl} before going offline.`
    })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  requireProductionE2eConfiguration();

  await page.goto("/login");
  await page.getByLabel("Correo").fill(email!);
  await page.getByLabel("Contraseña").fill(password!);

  const initialSnapshot = page.waitForResponse(
    (response) => response.url().includes("/api/v1/offline-snapshot") && response.ok()
  );
  await page.getByRole("button", { name: "Entrar" }).click();
  await initialSnapshot;

  await expect(page).toHaveURL(/\/hoy$/);
  await expect(page.getByRole("heading", { name: "Tu camino" })).toBeVisible();
  await waitForServiceWorker(page);
});

test("mobile production: completes a workout while offline and syncs after reconnecting", async ({ page, context }) => {
  test.setTimeout(90_000);

  // Prefer a still-planned strength session, avoiding an existing in-progress session
  // that would auto-resume and make this test create two local starts.
  const plannedWorkoutLink = page.locator('a[href^="/entrenar?session="][aria-label*="planificada"]').first();
  const startTodayLink = page.getByRole("link", { name: "Empezar sesión" }).first();
  const fallbackWorkoutLink = page.locator('a[href^="/entrenar?session="]').first();
  const workoutLink = (await plannedWorkoutLink.count()) > 0
    ? plannedWorkoutLink
    : (await startTodayLink.count()) > 0 ? startTodayLink : fallbackWorkoutLink;

  await expect(workoutLink, "The authenticated E2E account must have a strength session in its active plan.").toBeVisible();
  const targetHref = await workoutLink.getAttribute("href");
  if (!targetHref) throw new Error("The workout link did not expose a navigable href.");
  await waitForCachedNavigation(page, targetHref);

  await context.setOffline(true);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
  await page.goto(targetHref, { waitUntil: "domcontentloaded" });

  // The route is served from the account shell cache and rendered from the local snapshot.
  const startButton = page.getByRole("button", { name: "Empezar sesión" });
  if (await startButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await startButton.click();
  }
  await expect(page.getByRole("button", { name: "Terminar sesión" })).toBeVisible({ timeout: 20_000 });

  const repetitions = page.locator('input[id^="reps-"]').first();
  await expect(repetitions).toBeVisible();
  await repetitions.fill("8");
  await page.getByRole("button", { name: "Confirmar" }).first().click();
  await expect(page.getByRole("button", { name: /Hecha/ }).first()).toBeVisible();

  await page.getByRole("button", { name: "Terminar sesión" }).click();
  await expect(page.getByRole("region", { name: "Cerrar sesión" })).toBeVisible();
  await page.getByRole("button", { name: "Guardar sesión" }).click();
  await expect(page).toHaveURL(/\/hoy$/);

  const syncIndicator = page.getByRole("button", { name: /Estado de sincronización:/ });
  await expect(syncIndicator).toHaveAttribute("aria-label", /Sin conexión/);

  await context.setOffline(false);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
  await expect(syncIndicator).toHaveAttribute("aria-label", /Sincronizado/, { timeout: 30_000 });
});
