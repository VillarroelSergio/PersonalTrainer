function isPrivateIpv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;

  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

/**
 * The PWA is often opened from a phone on the same Wi-Fi while Next runs on a
 * development machine. Better Auth validates Origin, so the LAN address needs
 * to be accepted too. Keep this deliberately limited to HTTP loopback/private
 * network origins; production only trusts its configured public origin.
 */
export function isTrustedDevelopmentOrigin(origin: string | null | undefined) {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return false;
    return url.hostname === "localhost"
      || url.hostname === "127.0.0.1"
      || url.hostname === "0.0.0.0"
      || url.hostname === "::1"
      || isPrivateIpv4(url.hostname);
  } catch {
    return false;
  }
}
