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

function loadServiceWorker() {
  const listeners = new Map<keyof SwEventMap, Array<(event: never) => void>>();
  const cachesByName = new Map<string, MemoryCache>();
  const fetched: string[] = [];
  const fetcher = vi.fn(async (request: Request | string) => {
    const url = typeof request === "string" ? request : request.url;
    fetched.push(new URL(url, "https://trainer.test").pathname);
    return new Response(`ok:${url}`, { status: 200 });
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
  const context = vm.createContext({ self, caches, fetch: fetcher, Request, Response, URL, Error, Promise, setTimeout, clearTimeout });
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

  return { cachesByName, dispatchFetch, dispatchInstall, fetched };
}

describe("service worker shell cache", () => {
  it("precaches the installed app shell for first offline navigation without caching API payloads", async () => {
    const sw = loadServiceWorker();

    await sw.dispatchInstall();

    const cachedUrls = [...sw.cachesByName.values()].flatMap((cache) => [...cache.urls]);
    expect(cachedUrls).toEqual(expect.arrayContaining(["/hoy", "/plan", "/ejercicios", "/historial", "/manifest.webmanifest", "/icons/icon.svg"]));
    expect(cachedUrls.some((url) => url.startsWith("/api/"))).toBe(false);
  });

  it("leaves API requests entirely to the browser instead of intercepting or caching them", () => {
    const sw = loadServiceWorker();

    const responses = sw.dispatchFetch(new Request("https://trainer.test/api/v1/offline-snapshot", { method: "GET" }));

    expect(responses).toHaveLength(0);
    expect(sw.fetched).toEqual([]);
  });
});
