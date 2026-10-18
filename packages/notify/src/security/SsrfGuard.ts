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
    const c = Number(v4[3]);
    if (a === 0) return true;                          // "this" network
    if (a === 10) return true;                          // private
    if (a === 127) return true;                          // loopback
    if (a === 169 && b === 254) return true;               // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;         // private
    if (a === 192 && b === 168) return true;               // private
    if (a === 192 && b === 0 && c === 0) return true;          // 192.0.0.0/24 IETF protocol assignments
    if (a === 192 && b === 0 && c === 2) return true;          // TEST-NET-1
    if (a === 198 && b === 51 && c === 100) return true;        // TEST-NET-2
    if (a === 203 && b === 0 && c === 113) return true;         // TEST-NET-3
    if (a === 198 && (b === 18 || b === 19)) return true;       // 198.18.0.0/15 benchmarking
    if (a === 100 && b >= 64 && b <= 127) return true;        // CGNAT
    if (a >= 224) return true;                            // multicast + 240/4 reserved + broadcast
    return false;
  }

  const hextets = expandIpv6(ip);
  if (!hextets) return false;

  const [h0, h1, h2, h3, h4, h5, h6, h7] = hextets;

  // Any IPv6 form that embeds an IPv4 address must be judged by the embedded
  // v4 — the WHATWG URL parser canonicalizes e.g. ::ffff:127.0.0.1 to pure-hex
  // ::ffff:7f00:1, so dotted-quad pattern-matching alone is bypassable, and a
  // dual-stack socket will happily connect a mapped loopback to 127.0.0.1.
  const embeddedV4 = `${h6 >> 8}.${h6 & 0xff}.${h7 >> 8}.${h7 & 0xff}`;
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0xffff) {
    return isPrivateOrReservedIp(embeddedV4);               // ::ffff:0:0/96 IPv4-mapped
  }
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) {
    // ::/96 IPv4-compatible (deprecated) — plus ::/::1 handled by the v4 check
    // (0.0.0.x and 0.0.0.1 are both in 0/8 → reserved).
    return isPrivateOrReservedIp(embeddedV4);
  }
  if (h0 === 0x64 && h1 === 0xff9b && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) {
    return isPrivateOrReservedIp(embeddedV4);               // 64:ff9b::/96 NAT64
  }
  if (h0 === 0x2002) {
    return isPrivateOrReservedIp(`${h1 >> 8}.${h1 & 0xff}.${h2 >> 8}.${h2 & 0xff}`); // 2002::/16 6to4
  }
  if (h0 === 0x2001 && h1 === 0) return true;               // 2001::/32 Teredo tunneling
  if (h0 === 0x2001 && h1 === 0x0db8) return true;           // 2001:db8::/32 documentation

  if ((h0 & 0xffc0) === 0xfe80) return true;                // fe80::/10 link-local
  if ((h0 & 0xffc0) === 0xfec0) return true;                // fec0::/10 deprecated site-local
  if ((h0 & 0xfe00) === 0xfc00) return true;                // fc00::/7 unique local
  if ((h0 & 0xff00) === 0xff00) return true;                // ff00::/8 multicast
  return false;
}

/**
 * Expands an IPv6 literal (with or without `::` compression, brackets, or a
 * zone id) into its 8 numeric hextets. Dotted-quad tails (`::ffff:1.2.3.4`)
 * are folded into the last two hextets. Returns null for anything that isn't
 * a well-formed IPv6 address.
 */
function expandIpv6(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, '');
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);

  const tail = s.match(/:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (tail) {
    const parts = tail[1].split('.').map(Number);
    if (parts.some((p) => p > 255)) return null;
    s = s.slice(0, -tail[1].length) +
      ((parts[0] << 8) | parts[1]).toString(16) + ':' + ((parts[2] << 8) | parts[3]).toString(16);
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];
  const fill = 8 - head.length - rest.length;
  if (halves.length === 2 ? fill < 0 : head.length !== 8) return null;

  const groups = halves.length === 2 ? [...head, ...Array(fill).fill('0'), ...rest] : head;
  if (groups.length !== 8) return null;

  const hextets: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    hextets.push(parseInt(g, 16));
  }
  return hextets;
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
