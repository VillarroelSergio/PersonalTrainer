import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type ResponseFixture = string | { body: string | Promise<string>; onFetch?: (request: Request | string) => void };

type SwEventMap = {
  install: Array<{ waitUntil(promise: Promise<unknown>): void }>;
  activate: Array<{ waitUntil(promise: Promise<unknown>): void }>;
  fetch: Array<{ request: Request; respondWith(promise: Promise<Response>): void; waitUntil(promise: Promise<unknown>): void }>;
  message: Array<{ data: unknown; waitUntil(promise: Promise<unknown>): void }>;
};

class MemoryCache {
  readonly urls = new Set<string>();
  readonly responses = new Map<string, Response>();

  constructor(
    private readonly fetcher: (request: Request | string) => Promise<Response>,
    private readonly beforePut?: () => Promise<void>
  ) {}

  async addAll(urls: string[]) {
    for (const url of urls) {
      const response = await this.fetcher(url);
      this.urls.add(url);
      this.responses.set(new URL(url, "https://trainer.test").href, response.clone());
    }
  }

  async put(request: Request, response: Response) {
    await this.beforePut?.();
    const url = new URL(request.url);
    this.urls.add(`${url.pathname}${url.search}`);
    this.responses.set(request.url, response);
  }

  async match(request: Request) {
    const url = new URL(request.url);
    return this.responses.get(request.url) ?? this.responses.get(`${url.pathname}${url.search}`);
  }

  async keys() {
    return [...this.responses.keys()].map((url) => new Request(url));
  }
}

function loadServiceWorker(responses: Record<string, ResponseFixture> = {}, existingCachesByName?: Map<string, MemoryCache>) {
  const listeners = new Map<keyof SwEventMap, Array<(event: never) => void>>();
  const cachesByName = existingCachesByName ?? new Map<string, MemoryCache>();
  const openGates = new Map<string, Array<Promise<void>>>();
  const putGates = new Map<string, Array<{ promise: Promise<void>; started: () => void }>>();
  const fetched: string[] = [];
  let offline = false;
  const fetcher = vi.fn(async (request: Request | string) => {
    const url = typeof request === "string" ? request : request.url;
    const parsedUrl = new URL(url, "https://trainer.test");
    const pathname = parsedUrl.pathname;
    const pathAndSearch = `${pathname}${parsedUrl.search}`;
    fetched.push(pathAndSearch);
    if (offline) throw new Error(`offline:${pathAndSearch}`);
    const fixture = responses[pathAndSearch] ?? responses[pathname] ?? `ok:${url}`;
    if (typeof fixture === "object") fixture.onFetch?.(request);
    const body = typeof fixture === "object" ? await fixture.body : fixture;
    return new Response(body, {
      status: 200,
      headers: { "content-type": pathname.endsWith(".js") ? "application/javascript" : "text/html" }
    });
  });
  const caches = {
    keys: vi.fn(async () => [...cachesByName.keys()]),
    delete: vi.fn(async (key: string) => cachesByName.delete(key)),
    open: vi.fn(async (key: string) => {
      const gate = openGates.get(key)?.shift();
      if (gate) await gate;
      let cache = cachesByName.get(key);
      if (!cache) {
        cache = new MemoryCache(fetcher, async () => {
          const gate = putGates.get(key)?.shift();
          if (!gate) return;
          gate.started();
          await gate.promise;
        });
        cachesByName.set(key, cache);
      }
      return cache;
    }),
    match: vi.fn(async (request: Request) => {
      for (const cache of cachesByName.values()) {
        const response = await cache.match(request);
        if (response) return response;
      }
      return undefined;
    })
  };
  const self = {
    location: { origin: "https://trainer.test" },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => undefined) },
    addEventListener: vi.fn((type: keyof SwEventMap, listener: (event: never) => void) => {
      const existing = listeners.get(type) ?? [];
      existing.push(listener);
      listeners.set(type, existing);
    })
  };
  const context = vm.createContext({ self, caches, fetch: fetcher, Request, Response, URL, Error, Promise, AbortController, setTimeout, clearTimeout });
  const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  vm.runInContext(source, context);

  async function dispatchInstall() {
    const waits: Array<Promise<unknown>> = [];
    const event = { waitUntil: (promise: Promise<unknown>) => waits.push(promise) };
    for (const listener of listeners.get("install") ?? []) listener(event as never);
    await Promise.all(waits);
  }

  async function dispatchMessage(data: unknown) {
    const waits: Array<Promise<unknown>> = [];
    const event = { data, waitUntil: (promise: Promise<unknown>) => waits.push(promise) };
    for (const listener of listeners.get("message") ?? []) listener(event as never);
    await Promise.all(waits);
  }

  function dispatchFetch(request: Request) {
    const responses: Array<Promise<Response>> = [];
    const waits: Array<Promise<unknown>> = [];
    const event = { request, respondWith: (promise: Promise<Response>) => responses.push(promise), waitUntil: (promise: Promise<unknown>) => waits.push(promise) };
    for (const listener of listeners.get("fetch") ?? []) listener(event as never);
    return Object.assign(responses, { waits });
  }

  function goOffline() {
    offline = true;
  }

  function deferNextCacheOpen(cacheName: string) {
    let resolve!: () => void;
    const promise = new Promise<void>((resolver) => { resolve = resolver; });
    const gates = openGates.get(cacheName) ?? [];
    gates.push(promise);
    openGates.set(cacheName, gates);
    return { resolve };
  }

  function deferNextCachePut(cacheName: string) {
    let resolve!: () => void;
    let markStarted!: () => void;
    const promise = new Promise<void>((resolver) => { resolve = resolver; });
    const started = new Promise<void>((resolver) => { markStarted = resolver; });
    const gates = putGates.get(cacheName) ?? [];
    gates.push({ promise, started: markStarted });
    putGates.set(cacheName, gates);
    return { resolve, started };
  }

  return { cachesByName, deferNextCacheOpen, deferNextCachePut, dispatchFetch, dispatchInstall, dispatchMessage, fetched, goOffline };
}

describe("service worker shell cache", () => {
  it("installs only public app resources until trusted account state supplies private routes", async () => {
    const sw = loadServiceWorker();

    await sw.dispatchInstall();

    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).toEqual(expect.arrayContaining(["/manifest.webmanifest", "/icons/icon.svg"]));
    expect(cachedUrls).not.toEqual(expect.arrayContaining(["/hoy", "/plan", "/ejercicios", "/historial", "/entrenar", "/checkin", "/recuperar", "/resistencia"]));
    expect(cachedUrls.some((url) => url.startsWith("/api/"))).toBe(false);
  });

  it("precaches every snapshot-backed operational route required from /hoy for the active account only", async () => {
    const sw = loadServiceWorker();

    await sw.dispatchInstall();
    await sw.dispatchMessage({
      type: "TRAINER_PRECACHE_ACCOUNT_SHELL",
      userId: "account-a",
      routes: ["/hoy", "/plan", "/ejercicios", "/historial", "/checkin", "/entrenar?session=0", "/entrenar?session=0&addons=1", "/recuperar?session=0", "/resistencia?session=1"]
    });

    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).toEqual(expect.arrayContaining([
      "/hoy",
      "/plan",
      "/ejercicios",
      "/historial",
      "/checkin",
      "/entrenar?session=0",
      "/entrenar?session=0&addons=1",
      "/recuperar?session=0",
      "/resistencia?session=1"
    ]));
    expect(cachedUrls).not.toContain("/recuperar");
  });

  it("serves every prepared operational route on the first offline navigation", async () => {
    const routes = ["/hoy", "/plan", "/ejercicios", "/historial", "/checkin", "/entrenar?session=0", "/entrenar?session=0&addons=1", "/recuperar?session=0", "/resistencia?session=1"];
    const sw = loadServiceWorker(Object.fromEntries(routes.map((route) => [route, `<!doctype html><main>${route}</main>`])));

    await sw.dispatchInstall();
    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes });
    sw.goOffline();

    for (const route of routes) {
      const request = new Request(`https://trainer.test${route}`, { method: "GET" });
      Object.defineProperty(request, "mode", { value: "navigate" });
      const [navigationResponse] = sw.dispatchFetch(request);

      await expect(navigationResponse.then((response) => response.text())).resolves.toBe(`<!doctype html><main>${route}</main>`);
    }
  });

  it("serves an offline navigation whose query string was never precached from the same pathname", async () => {
    const sw = loadServiceWorker({ "/plan": "<!doctype html><main>plan</main>", "/hoy": "<!doctype html><main>hoy</main>" });

    await sw.dispatchInstall();
    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: ["/hoy", "/plan"] });
    sw.goOffline();

    const request = new Request("https://trainer.test/plan?vista=fases&week=2", { method: "GET" });
    Object.defineProperty(request, "mode", { value: "navigate" });
    const [response] = sw.dispatchFetch(request);

    await expect(response.then((served) => served.text())).resolves.toBe("<!doctype html><main>plan</main>");
  });

  it("redirects an offline navigation to / towards the cached app entry instead of failing", async () => {
    const sw = loadServiceWorker({ "/hoy": "<!doctype html><main>hoy</main>" });

    await sw.dispatchInstall();
    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: ["/hoy"] });
    sw.goOffline();

    const request = new Request("https://trainer.test/", { method: "GET" });
    Object.defineProperty(request, "mode", { value: "navigate" });
    const [response] = sw.dispatchFetch(request);
    const served = await response;

    expect(served.status).toBe(302);
    expect(served.headers.get("location")).toBe("https://trainer.test/hoy");
  });

  it("answers an offline navigation to a route that was never precached instead of rejecting", async () => {
    const sw = loadServiceWorker({ "/hoy": "<!doctype html><main>hoy</main>" });

    await sw.dispatchInstall();
    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: ["/hoy"] });
    sw.goOffline();

    const request = new Request("https://trainer.test/ejercicios/press-banca", { method: "GET" });
    Object.defineProperty(request, "mode", { value: "navigate" });
    const [response] = sw.dispatchFetch(request);
    const served = await response;

    expect(served.status).toBe(503);
    expect(await served.text()).toContain("sin conexión");
  });

  it("leaves API requests entirely to the browser instead of intercepting or caching them", () => {
    const sw = loadServiceWorker();

    const responses = sw.dispatchFetch(new Request("https://trainer.test/api/v1/offline-snapshot", { method: "GET" }));

    expect(responses).toHaveLength(0);
    expect(sw.fetched).toEqual([]);
  });

  it("prepares a usable offline route shell by caching the Next static resources referenced by account route HTML", async () => {
    const sw = loadServiceWorker({
      "/hoy": `
        <!doctype html>
        <html>
          <head>
            <link rel="stylesheet" href="/_next/static/css/app.css" />
            <link rel="preload" href="/_next/static/chunks/runtime.js" as="script" />
          </head>
          <body>
            <script src="/_next/static/chunks/app/hoy/page.js"></script>
            <script src="/api/v1/offline-snapshot"></script>
            <script src="https://analytics.example/remote.js"></script>
          </body>
        </html>
      `,
      "/_next/static/css/app.css": "body{background:#100f0d}",
      "/_next/static/chunks/runtime.js": "runtime",
      "/_next/static/chunks/app/hoy/page.js": "hoy-page"
    });

    await sw.dispatchInstall();
    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: ["/hoy"] });
    sw.goOffline();

    const [chunkResponse] = sw.dispatchFetch(new Request("https://trainer.test/_next/static/chunks/app/hoy/page.js"));

    await expect(chunkResponse.then((response) => response.text())).resolves.toBe("hoy-page");
    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).toEqual(expect.arrayContaining(["/_next/static/css/app.css", "/_next/static/chunks/runtime.js", "/_next/static/chunks/app/hoy/page.js"]));
    expect(cachedUrls.some((url) => url.startsWith("/api/") || url.startsWith("https://analytics.example"))).toBe(false);
  });

  it("does not serve account A cached navigation responses under account B or after account clear", async () => {
    const sw = loadServiceWorker({ "/hoy": "<!doctype html><main>Cuenta A</main>" });

    await sw.dispatchInstall();
    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: ["/hoy"] });
    sw.goOffline();

    const requestA = new Request("https://trainer.test/hoy", { method: "GET" });
    Object.defineProperty(requestA, "mode", { value: "navigate" });
    const [accountAResponse] = sw.dispatchFetch(requestA);
    await expect(accountAResponse.then((response) => response.text())).resolves.toBe("<!doctype html><main>Cuenta A</main>");

    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-b", routes: [] });
    const requestB = new Request("https://trainer.test/hoy", { method: "GET" });
    Object.defineProperty(requestB, "mode", { value: "navigate" });
    // Account B gets the generic offline notice, never account A's HTML. It is a
    // served response rather than a rejection on purpose: a rejected respondWith
    // shows Safari's "FetchEvent.respondWith received an error" page.
    const [accountBResponse] = sw.dispatchFetch(requestB);
    const accountB = await accountBResponse;
    expect(accountB.status).toBe(503);
    expect(await accountB.text()).not.toContain("Cuenta A");

    await sw.dispatchMessage({ type: "TRAINER_CLEAR_ACCOUNT_SHELL" });
    const requestCleared = new Request("https://trainer.test/hoy", { method: "GET" });
    Object.defineProperty(requestCleared, "mode", { value: "navigate" });
    const [clearedResponse] = sw.dispatchFetch(requestCleared);
    const cleared = await clearedResponse;
    expect(cleared.status).toBe(503);
    expect(await cleared.text()).not.toContain("Cuenta A");
  });

  it("aborts an in-flight account precache and does not retain stale account HTML after clear", async () => {
    let resolveRoute!: (body: string) => void;
    let fetchedRoute!: Request | string;
    let markRouteStarted!: () => void;
    const routeStarted = new Promise<void>((resolve) => { markRouteStarted = resolve; });
    const routeBody = new Promise<string>((resolver) => { resolveRoute = resolver; });
    const sw = loadServiceWorker({
      "/hoy": {
        body: routeBody,
        onFetch: (request) => {
          fetchedRoute = request;
          markRouteStarted();
        }
      }
    });

    await sw.dispatchInstall();
    const precache = sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: ["/hoy"] });
    await routeStarted;
    await sw.dispatchMessage({ type: "TRAINER_CLEAR_ACCOUNT_SHELL" });
    expect(typeof fetchedRoute).not.toBe("string");
    expect((fetchedRoute as Request).signal.aborted).toBe(true);
    resolveRoute("<!doctype html><main>stale A</main>");
    await precache;
    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).not.toContain("/hoy");
  });

  it("does not recreate an old account navigation cache when a network-first write finishes after clear", async () => {
    const sw = loadServiceWorker({ "/plan": "<!doctype html><main>stale account A plan</main>" });

    await sw.dispatchInstall();
    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: [] });
    const cacheWriteGate = sw.deferNextCacheOpen("trainer-nav-v3-account-a");
    const request = new Request("https://trainer.test/plan", { method: "GET" });
    Object.defineProperty(request, "mode", { value: "navigate" });
    const navigation = sw.dispatchFetch(request);
    const [onlineResponse] = navigation;
    await expect(onlineResponse.then((response) => response.text())).resolves.toBe("<!doctype html><main>stale account A plan</main>");

    const clear = sw.dispatchMessage({ type: "TRAINER_CLEAR_ACCOUNT_SHELL" });
    cacheWriteGate.resolve();
    await Promise.all([clear, ...navigation.waits]);

    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).not.toContain("/plan");
    expect([...sw.cachesByName.keys()]).not.toContain("trainer-nav-v3-account-a");
  });

  it("waits for an in-flight network-first write before deleting the old account cache", async () => {
    const sw = loadServiceWorker({ "/plan": "<!doctype html><main>stale account A plan</main>" });

    await sw.dispatchInstall();
    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: [] });
    const putGate = sw.deferNextCachePut("trainer-nav-v3-account-a");
    const request = new Request("https://trainer.test/plan", { method: "GET" });
    Object.defineProperty(request, "mode", { value: "navigate" });
    const navigation = sw.dispatchFetch(request);
    const [onlineResponse] = navigation;
    await expect(onlineResponse.then((response) => response.text())).resolves.toBe("<!doctype html><main>stale account A plan</main>");
    await putGate.started;

    const clear = sw.dispatchMessage({ type: "TRAINER_CLEAR_ACCOUNT_SHELL" });
    putGate.resolve();
    await Promise.all([clear, ...navigation.waits]);

    expect([...sw.cachesByName.keys()]).not.toContain("trainer-nav-v3-account-a");
    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).not.toContain("/plan");
  });

  it("serves the account shell after a service worker restart by restoring the trusted active account", async () => {
    const firstWorker = loadServiceWorker({ "/hoy": "<!doctype html><main>Cuenta A persistida</main>" });

    await firstWorker.dispatchInstall();
    await firstWorker.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: ["/hoy"] });

    const restartedWorker = loadServiceWorker({}, firstWorker.cachesByName);
    restartedWorker.goOffline();
    const request = new Request("https://trainer.test/hoy", { method: "GET" });
    Object.defineProperty(request, "mode", { value: "navigate" });
    const [navigationResponse] = restartedWorker.dispatchFetch(request);

    await expect(navigationResponse.then((response) => response.text())).resolves.toBe("<!doctype html><main>Cuenta A persistida</main>");
  });

  it("serves a generic prepared recovery client shell offline without caching the bare /recuperar redirect", async () => {
    const sw = loadServiceWorker({
      "/recuperar": "<!doctype html><main>redirect:/hoy</main>",
      "/recuperar?session=2": "<!doctype html><main data-route=\"recuperar\"></main>"
    });

    await sw.dispatchInstall();
    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: ["/recuperar?session=2"] });
    sw.goOffline();

    const request = new Request("https://trainer.test/recuperar?session=2", { method: "GET" });
    Object.defineProperty(request, "mode", { value: "navigate" });
    const [navigationResponse] = sw.dispatchFetch(request);

    await expect(navigationResponse.then((response) => response.text())).resolves.toBe("<!doctype html><main data-route=\"recuperar\"></main>");
    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).toContain("/recuperar?session=2");
    expect(cachedUrls).not.toContain("/recuperar");
  });

  it("serves the exact optional add-ons training route offline after account shell preparation", async () => {
    const sw = loadServiceWorker({
      "/entrenar?session=0": "<!doctype html><main>Entrenar base</main>",
      "/entrenar?session=0&addons=1": "<!doctype html><main>Entrenar con extras</main>"
    });

    await sw.dispatchInstall();
    await sw.dispatchMessage({ type: "TRAINER_PRECACHE_ACCOUNT_SHELL", userId: "account-a", routes: ["/entrenar?session=0&addons=1"] });
    sw.goOffline();

    const request = new Request("https://trainer.test/entrenar?session=0&addons=1", { method: "GET" });
    Object.defineProperty(request, "mode", { value: "navigate" });
    const [navigationResponse] = sw.dispatchFetch(request);

    await expect(navigationResponse.then((response) => response.text())).resolves.toBe("<!doctype html><main>Entrenar con extras</main>");
  });
});
