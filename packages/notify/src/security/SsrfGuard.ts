import { lookup } from 'dns/promises';
import { isIP } from 'net';

/**
 * SSRF guard for outbound webhook delivery.
 *
 * A webhook URL is tenant-supplied and our server makes the request to it,
 * so an unguarded fetch is a textbook Server-Side Request Forgery primitive:
 * a URL pointing at 127.0.0.1, a cloud metadata address (169.254.169.254),
 * or an RFC1918 host would let a tenant probe or POST to internal services
 * from this process's network.
 *
 * `isDeliverableUrl` resolves the hostname and rejects any address that's
 * loopback, private, link-local, or otherwise non-publicly-routable.
 * Callers must also pass `redirect: 'manual'` on the actual fetch so a
 * publicly-resolving URL can't 3xx-bounce to an internal one after this
 * check has already passed.
 *
 * Not covered: DNS rebinding (a hostname that resolves public here but
 * flips to a private address between this check and the actual connect).
 * Closing that gap needs pinning the resolved IP into the request socket,
 * which the platform `fetch` used elsewhere in this SDK doesn't expose —
 * a real residual risk, not something silently assumed away.
 */

/** True for loopback / private / link-local / CGNAT / reserved IPv4 or IPv6. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0) return true;                          // "this" network
    if (a === 10) return true;                          // private
    if (a === 127) return true;                          // loopback
    if (a === 169 && b === 254) return true;               // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;         // private
    if (a === 192 && b === 168) return true;               // private
    if (a === 100 && b >= 64 && b <= 127) return true;        // CGNAT
    return false;
  }

  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (v6 === '::1' || v6 === '::') return true;             // loopback / unspecified
  if (/^fe[89ab]/.test(v6)) return true;                    // fe80::/10 link-local
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true; // fc00::/7 unique local
  const mapped = v6.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateOrReservedIp(mapped[1]);        // IPv4-mapped IPv6
  return false;
}

/**
 * True if `rawUrl`'s host resolves only to publicly-routable address(es).
 * False for a malformed URL, a literal private IP, an obviously-internal
 * name (localhost / *.local / *.internal), or a hostname resolving to any
 * private/reserved address.
 */
export async function isDeliverableUrl(rawUrl: string): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return false;
  }

  if (isIP(hostname)) return !isPrivateOrReservedIp(hostname);

  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal')) {
    return false;
  }

  try {
    const results = await lookup(hostname, { all: true });
    if (results.length === 0) return false;
    return results.every((r) => !isPrivateOrReservedIp(r.address));
  } catch {
    return false; // unresolvable → not deliverable
  }
}
