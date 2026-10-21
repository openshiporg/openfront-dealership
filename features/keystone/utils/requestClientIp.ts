import { isIP } from "node:net";

/** Numeric addresses only: no hostnames, ports, brackets, zone IDs or DNS lookup. */
export function normalizeIp(value: unknown): string | undefined {
  if (typeof value !== "string" || value.includes("%") || !isIP(value)) return undefined;
  if (isIP(value) === 4) return value;
  // WHATWG URL serialization canonicalizes equivalent IPv6 spellings locally.
  const canonical = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
  if (mapped) {
    const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
    return [high >>> 8, high & 255, low >>> 8, low & 255].join(".");
  }
  return canonical;
}

/** Trust is anchored at the socket. Only explicitly configured proxy IPs may
 * contribute X-Forwarded-For hops; the closest untrusted hop is the client.
 * Missing/malformed origin evidence cannot be repaired with another header.
 */
export function requestClientIp(request: any, trustedProxyIps = process.env.TRUSTED_PROXY_IPS): string | undefined {
  const peer = normalizeIp(request?.socket?.remoteAddress);
  if (!peer) return undefined;
  const values = trustedProxyIps?.split(",").map(value => normalizeIp(value.trim())) || [];
  // An invalid allowlist disables forwarding trust as a whole.
  const trusted = new Set(values.every(Boolean) ? values as string[] : []);
  if (!trusted.has(peer)) return peer;
  const forwarded = request?.headers?.["x-forwarded-for"];
  if (forwarded === undefined) return peer;
  if (typeof forwarded !== "string" || !forwarded || forwarded.length > 4096) return undefined;
  const hops = forwarded.split(",");
  if (hops.length > 32) return undefined;
  const addresses = hops.map(value => normalizeIp(value.trim()));
  if (addresses.some(value => !value)) return undefined;
  let current = peer;
  for (let index = addresses.length - 1; index >= 0; index--) {
    if (!trusted.has(current)) break;
    current = addresses[index]!;
  }
  return current;
}
