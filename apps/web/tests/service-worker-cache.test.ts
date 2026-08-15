import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

type SwEventMap = {
  install: Array<{ waitUntil(promise: Promise<unknown>): void }>;
  activate: Array<{ waitUntil(promise: Promise<unknown>): void }>;
  fetch: Array<{ request: Request; respondWith(promise: Promise<Response>): void }>;
};

class MemoryCache {
  readonly urls = new Set<string>();
  readonly responses = new Map<string, Response>();

  constructor(private readonly fetcher: (request: Request | string) => Promise<Response>) {}

  async addAll(urls: string[]) {
    for (const url of urls) {
      const response = await this.fetcher(url);
      this.urls.add(url);
      this.responses.set(new URL(url, "https://trainer.test").href, response.clone());
    }
  }

  async put(request: Request, response: Response) {
    this.urls.add(new URL(request.url).pathname);
    this.responses.set(request.url, response);
  }

  async match(request: Request) {
    return this.responses.get(request.url) ?? this.responses.get(new URL(request.url).pathname);
  }

  async keys() {
    return [...this.responses.keys()].map((url) => new Request(url));
  }
}

function loadServiceWorker(responses: Record<string, string> = {}) {
  const listeners = new Map<keyof SwEventMap, Array<(event: never) => void>>();
  const cachesByName = new Map<string, MemoryCache>();
  const fetched: string[] = [];
  let offline = false;
  const fetcher = vi.fn(async (request: Request | string) => {
    const url = typeof request === "string" ? request : request.url;
    const pathname = new URL(url, "https://trainer.test").pathname;
    fetched.push(pathname);
    if (offline) throw new Error(`offline:${pathname}`);
    return new Response(responses[pathname] ?? `ok:${url}`, {
      status: 200,
      headers: { "content-type": pathname.endsWith(".js") ? "application/javascript" : "text/html" }
    });
  });
  const caches = {
    keys: vi.fn(async () => [...cachesByName.keys()]),
    delete: vi.fn(async (key: string) => cachesByName.delete(key)),
    open: vi.fn(async (key: string) => {
      let cache = cachesByName.get(key);
      if (!cache) {
        cache = new MemoryCache(fetcher);
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

  function dispatchFetch(request: Request) {
    const responses: Array<Promise<Response>> = [];
    const event = { request, respondWith: (promise: Promise<Response>) => responses.push(promise) };
    for (const listener of listeners.get("fetch") ?? []) listener(event as never);
    return responses;
  }

  function goOffline() {
    offline = true;
  }

  return { cachesByName, dispatchFetch, dispatchInstall, fetched, goOffline };
}

describe("service worker shell cache", () => {
  it("precaches the installed app shell for first offline navigation without caching API payloads", async () => {
    const sw = loadServiceWorker();

    await sw.dispatchInstall();

    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).toEqual(expect.arrayContaining(["/hoy", "/plan", "/ejercicios", "/historial", "/manifest.webmanifest", "/icons/icon.svg"]));
    expect(cachedUrls.some((url) => url.startsWith("/api/"))).toBe(false);
  });

  it("precaches every snapshot-backed operational route required from /hoy", async () => {
    const sw = loadServiceWorker();

    await sw.dispatchInstall();

    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).toEqual(expect.arrayContaining([
      "/hoy",
      "/plan",
      "/ejercicios",
      "/historial",
      "/entrenar",
      "/checkin",
      "/recuperar",
      "/resistencia"
    ]));
  });

  it("leaves API requests entirely to the browser instead of intercepting or caching them", () => {
    const sw = loadServiceWorker();

    const responses = sw.dispatchFetch(new Request("https://trainer.test/api/v1/offline-snapshot", { method: "GET" }));

    expect(responses).toHaveLength(0);
    expect(sw.fetched).toEqual([]);
  });

  it("installs a usable offline route shell by caching the Next static resources referenced by route HTML", async () => {
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
    sw.goOffline();

    const [chunkResponse] = sw.dispatchFetch(new Request("https://trainer.test/_next/static/chunks/app/hoy/page.js"));

    await expect(chunkResponse.then((response) => response.text())).resolves.toBe("hoy-page");
    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).toEqual(expect.arrayContaining(["/_next/static/css/app.css", "/_next/static/chunks/runtime.js", "/_next/static/chunks/app/hoy/page.js"]));
    expect(cachedUrls.some((url) => url.startsWith("/api/") || url.startsWith("https://analytics.example"))).toBe(false);
  });

  it("serves a snapshot-backed action route offline even when that exact query URL was never visited", async () => {
    const sw = loadServiceWorker({ "/entrenar": "<!doctype html><main>Entrenar shell</main>" });

    await sw.dispatchInstall();
    sw.goOffline();

    const request = new Request("https://trainer.test/entrenar?session=0", { method: "GET" });
    Object.defineProperty(request, "mode", { value: "navigate" });
    const [navigationResponse] = sw.dispatchFetch(request);

    await expect(navigationResponse.then((response) => response.text())).resolves.toBe("<!doctype html><main>Entrenar shell</main>");
  });
});
