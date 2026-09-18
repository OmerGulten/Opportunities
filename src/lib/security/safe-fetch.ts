/**
 * SSRF-hardened HTTP fetching. Every request to a URL that came from outside
 * the system (a Places `websiteUri`, a user-entered domain, a sitemap link)
 * goes through `safeFetchUrl`.
 *
 * Guarantees, in order of application:
 *  1. scheme / credentials / port / host-shape policy (`assertSafeUrl`)
 *  2. hostname blocklist (loopback, `*.internal`, `*.local`, cloud metadata)
 *  3. DNS resolution with a private/reserved address check on *every* address
 *  4. redirects followed manually, re-running 1-3 on each hop, capped
 *  5. content-type allow-list, byte cap, and a single wall-clock budget
 *
 * See `docs/security.md` for the TOCTOU (DNS rebinding) limitation and the
 * mitigations that bound it.
 */

import { AppError, WebsiteBlockedError, WebsiteInvalidUrlError, WebsiteTimeoutError, WebsiteTooLargeError } from "@/lib/errors";
import { createLogger } from "@/lib/logging";

import { isIpLiteral, isPrivateOrReservedIp, normalizeHostname, parseIp } from "./ip";
import { assertSafeUrl, resolveRedirectLocation, type UrlPolicyOptions } from "./url";

export interface SafeFetchOptions {
  method?: "GET" | "HEAD";
  /** Maximum redirect hops to follow. Default 5. */
  maxRedirects?: number;
  /** Hard cap on the decoded response body. Default 2 MB. */
  maxBytes?: number;
  /** Total wall-clock budget for DNS + all hops + body read. Default 10 s. */
  timeoutMs?: number;
  /** Content types accepted on the final response. Default: html, xhtml, plain, xml, json. */
  acceptContentTypes?: RegExp[];
  /** Extra request headers (lowercased; they override the defaults). */
  headers?: Record<string, string>;
  userAgent?: string;
  /** DNS override, mainly for tests. Must return IP literals. */
  resolveDns?: (hostname: string) => Promise<string[]>;
  fetchImpl?: typeof fetch;
  /** Development / self-hosted only: allow loopback, RFC 1918 and internal hostnames. */
  allowPrivateNetworks?: boolean;
  /** Return a truncated body instead of throwing `WebsiteTooLargeError`. */
  truncateInsteadOfFail?: boolean;
  /** Ports allowed beyond 80/443. */
  allowedPorts?: readonly number[];
  /** Extra hostnames to block (host + subdomains, or `*.host` for subdomains only). */
  blocklist?: readonly string[];
}

export interface SafeFetchResult {
  /** The normalised URL that was requested. */
  url: string;
  /** The URL that produced this response, after redirects. */
  finalUrl: string;
  status: number;
  ok: boolean;
  /** Response headers, lowercased. `set-cookie` is dropped on purpose. */
  headers: Record<string, string>;
  contentType: string | null;
  body: string;
  bytes: number;
  /** URLs that answered with a redirect, in order. Empty when there were none. */
  redirectChain: string[];
  durationMs: number;
  https: boolean;
  truncated: boolean;
}

export type SafeFetcher = (url: string, opts?: SafeFetchOptions) => Promise<SafeFetchResult>;

export type FetchErrorKind = "timeout" | "blocked" | "unreachable" | "too_large" | "invalid_url" | "unknown";

export const DEFAULT_USER_AGENT = "OpportunityOSBot/1.0 (+https://opportunityos.app/bot)";
export const DEFAULT_MAX_REDIRECTS = 5;
export const DEFAULT_MAX_BYTES = 2_000_000;
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5";

/** Content types a website audit can actually read. */
export const DEFAULT_ACCEPT_CONTENT_TYPES: readonly RegExp[] = [
  /^text\/html\b/i,
  /^application\/xhtml\+xml\b/i,
  /^text\/plain\b/i,
  /^(?:text|application)\/(?:xml|[\w.+-]*\+xml)\b/i,
  /^application\/(?:json|[\w.+-]*\+json)\b/i,
];

/** Accepts any content type; used by `safeHead`, where reachability is the question. */
export const ANY_CONTENT_TYPE = /^[\s\S]*$/;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HEAD_UNSUPPORTED_STATUSES = new Set([405, 501]);

const log = createLogger({ mod: "security.safe-fetch" });

/** Internal marker: the wall-clock budget ran out. */
class DeadlineExceeded extends Error {
  constructor() {
    super("deadline exceeded");
    this.name = "DeadlineExceeded";
  }
}

function unreachable(url: string, reason: string, cause?: unknown): AppError {
  return new AppError("provider_unavailable", "Website unreachable", { details: { url, reason }, cause });
}

function errorCodeOf(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const direct = (err as { code?: unknown }).code;
  if (typeof direct === "string") return direct;
  const cause = (err as { cause?: unknown }).cause;
  if (cause !== undefined && cause !== err) return errorCodeOf(cause);
  return undefined;
}

function isAbortLike(err: unknown): boolean {
  if (err instanceof DeadlineExceeded) return true;
  if (!(err instanceof Error)) return false;
  return err.name === "AbortError" || err.name === "TimeoutError";
}

async function defaultResolveDns(hostname: string): Promise<string[]> {
  const { lookup } = await import("node:dns/promises");
  const entries = await lookup(hostname, { all: true });
  return entries.map((entry) => entry.address);
}

/** Run `task` under the remaining budget, aborting the shared controller on expiry. */
async function withDeadline<T>(task: (signal: AbortSignal) => Promise<T>, deadline: number, controller: AbortController): Promise<T> {
  const ms = deadline - Date.now();
  if (ms <= 0) throw new DeadlineExceeded();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DeadlineExceeded());
    }, ms);
  });
  try {
    return await Promise.race([task(controller.signal), expiry]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function headerRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const name = key.toLowerCase();
    // Cookies are never used, stored or forwarded by the bot.
    if (name === "set-cookie") return;
    out[name] = value;
  });
  return out;
}

function decodeBody(buffer: Uint8Array, contentType: string | null): string {
  const label = contentType ? /charset\s*=\s*"?([\w.:-]+)"?/i.exec(contentType)?.[1] : undefined;
  if (label) {
    try {
      // Legacy Turkish pages still ship windows-1254 / iso-8859-9.
      return new TextDecoder(label).decode(buffer);
    } catch {
      // Unknown label: fall through to UTF-8.
    }
  }
  return new TextDecoder("utf-8").decode(buffer);
}

function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function discard(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The peer may have closed already; nothing to clean up.
  }
}

interface BodyRead {
  bytes: number;
  buffer: Uint8Array;
  truncated: boolean;
}

async function readBody(response: Response, maxBytes: number, truncateInsteadOfFail: boolean, url: string): Promise<BodyRead> {
  if (!response.body) return { bytes: 0, buffer: new Uint8Array(0), truncated: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const chunk: Uint8Array = value;
    if (total + chunk.length > maxBytes) {
      if (!truncateInsteadOfFail) {
        await reader.cancel().catch(() => undefined);
        throw new WebsiteTooLargeError(maxBytes, { details: { url, bytes: total + chunk.length } });
      }
      chunks.push(chunk.subarray(0, maxBytes - total));
      total = maxBytes;
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(chunk);
    total += chunk.length;
  }

  return { bytes: total, buffer: concat(chunks, total), truncated };
}

function policyOf(opts: SafeFetchOptions): UrlPolicyOptions {
  return {
    allowIpLiterals: opts.allowPrivateNetworks === true,
    allowPrivateHostnames: opts.allowPrivateNetworks === true,
    allowedPorts: opts.allowedPorts,
    blocklist: opts.blocklist,
  };
}

/** Resolve a hostname and reject the request when any address is private or reserved. */
async function resolveAndGuard(
  target: URL,
  opts: SafeFetchOptions,
  deadline: number,
  controller: AbortController,
): Promise<string[]> {
  const host = normalizeHostname(target.hostname);
  const url = target.toString();

  let addresses: string[];
  if (isIpLiteral(host)) {
    addresses = [host];
  } else {
    const resolve = opts.resolveDns ?? defaultResolveDns;
    try {
      addresses = await withDeadline(() => resolve(host), deadline, controller);
    } catch (err) {
      if (isAbortLike(err)) throw err;
      throw unreachable(url, errorCodeOf(err)?.toLowerCase() ?? "dns_failed", err);
    }
    if (addresses.length === 0) throw unreachable(url, "dns_no_records");
  }

  if (opts.allowPrivateNetworks === true) return addresses;

  for (const address of addresses) {
    if (parseIp(address) === null) {
      log.debug("blocked unparsable address", { url, address });
      throw new WebsiteBlockedError("unparsable_ip", { details: { url, hostname: host, address } });
    }
    if (isPrivateOrReservedIp(address)) {
      log.debug("blocked private address", { url, address });
      throw new WebsiteBlockedError("private_ip", { details: { url, hostname: host, address } });
    }
  }
  return addresses;
}

function assertContentType(contentType: string | null, accepted: readonly RegExp[], url: string): void {
  if (contentType === null) return; // Absent header: nothing to reject on.
  const value = contentType.trim();
  if (accepted.some((pattern) => pattern.test(value))) return;
  throw new WebsiteBlockedError("content_type", { details: { url, contentType: value } });
}

/**
 * Fetch an untrusted URL with SSRF, size and time protection.
 *
 * @throws WebsiteInvalidUrlError  the URL is unusable (scheme, credentials, port, host shape)
 * @throws WebsiteBlockedError     policy blocked it (private address, blocked host, redirect cap, content type)
 * @throws WebsiteTimeoutError     the total budget expired
 * @throws WebsiteTooLargeError    the body exceeded `maxBytes` and truncation was not requested
 * @throws AppError                `provider_unavailable` for DNS, connection and TLS failures
 */
export async function safeFetchUrl(url: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const started = Date.now();
  const method = opts.method ?? "GET";
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const accepted = opts.acceptContentTypes ?? DEFAULT_ACCEPT_CONTENT_TYPES;
  const truncateInsteadOfFail = opts.truncateInsteadOfFail === true;
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const deadline = started + timeoutMs;
  const controller = new AbortController();
  const policy = policyOf(opts);

  const requestHeaders: Record<string, string> = {
    accept: DEFAULT_ACCEPT_HEADER,
    "user-agent": opts.userAgent ?? DEFAULT_USER_AGENT,
  };
  for (const [key, value] of Object.entries(opts.headers ?? {})) {
    requestHeaders[key.toLowerCase()] = value;
  }

  const requested = assertSafeUrl(url, policy);
  const requestedUrl = requested.toString();
  const redirectChain: string[] = [];
  let current = requested;
  let redirects = 0;

  try {
    await resolveAndGuard(current, opts, deadline, controller);

    for (;;) {
      const response = await withDeadline(
        (signal) => fetchImpl(current.toString(), { method, redirect: "manual", signal, headers: requestHeaders }),
        deadline,
        controller,
      );

      if (REDIRECT_STATUSES.has(response.status)) {
        await discard(response);
        const location = response.headers.get("location");
        if (location === null || location.trim() === "") {
          throw new WebsiteBlockedError("redirect_without_location", {
            details: { url: current.toString(), status: response.status },
          });
        }
        redirects += 1;
        if (redirects > maxRedirects) {
          throw new WebsiteBlockedError("too_many_redirects", { details: { url: requestedUrl, maxRedirects } });
        }
        const target = resolveRedirectLocation(location, current);
        if (target === null) {
          throw new WebsiteInvalidUrlError("redirect_location", { details: { url: current.toString(), location } });
        }
        // Re-run the full policy on every hop: scheme, host, port, blocklist, DNS.
        // A hop we refuse is a *blocked fetch*, not an invalid user-supplied URL.
        let next: URL;
        try {
          next = assertSafeUrl(target.toString(), policy);
        } catch (err) {
          if (err instanceof AppError && err.code === "website_invalid_url") {
            throw new WebsiteBlockedError(`redirect_${String(err.details?.reason ?? "invalid_url")}`, {
              details: { url: current.toString(), location },
              cause: err,
            });
          }
          throw err;
        }
        await resolveAndGuard(next, opts, deadline, controller);
        redirectChain.push(current.toString());
        current = next;
        continue;
      }

      const headers = headerRecord(response.headers);
      const contentType = response.headers.get("content-type");
      assertContentType(contentType, accepted, current.toString());

      const declared = Number(headers["content-length"] ?? "");
      if (Number.isFinite(declared) && declared > maxBytes && !truncateInsteadOfFail) {
        await discard(response);
        throw new WebsiteTooLargeError(maxBytes, { details: { url: current.toString(), bytes: declared } });
      }

      const read = await withDeadline(
        () => readBody(response, maxBytes, truncateInsteadOfFail, current.toString()),
        deadline,
        controller,
      );

      return {
        url: requestedUrl,
        finalUrl: current.toString(),
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        headers,
        contentType,
        body: method === "HEAD" ? "" : decodeBody(read.buffer, contentType),
        bytes: method === "HEAD" ? 0 : read.bytes,
        redirectChain,
        durationMs: Math.max(1, Date.now() - started),
        https: current.protocol === "https:",
        truncated: read.truncated,
      };
    }
  } catch (err) {
    if (isAbortLike(err)) {
      throw new WebsiteTimeoutError(requestedUrl, { details: { timeoutMs }, cause: err });
    }
    if (err instanceof AppError) throw err;
    throw unreachable(requestedUrl, errorCodeOf(err)?.toLowerCase() ?? "fetch_failed", err);
  } finally {
    controller.abort();
  }
}

/**
 * Reachability probe. Sends `HEAD`, and retries with a 1 KB truncated `GET`
 * when the server answers 405/501. Content types are not restricted: the point
 * is whether the URL answers, not whether we can read it.
 */
export async function safeHead(url: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const base: SafeFetchOptions = { ...opts, acceptContentTypes: opts.acceptContentTypes ?? [ANY_CONTENT_TYPE] };
  const result = await safeFetchUrl(url, { ...base, method: "HEAD" });
  if (!HEAD_UNSUPPORTED_STATUSES.has(result.status)) return result;
  return safeFetchUrl(url, { ...base, method: "GET", maxBytes: 1024, truncateInsteadOfFail: true });
}

/** Map any thrown value to a stable kind for logging, signals and retry decisions. */
export function classifyFetchError(err: unknown): FetchErrorKind {
  if (err instanceof AppError) {
    switch (err.code) {
      case "website_timeout":
        return "timeout";
      case "website_blocked":
        return "blocked";
      case "website_too_large":
        return "too_large";
      case "website_invalid_url":
        return "invalid_url";
      case "provider_unavailable":
        return "unreachable";
      default:
        return "unknown";
    }
  }
  if (isAbortLike(err)) return "timeout";
  const code = errorCodeOf(err);
  if (code !== undefined || (err instanceof TypeError && /fetch failed|network/i.test(err.message))) return "unreachable";
  return "unknown";
}
