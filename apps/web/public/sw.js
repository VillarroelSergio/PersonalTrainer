/*
 * Minimal PWA shell cache. No precache manifest (Next.js fingerprints change
 * every build, so a static list would go stale) — instead:
 *  - navigations (page loads) use network-first, falling back to the last
 *    successful render of that same route when there's no coverage;
 *  - hashed static assets (_next/static, icons, library media) use
 *    cache-first, since their URL already changes when their content does;
 *  - everything under /api/ always goes to the network untouched — mutations
 *    go through the outbox (src/lib/offline), not the service worker.
 */
const SHELL_CACHE = "trainer-shell-v2";
const NAVIGATION_TIMEOUT_MS = 1800;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, event));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/library/")) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request, event) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
  try {
    const response = await Promise.race([
      fetch(new Request(request, { signal: controller.signal })),
      new Promise((_, reject) => setTimeout(() => reject(new Error("navigation_timeout")), NAVIGATION_TIMEOUT_MS))
    ]);
    if (response.ok) {
      event.waitUntil(cacheResponse(request, response.clone()));
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // A first visit has no cached HTML. Retry without the abort signal so the
    // browser can still complete the initial render instead of failing blank.
    return fetch(request);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  cacheResponse(request, response.clone());
  return response;
}

async function cacheResponse(request, response) {
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(request, response);
}
