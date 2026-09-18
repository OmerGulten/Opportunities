/**
 * IP literal parsing and private/reserved range classification.
 *
 * Used by the SSRF guard: every address a hostname resolves to — and every IP
 * literal a URL carries — is checked here before a request leaves the process.
 * Parsing is strict on purpose: only canonical dotted-quad IPv4 and RFC 4291
 * IPv6 (with optional embedded IPv4 and zone id) are accepted. Non-canonical
 * numeric hosts ("0177.0.0.1", "2130706433", "0x7f.1") are rejected by the
 * parsers but still reported as IP literals by `isIpLiteral()` so callers can
 * fail closed instead of treating them as DNS names.
 */

export type IpVersion = 4 | 6;

export interface ParsedIp {
  version: IpVersion;
  /** Network order: 4 bytes for IPv4, 16 bytes for IPv6. */
  bytes: number[];
  /** Canonical lowercase text form; zone id removed. */
  canonical: string;
}

/** `[::1]` -> `::1`, `::1%eth0` -> `::1`, `EXAMPLE.com.` -> `example.com`. */
export function normalizeHostname(hostname: string): string {
  let value = hostname.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
  const zone = value.indexOf("%");
  if (zone !== -1) value = value.slice(0, zone);
  // A single trailing dot is the DNS root and is not significant for policy.
  if (value.length > 1 && value.endsWith(".")) value = value.slice(0, -1);
  return value;
}

/** Strip surrounding brackets from an IPv6 literal, leaving everything else untouched. */
export function stripIpBrackets(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
}

/** Strict dotted-quad IPv4. Leading zeros are rejected (they are octal in some resolvers). */
export function parseIpv4(input: string): number[] | null {
  const parts = input.trim().split(".");
  if (parts.length !== 4) return null;
  const bytes: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith("0")) return null;
    const n = Number(part);
    if (n > 255) return null;
    bytes.push(n);
  }
  return bytes;
}

/** RFC 4291 IPv6, including `::` compression, embedded IPv4 and `%zone` suffixes. */
export function parseIpv6(input: string): number[] | null {
  let value = input.trim().toLowerCase();
  if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
  const zone = value.indexOf("%");
  if (zone !== -1) value = value.slice(0, zone);
  if (!value.includes(":")) return null;

  // Rewrite a trailing embedded IPv4 ("::ffff:1.2.3.4") into two hex groups.
  if (value.includes(".")) {
    const cut = value.lastIndexOf(":");
    const v4 = parseIpv4(value.slice(cut + 1));
    if (!v4) return null;
    const hi = (((v4[0] as number) << 8) | (v4[1] as number)).toString(16);
    const lo = (((v4[2] as number) << 8) | (v4[3] as number)).toString(16);
    value = `${value.slice(0, cut + 1)}${hi}:${lo}`;
  }

  const first = value.indexOf("::");
  if (first !== value.lastIndexOf("::")) return null;
  const compressed = first !== -1;
  const headText = compressed ? value.slice(0, first) : value;
  const tailText = compressed ? value.slice(first + 2) : "";

  const head = headText === "" ? [] : headText.split(":");
  const tail = tailText === "" ? [] : tailText.split(":");
  const groups: number[] = [];
  for (const token of [...head, ...tail]) {
    if (!/^[0-9a-f]{1,4}$/.test(token)) return null;
    groups.push(Number.parseInt(token, 16));
  }
  if (compressed) {
    if (head.length + tail.length > 7) return null;
  } else if (groups.length !== 8) {
    return null;
  }

  const full: number[] = new Array<number>(8).fill(0);
  for (let i = 0; i < head.length; i += 1) full[i] = groups[i] as number;
  for (let i = 0; i < tail.length; i += 1) full[8 - tail.length + i] = groups[head.length + i] as number;

  const bytes: number[] = [];
  for (const group of full) {
    bytes.push((group >> 8) & 0xff, group & 0xff);
  }
  return bytes;
}

/** Canonical IPv6 text form: lowercase hex, longest zero run compressed. */
export function formatIpv6(bytes: readonly number[]): string {
  const groups: number[] = [];
  for (let i = 0; i < 16; i += 2) groups.push(((bytes[i] as number) << 8) | (bytes[i + 1] as number));

  let bestStart = -1;
  let bestLen = 0;
  let start = -1;
  for (let i = 0; i < 9; i += 1) {
    const zero = i < 8 && groups[i] === 0;
    if (zero && start === -1) start = i;
    if (!zero && start !== -1) {
      const len = i - start;
      if (len > bestLen) {
        bestLen = len;
        bestStart = start;
      }
      start = -1;
    }
  }
  const text = groups.map((g) => g.toString(16));
  if (bestLen < 2) return text.join(":");
  return `${text.slice(0, bestStart).join(":")}::${text.slice(bestStart + bestLen).join(":")}`;
}

/** Parse an IPv4 or IPv6 literal (brackets and zone ids tolerated). */
export function parseIp(input: string): ParsedIp | null {
  const value = stripIpBrackets(input);
  if (value === "") return null;
  if (!value.includes(":")) {
    const v4 = parseIpv4(value);
    return v4 ? { version: 4, bytes: v4, canonical: v4.join(".") } : null;
  }
  const v6 = parseIpv6(value);
  return v6 ? { version: 6, bytes: v6, canonical: formatIpv6(v6) } : null;
}

/**
 * Whether a hostname is an IP address rather than a DNS name. Returns `true`
 * for canonical literals *and* for ambiguous all-numeric / hexadecimal forms
 * (`2130706433`, `0x7f.0.0.1`, `0177.0.0.1`) that some resolvers accept: those
 * are never valid DNS hostnames, so treating them as literals lets callers
 * reject or re-check them instead of trusting them.
 */
export function isIpLiteral(hostname: string): boolean {
  const value = normalizeHostname(hostname);
  if (value === "") return false;
  if (parseIp(value) !== null) return true;
  if (value.includes(":")) return true; // colon is illegal in a DNS name
  return /^(?:0x[0-9a-f]+|\d+)(?:\.(?:0x[0-9a-f]+|\d+))*$/.test(value);
}

interface Cidr4 {
  base: number;
  mask: number;
}

function cidr4(base: string, bits: number): Cidr4 {
  const bytes = parseIpv4(base);
  if (!bytes) throw new Error(`invalid CIDR base: ${base}`);
  const mask = bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
  return { base: (toUint32(bytes) & mask) >>> 0, mask };
}

function toUint32(bytes: readonly number[]): number {
  return (
    (((bytes[0] as number) << 24) | ((bytes[1] as number) << 16) | ((bytes[2] as number) << 8) | (bytes[3] as number)) >>> 0
  );
}

/** IPv4 ranges that must never be reachable from a user-supplied URL. */
const RESERVED_V4: readonly Cidr4[] = [
  cidr4("0.0.0.0", 8), // "this network"
  cidr4("10.0.0.0", 8), // RFC 1918 private
  cidr4("100.64.0.0", 10), // RFC 6598 carrier-grade NAT
  cidr4("127.0.0.0", 8), // loopback
  cidr4("169.254.0.0", 16), // link-local (cloud metadata)
  cidr4("172.16.0.0", 12), // RFC 1918 private
  cidr4("192.0.0.0", 24), // IETF protocol assignments
  cidr4("192.0.2.0", 24), // TEST-NET-1
  cidr4("192.88.99.0", 24), // 6to4 relay anycast (deprecated)
  cidr4("192.168.0.0", 16), // RFC 1918 private
  cidr4("198.18.0.0", 15), // benchmarking
  cidr4("198.51.100.0", 24), // TEST-NET-2
  cidr4("203.0.113.0", 24), // TEST-NET-3
  cidr4("224.0.0.0", 4), // multicast
  cidr4("240.0.0.0", 4), // reserved, includes 255.255.255.255
];

function isPrivateOrReservedIpv4(bytes: readonly number[]): boolean {
  const value = toUint32(bytes);
  if (value === 0xffffffff) return true; // broadcast (also inside 240/4)
  return RESERVED_V4.some((range) => ((value & range.mask) >>> 0) === range.base);
}

function allZero(bytes: readonly number[], from: number, to: number): boolean {
  for (let i = from; i < to; i += 1) if (bytes[i] !== 0) return false;
  return true;
}

function isPrivateOrReservedIpv6(bytes: readonly number[]): boolean {
  const b0 = bytes[0] as number;
  const b1 = bytes[1] as number;

  // IPv4-mapped (::ffff:a.b.c.d) and deprecated IPv4-compatible (::a.b.c.d):
  // the effective destination is the embedded IPv4 address.
  if (allZero(bytes, 0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isPrivateOrReservedIpv4(bytes.slice(12));
  }
  // ::/96 holds the deprecated IPv4-compatible addresses (RFC 4291 §2.5.5.1) and
  // covers ::/128 and ::1. The whole block is reserved, so none of it is fetchable.
  if (allZero(bytes, 0, 12)) return true;
  // NAT64 well-known prefix 64:ff9b::/96 — the embedded IPv4 is the real target.
  if (b0 === 0x00 && b1 === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && allZero(bytes, 4, 12)) {
    return isPrivateOrReservedIpv4(bytes.slice(12));
  }
  if ((b0 & 0xfe) === 0xfc) return true; // fc00::/7 unique local
  if (b0 === 0xfe && (b1 & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if (b0 === 0xff) return true; // ff00::/8 multicast
  if (b0 === 0x20 && b1 === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return true; // 2001:db8::/32
  return false;
}

/**
 * `true` when the address is loopback, private, link-local, multicast or
 * otherwise reserved and must not be fetched. Input that is not a parseable IP
 * literal returns `false` — callers decide what a non-IP host means (see
 * `assertSafeUrl`, which fails closed on unparseable literals).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const parsed = parseIp(ip);
  if (!parsed) return false;
  return parsed.version === 4 ? isPrivateOrReservedIpv4(parsed.bytes) : isPrivateOrReservedIpv6(parsed.bytes);
}
