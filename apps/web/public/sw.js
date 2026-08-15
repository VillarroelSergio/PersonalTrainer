/*
 * Minimal PWA shell cache. Next.js fingerprints change every build, so install
 * fetches stable shell routes and follows their same-origin static references:
 *  - install fills enough HTML + _next/static entries for first offline load;
 *  - navigations (page loads) use network-first, falling back to the last
 *    successful render of that same route when there's no coverage;
 *  - hashed static assets (_next/static, icons, library media) use
 *    cache-first, since their URL already changes when their content does;
 *  - everything under /api/ always goes to the network untouched — mutations
 *    go through the outbox (src/lib/offline), not the service worker.
 */
const SHELL_CACHE = "trainer-shell-v2";
const NAVIGATION_TIMEOUT_MS = 1800;
const SHELL_ROUTE_URLS = ["/hoy", "/plan", "/ejercicios", "/historial", "/entrenar", "/checkin", "/recuperar", "/resistencia"];
const PUBLIC_SHELL_URLS = ["/manifest.webmanifest", "/icons/icon.svg"];
const STATIC_CACHE_PREFIXES = ["/_next/static/", "/icons/", "/library/"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(precacheShell());
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
    // No exact URL match (e.g. /entrenar?session=3 was never itself visited online). Routes
    // like /hoy and /entrenar now build their screen client-side from the local snapshot, so
    // their page content no longer depends on which query string was server-rendered — serve
    // any cached navigation response for the same pathname instead of failing outright.
    // findSamePathnameCacheUrl mirrors src/lib/offline/cache-fallback.ts (unit-tested there);
    // service workers here run unbundled, so the algorithm is duplicated, not imported.
    const cache = await caches.open(SHELL_CACHE);
    const keys = await cache.keys();
    const targetPathname = new URL(request.url).pathname;
    const fallbackKey = keys.find((key) => new URL(key.url).pathname === targetPathname);
    if (fallbackKey) {
      const fallback = await cache.match(fallbackKey);
      if (fallback) return fallback;
    }
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

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);
  const seen = new Set();
  for (const url of [...SHELL_ROUTE_URLS, ...PUBLIC_SHELL_URLS]) {
    await precacheUrl(cache, seen, url);
  }
}

async function precacheUrl(cache, seen, url) {
  const absoluteUrl = new URL(url, self.location.origin);
  if (absoluteUrl.origin !== self.location.origin) return;
  if (absoluteUrl.pathname.startsWith("/api/")) return;
  const cacheKey = absoluteUrl.href;
  if (seen.has(cacheKey)) return;
  seen.add(cacheKey);

  const response = await fetch(cacheKey);
  if (!response.ok) return;
  await cache.put(new Request(cacheKey), response.clone());

  if (!isShellRoute(absoluteUrl.pathname) && !isHtmlResponse(response)) return;
  const html = await response.clone().text();
  const staticUrls = extractSameOriginStaticUrls(html);
  for (const staticUrl of staticUrls) {
    await precacheUrl(cache, seen, staticUrl);
  }
}

function isShellRoute(pathname) {
  return SHELL_ROUTE_URLS.includes(pathname);
}

function isHtmlResponse(response) {
  return (response.headers.get("content-type") || "").includes("text/html");
}

function extractSameOriginStaticUrls(html) {
  const urls = [];
  const attributePattern = /\b(?:src|href)=["']([^"']+)["']/g;
  let match;
  while ((match = attributePattern.exec(html)) !== null) {
    const url = new URL(match[1], self.location.origin);
    if (url.origin !== self.location.origin) continue;
    if (!STATIC_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) continue;
    urls.push(url.href);
  }
  return urls;
}
