/*
 * Local-first PWA cache.
 * - install stores only public app resources, never authenticated navigation HTML;
 * - trusted client state sends the active account + snapshot-backed routes after
 *   auth/snapshot hydration, and navigation responses live in an account-scoped cache;
 * - hashed static assets (_next/static, icons, library media) remain cache-first;
 * - /api and remote requests are never intercepted or cached by the service worker.
 */
const STATIC_CACHE = "trainer-static-v3";
const ACCOUNT_META_CACHE = "trainer-account-meta-v3";
const NAVIGATION_CACHE_PREFIX = "trainer-nav-v3-";
const LEGACY_CACHE_NAMES = ["trainer-shell-v2"];
const NAVIGATION_TIMEOUT_MS = 1800;
// /login is public HTML, so it is safe in the shared static cache, and it keeps the app
// reachable offline on a device that has not synced an account yet.
const PUBLIC_SHELL_URLS = ["/login", "/manifest.webmanifest", "/icons/icon.svg"];
const STATIC_CACHE_PREFIXES = ["/_next/static/", "/icons/", "/library/"];
const ACTIVE_ACCOUNT_CACHE_URL = "/__trainer_sw/active-account";
const APP_ENTRY_URL = "/hoy";
const LOGIN_URL = "/login";
const OFFLINE_HTML = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#171613;color:#f5f2ec;font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center}a{color:#e8663a}</style></head><body><div><p>Esta pantalla todavía no está guardada para usarla sin conexión.</p><p><a href="/hoy">Volver a Inicio</a></p></div></body></html>';

let activeNavigationCacheName = null;
let accountShellGeneration = 0;
let accountShellPrecacheController = null;
let navigationWriteTail = Promise.resolve();

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(precachePublicShell());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => LEGACY_CACHE_NAMES.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "TRAINER_PRECACHE_ACCOUNT_SHELL") {
    event.waitUntil(activateAccountShell(data.userId, Array.isArray(data.routes) ? data.routes : []));
    return;
  }
  if (data.type === "TRAINER_CLEAR_ACCOUNT_SHELL") {
    event.waitUntil(clearAccountShell());
  }
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
  if (isStaticUrl(url)) {
    event.respondWith(cacheFirst(request));
  }
});

async function activateAccountShell(userId, routes) {
  if (typeof userId !== "string" || userId.trim() === "") return;
  accountShellGeneration += 1;
  accountShellPrecacheController?.abort();
  const generation = accountShellGeneration;
  const controller = new AbortController();
  accountShellPrecacheController = controller;
  const cacheName = accountNavigationCacheName(userId);
  activeNavigationCacheName = cacheName;
  await navigationWriteTail;
  if (!isCurrentAccountShellGeneration(generation)) return;
  await deleteOtherAccountShells(cacheName);
  if (!isCurrentAccountShellGeneration(generation)) return;

  const navigationCache = await caches.open(cacheName);
  const staticCache = await caches.open(STATIC_CACHE);
  const seen = new Set();
  for (const route of routes) {
    if (!isCurrentAccountShellGeneration(generation)) return;
    await precacheNavigationUrl(navigationCache, staticCache, seen, route, generation, controller.signal);
  }
  if (!isCurrentAccountShellGeneration(generation)) return;
  await persistActiveAccountShell(cacheName);
  if (isCurrentAccountShellGeneration(generation)) accountShellPrecacheController = null;
}

async function clearAccountShell() {
  accountShellGeneration += 1;
  accountShellPrecacheController?.abort();
  accountShellPrecacheController = null;
  activeNavigationCacheName = null;
  const pendingNavigationWrites = navigationWriteTail;
  await pendingNavigationWrites;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key === ACCOUNT_META_CACHE || key.startsWith(NAVIGATION_CACHE_PREFIX))
      .map((key) => caches.delete(key))
  );
}

async function deleteOtherAccountShells(cacheNameToKeep) {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(NAVIGATION_CACHE_PREFIX) && key !== cacheNameToKeep)
      .map((key) => caches.delete(key))
  );
}

function accountNavigationCacheName(userId) {
  return `${NAVIGATION_CACHE_PREFIX}${userId.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96)}`;
}

function isCurrentAccountShellGeneration(generation) {
  return generation === accountShellGeneration;
}

async function persistActiveAccountShell(cacheName) {
  const cache = await caches.open(ACCOUNT_META_CACHE);
  await cache.put(new Request(new URL(ACTIVE_ACCOUNT_CACHE_URL, self.location.origin).href), new Response(cacheName, { headers: { "content-type": "text/plain" } }));
}

async function getActiveNavigationCacheName() {
  if (activeNavigationCacheName) return activeNavigationCacheName;
  const cache = await caches.open(ACCOUNT_META_CACHE);
  const response = await cache.match(new Request(new URL(ACTIVE_ACCOUNT_CACHE_URL, self.location.origin).href));
  if (!response) return null;
  const cacheName = await response.text();
  if (!cacheName.startsWith(NAVIGATION_CACHE_PREFIX)) return null;
  activeNavigationCacheName = cacheName;
  return cacheName;
}

async function networkFirst(request, event) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
  try {
    const cacheGeneration = accountShellGeneration;
    const response = await Promise.race([
      fetch(new Request(request, { signal: controller.signal })),
      new Promise((_, reject) => setTimeout(() => reject(new Error("navigation_timeout")), NAVIGATION_TIMEOUT_MS))
    ]);
    const cacheName = await getActiveNavigationCacheName();
    if (response.ok && cacheName && isCurrentAccountShellGeneration(cacheGeneration)) {
      event.waitUntil(queueNavigationCacheResponse(cacheName, cacheGeneration, request, response.clone()));
    }
    return response;
  } catch {
    return offlineNavigationFallback(request);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Never rejects: a rejected respondWith is what produced Safari's
 * "FetchEvent.respondWith received an error" page instead of the app.
 * Exact URL → same pathname (query strings never change the cached shell,
 * every route builds its screen client-side from the local snapshot) →
 * "/" redirected to the app entry the server would redirect to anyway →
 * a plain offline notice for routes that were never precached.
 */
async function offlineNavigationFallback(request) {
  const cacheName = await getActiveNavigationCacheName();
  if (cacheName) {
    const accountShell = await matchNavigationInCache(cacheName, request);
    if (accountShell) return accountShell;
  }
  // The public shell never holds account HTML, so falling through to it cannot leak one
  // account's screens to another — it only ever answers with /login.
  const publicShell = await matchNavigationInCache(STATIC_CACHE, request);
  if (publicShell) return publicShell;

  if (new URL(request.url).pathname === "/") {
    const redirectTo = cacheName && (await matchNavigationInCache(cacheName, absoluteRequest(APP_ENTRY_URL)))
      ? APP_ENTRY_URL
      : (await matchNavigationInCache(STATIC_CACHE, absoluteRequest(LOGIN_URL))) ? LOGIN_URL : null;
    if (redirectTo) return Response.redirect(new URL(redirectTo, self.location.origin).href, 302);
  }
  return new Response(OFFLINE_HTML, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
}

function absoluteRequest(url) {
  return new Request(new URL(url, self.location.origin).href);
}

/** Exact URL, then any cached entry sharing the pathname. Mirrors findSamePathnameCacheUrl
 * in src/lib/offline/cache-fallback.ts: query strings never change the cached shell, since
 * every route builds its screen client-side from the local snapshot. */
async function matchNavigationInCache(cacheName, request) {
  const cache = await caches.open(cacheName);
  // ignoreVary: Next sends "Vary: RSC, Next-Router-State-Tree, …" and a precached entry was
  // stored under a plain fetch, so a strict Vary match can miss the right shell for this URL.
  const exact = await cache.match(request, { ignoreVary: true });
  if (exact) return exact;

  const targetPathname = new URL(request.url).pathname;
  const keys = await cache.keys();
  const samePathname = keys.find((key) => new URL(key.url).pathname === targetPathname);
  if (!samePathname) return null;
  return (await cache.match(samePathname)) || null;
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    // Same reason as offlineNavigationFallback: a thrown respondWith for a
    // missing chunk breaks the whole page instead of just that asset.
    return new Response("", { status: 504 });
  }
}

async function cacheNavigationResponse(cacheName, generation, request, response) {
  if (!isCurrentAccountShellGeneration(generation) || activeNavigationCacheName !== cacheName) return;
  const cache = await caches.open(cacheName);
  if (!isCurrentAccountShellGeneration(generation) || activeNavigationCacheName !== cacheName) return;
  await cache.put(request, response);
}

function queueNavigationCacheResponse(cacheName, generation, request, response) {
  const write = navigationWriteTail.then(() => cacheNavigationResponse(cacheName, generation, request, response));
  navigationWriteTail = write.catch(() => {});
  return write;
}

async function precachePublicShell() {
  const cache = await caches.open(STATIC_CACHE);
  const seen = new Set();
  for (const url of PUBLIC_SHELL_URLS) {
    await precachePublicUrl(cache, seen, url);
  }
}

async function precacheNavigationUrl(navigationCache, staticCache, seen, url, generation, signal) {
  const absoluteUrl = new URL(url, self.location.origin);
  if (!isSameOriginNonApi(absoluteUrl)) return;
  const cacheKey = absoluteUrl.href;
  if (seen.has(cacheKey)) return;
  seen.add(cacheKey);

  if (!isCurrentAccountShellGeneration(generation)) return;
  let response;
  try {
    response = await fetch(new Request(cacheKey, { signal }));
  } catch {
    return;
  }
  if (!isCurrentAccountShellGeneration(generation)) return;
  if (!response.ok) return;
  await navigationCache.put(new Request(cacheKey), response.clone());
  if (!isCurrentAccountShellGeneration(generation)) return;

  if (!isHtmlResponse(response)) return;
  const html = await response.clone().text();
  if (!isCurrentAccountShellGeneration(generation)) return;
  const staticUrls = extractSameOriginStaticUrls(html);
  for (const staticUrl of staticUrls) {
    if (!isCurrentAccountShellGeneration(generation)) return;
    await precachePublicUrl(staticCache, seen, staticUrl);
  }
}

async function precachePublicUrl(cache, seen, url) {
  const absoluteUrl = new URL(url, self.location.origin);
  if (!isSameOriginNonApi(absoluteUrl)) return;
  const cacheKey = absoluteUrl.href;
  if (seen.has(cacheKey)) return;
  seen.add(cacheKey);

  // One unreachable entry must not reject install: a failed install leaves the device with
  // no service worker at all, which is strictly worse than a shell missing one URL.
  let response;
  try {
    response = await fetch(cacheKey);
  } catch {
    return;
  }
  if (!response.ok) return;
  await cache.put(new Request(cacheKey), response.clone());

  // A cached /login without its chunks renders but never hydrates, so the form stays dead
  // once the network is back. Non-HTML entries stop here: their bodies have no such refs.
  if (!isHtmlResponse(response)) return;
  for (const staticUrl of extractSameOriginStaticUrls(await response.clone().text())) {
    await precachePublicUrl(cache, seen, staticUrl);
  }
}

function isSameOriginNonApi(url) {
  return url.origin === self.location.origin && !url.pathname.startsWith("/api/");
}

function isStaticUrl(url) {
  return STATIC_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
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
    if (!isSameOriginNonApi(url)) continue;
    if (!isStaticUrl(url)) continue;
    urls.push(url.href);
  }
  return urls;
}
