/**
 * URL normalisation and policy checks for user-supplied website addresses.
 *
 * `normalizeWebsiteUrl` is the syntactic layer (scheme, credentials, host shape,
 * port, fragment). `assertSafeUrl` adds the policy layer (hostname blocklist,
 * IP literal classification) and throws typed errors. Neither performs DNS:
 * address-level checks happen in `safe-fetch.ts`, on the initial request and on
 * every redirect hop.
 */

import { WebsiteBlockedError, WebsiteInvalidUrlError } from "@/lib/errors";

import { isIpLiteral, isPrivateOrReservedIp, normalizeHostname, parseIp } from "./ip";

export interface UrlPolicyOptions {
  /** Permit `http://203.0.113.10/` style hosts. Public literals only; reserved ranges stay blocked. */
  allowIpLiterals?: boolean;
  /**
   * Permit dotless and internal hostnames (`localhost`, `*.internal`, `*.local`).
   * Intended for local development and tests; `opts.blocklist` is still enforced.
   */
  allowPrivateHostnames?: boolean;
  /** Extra ports allowed beyond 80 and 443. */
  allowedPorts?: readonly number[];
  /**
   * Additional hostnames to block. A plain entry (`example.com`) blocks the host
   * and its subdomains; `.example.com` / `*.example.com` block subdomains only.
   */
  blocklist?: readonly string[];
}

export type UrlRejectionReason =
  | "empty"
  | "unparsable"
  | "scheme"
  | "userinfo"
  | "hostname"
  | "ip_literal"
  | "port";

export type UrlAnalysis = { ok: true; url: URL } | { ok: false; reason: UrlRejectionReason };

export const ALLOWED_PROTOCOLS: readonly string[] = ["http:", "https:"];
export const DEFAULT_ALLOWED_PORTS: readonly number[] = [80, 443];

/** Hostnames that are never fetched, whatever they resolve to. */
export const BLOCKED_HOSTNAMES: readonly string[] = [
  "localhost",
  "metadata.google.internal",
  "metadata.goog",
  "169.254.169.254",
];

/** Suffixes that are never fetched (matched on label boundaries). */
export const BLOCKED_HOSTNAME_SUFFIXES: readonly string[] = [".localhost", ".internal", ".local"];

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function matchesEntry(hostname: string, entry: string): boolean {
  const raw = entry.trim().toLowerCase();
  if (raw === "") return false;
  if (raw.startsWith("*.")) return hostname.endsWith(raw.slice(1));
  if (raw.startsWith(".")) return hostname.endsWith(raw);
  return hostname === raw || hostname.endsWith(`.${raw}`);
}

/**
 * Hostnames that must never be fetched: loopback names, internal/mDNS suffixes,
 * cloud metadata endpoints and any caller-supplied entries.
 */
export function isBlockedHostname(hostname: string, opts: UrlPolicyOptions = {}): boolean {
  const host = normalizeHostname(hostname);
  if (host === "") return true;

  for (const entry of opts.blocklist ?? []) {
    if (matchesEntry(host, entry)) return true;
  }
  if (opts.allowPrivateHostnames) return false;

  if (BLOCKED_HOSTNAMES.includes(host)) return true;
  return BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function allowedPorts(opts: UrlPolicyOptions): Set<number> {
  return new Set<number>([...DEFAULT_ALLOWED_PORTS, ...(opts.allowedPorts ?? [])]);
}

/**
 * Parse and normalise a website URL, returning the reason when it is rejected.
 * Exported for callers that want to explain the rejection to a user.
 */
export function analyzeWebsiteUrl(input: string, opts: UrlPolicyOptions = {}): UrlAnalysis {
  const trimmed = input.trim();
  if (trimmed === "") return { ok: false, reason: "empty" };

  let candidate = trimmed;
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  else if (!SCHEME_RE.test(candidate)) candidate = `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: "unparsable" };
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return { ok: false, reason: "scheme" };
  // Credentials in a URL are a classic SSRF/phishing vector and never legitimate here.
  if (url.username !== "" || url.password !== "") return { ok: false, reason: "userinfo" };

  const host = normalizeHostname(url.hostname);
  if (host === "") return { ok: false, reason: "hostname" };

  if (isIpLiteral(host)) {
    if (!opts.allowIpLiterals) return { ok: false, reason: "ip_literal" };
  } else if (!host.includes(".") && !opts.allowPrivateHostnames) {
    // Single-label hosts resolve through search domains to internal machines.
    return { ok: false, reason: "hostname" };
  }

  if (url.port !== "" && !allowedPorts(opts).has(Number(url.port))) return { ok: false, reason: "port" };

  // `new URL` already lowercases the host and applies IDNA/punycode.
  url.hostname = host;
  url.hash = "";
  return { ok: true, url };
}

/**
 * Normalise a user-supplied website address, or `null` when it cannot be used:
 * adds `https://` when no scheme is given, keeps path and query, drops the
 * fragment, rejects non-http(s) schemes, embedded credentials, dotless hosts,
 * IP literals (unless `allowIpLiterals`) and ports other than 80/443.
 */
export function normalizeWebsiteUrl(input: string, opts: UrlPolicyOptions = {}): string | null {
  const analysis = analyzeWebsiteUrl(input, opts);
  return analysis.ok ? analysis.url.toString() : null;
}

/**
 * Normalise and policy-check a URL, throwing `WebsiteInvalidUrlError` for
 * syntactic problems and `WebsiteBlockedError` for hosts that policy forbids.
 * Returns the normalised `URL`.
 */
export function assertSafeUrl(url: string | URL, opts: UrlPolicyOptions = {}): URL {
  const input = typeof url === "string" ? url : url.toString();
  const analysis = analyzeWebsiteUrl(input, opts);
  if (!analysis.ok) throw new WebsiteInvalidUrlError(analysis.reason, { details: { url: input } });

  const target = analysis.url;
  const host = normalizeHostname(target.hostname);

  if (isBlockedHostname(host, opts)) {
    throw new WebsiteBlockedError("blocked_hostname", { details: { url: target.toString(), hostname: host } });
  }

  if (isIpLiteral(host)) {
    // Fail closed: a literal we cannot parse (octal/hex/dword forms) is never trusted.
    if (parseIp(host) === null) {
      throw new WebsiteBlockedError("unparsable_ip", { details: { url: target.toString(), hostname: host } });
    }
    if (isPrivateOrReservedIp(host) && !opts.allowPrivateHostnames) {
      throw new WebsiteBlockedError("private_ip", { details: { url: target.toString(), address: host } });
    }
  }

  return target;
}

/** Resolve a `Location` header against the URL it was returned from. */
export function resolveRedirectLocation(location: string, base: URL): URL | null {
  try {
    return new URL(location, base);
  } catch {
    return null;
  }
}
