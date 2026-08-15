/**
 * Given the cached navigation URLs and the just-requested URL, finds a cached entry for the
 * same pathname (ignoring the query string) — e.g. a previous visit to `/entrenar?session=0`
 * satisfies a later offline request for `/entrenar?session=3` that was never itself cached, now
 * that `/entrenar` builds its screen client-side from the local snapshot instead of from a
 * server-rendered payload keyed by the query string.
 *
 * Pure so it's unit-testable. `apps/web/public/sw.js` can't import ES modules without a bundler
 * (service workers here run unbundled), so it inlines the same algorithm directly in its
 * `networkFirst` fallback — keep the two in sync if this logic ever changes.
 */
export function findSamePathnameCacheUrl(cacheUrls: string[], targetUrl: string): string | null {
  const targetPathname = new URL(targetUrl).pathname;
  const match = cacheUrls.find((url) => new URL(url).pathname === targetPathname);
  return match ?? null;
}
