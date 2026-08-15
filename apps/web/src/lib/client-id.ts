/**
 * `crypto.randomUUID()` throws outside a secure context (e.g. plain HTTP on a
 * LAN IP), which is how the app gets opened from a phone during dev/testing.
 * Falls back to a non-cryptographic id in that case — fine for client-only
 * operation/dedup ids, never use this for anything security-sensitive.
 */
export function createClientId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}
