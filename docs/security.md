# Security — outbound fetching, URL policy, secrets, untrusted text

`src/lib/security` is the boundary between OpportunityOS and the open internet. Every
website an audit touches comes from somewhere we do not control (a Places `websiteUri`, a
user-typed domain, a `<link>` or sitemap entry on a page we just fetched), so every fetch
goes through `safeFetchUrl()`.

```ts
import { safeFetchUrl, classifyFetchError, normalizeWebsiteUrl, sanitizeForPrompt } from "@/lib/security";
```

| Module | Runtime | Purpose |
| --- | --- | --- |
| `ip.ts` | anywhere | IP literal parsing, private/reserved range classification |
| `url.ts` | anywhere | normalisation, scheme/port/host policy, hostname blocklist |
| `safe-fetch.ts` | Node (server) | the SSRF-hardened fetcher, `safeHead`, error classification |
| `tokens.ts` | Node (server) | report tokens, API keys, constant-time comparison |
| `sanitize.ts` | anywhere | HTML → text, prompt input, HTML escaping |

## What `safeFetchUrl` guarantees

Applied in this order, on the initial request **and on every redirect hop**:

1. **Scheme, credentials, shape.** Only `http:` and `https:`. Embedded userinfo
   (`https://user:pass@host`) is refused. Ports are limited to 80/443 plus
   `allowedPorts`. Single-label hosts (`http://intranet/`) are refused because they
   resolve through the resolver's search domains to internal machines. IP literals are
   refused unless `allowPrivateNetworks` is set. The fragment is dropped; path and query
   are preserved. Failures throw `WebsiteInvalidUrlError` (`website_invalid_url`).
2. **Hostname blocklist.** `localhost`, `*.localhost`, `*.internal`, `*.local`,
   `metadata.google.internal`, `metadata.goog`, `169.254.169.254`, plus any caller
   `blocklist` entries (a plain entry also blocks its subdomains; `*.host` blocks only
   subdomains). Trailing-dot (`localhost.`) and case variants are normalised first.
3. **Address check.** The hostname is resolved with `dns.lookup(host, { all: true })` and
   the request is refused when **any** returned address is private or reserved:
   0.0.0.0/8, 10/8, 100.64/10, 127/8, 169.254/16, 172.16/12, 192.0.0/24, 192.0.2/24,
   192.88.99/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 224/4, 240/4,
   255.255.255.255 — and for IPv6 `::/96` (which covers `::`, `::1` and the deprecated
   IPv4-compatible addresses), `fc00::/7`, `fe80::/10`, `ff00::/8`, `2001:db8::/32`, plus
   the embedded IPv4 inside IPv4-mapped (`::ffff:a.b.c.d`) and NAT64 (`64:ff9b::/96`)
   addresses. An answer that is not a parseable IP literal is also refused
   (`unparsable_ip`) rather than passed through.
   Obfuscated hosts (`http://2130706433/`, `http://0177.0.0.1/`, `http://0x7f.1/`) are
   canonicalised to `127.0.0.1` by the WHATWG URL parser before any of this runs, so they
   are caught by the same rules.
4. **Redirects.** `redirect: "manual"`; each `Location` is resolved against the URL that
   returned it and re-checked from step 1. At most `maxRedirects` (default 5) hops; the
   URLs that redirected are returned in `redirectChain`. A refused hop raises
   `WebsiteBlockedError` with a `redirect_*` reason, never a silent follow.
5. **Response limits.** Content types must match `acceptContentTypes` (default: HTML,
   XHTML, plain text, XML, JSON); an oversized `Content-Length` is refused before the body
   is read; the stream is cut at `maxBytes` (default 2 MB) with either
   `WebsiteTooLargeError` or `truncated: true` when `truncateInsteadOfFail` is set. One
   `AbortController` enforces `timeoutMs` (default 10 s) across DNS, all hops and the body
   read. `set-cookie` is dropped from the returned headers; no cookie is ever stored or
   sent back.

Bodies are decoded with the charset from `Content-Type` when there is one (legacy Turkish
pages still ship `windows-1254` / `iso-8859-9`), otherwise UTF-8, always non-fatally.

### Errors

| Thrown | Code | `classifyFetchError` |
| --- | --- | --- |
| `WebsiteInvalidUrlError` | `website_invalid_url` | `invalid_url` |
| `WebsiteBlockedError` | `website_blocked` | `blocked` |
| `WebsiteTimeoutError` | `website_timeout` | `timeout` |
| `WebsiteTooLargeError` | `website_too_large` | `too_large` |
| `AppError("provider_unavailable")` | `provider_unavailable` | `unreachable` |

DNS failures, refused connections and TLS errors become `provider_unavailable` with a
`details.reason` such as `enotfound`, `econnrefused`, `dns_no_records` or `fetch_failed`.
A non-2xx **response** is not an error: the result carries `status` and `ok`, so an audit
can record `not_found` or `unavailable` honestly instead of inventing a finding.

## Limitation: TOCTOU / DNS rebinding

`safeFetchUrl` validates the addresses a hostname resolves to, and then calls `fetch`,
which **resolves the hostname again**. A hostname whose record flips between a public
address and `127.0.0.1` (a short-TTL rebinding record) can therefore pass the check and be
connected to at the private address. Closing this hole completely requires connecting to a
pinned IP while preserving the Host header and TLS SNI, which the Vercel runtime's `fetch`
does not expose.

Three mitigations bound it:

1. **Re-validation at every hop.** Redirects are followed manually and each hop repeats the
   full policy and a fresh DNS check, so the common attack — a public URL redirecting to
   `http://169.254.169.254/` or an internal host — is blocked outright. The window is
   narrowed to a single request whose DNS answer changes between our lookup and undici's.
2. **Nothing is trusted on the way back.** The fetcher sends only a `User-Agent` and an
   `Accept` header — no cookies, credentials or `Authorization` — so a rebound request
   carries no ambient authority (do not pass secrets through `opts.headers`);
   `set-cookie` is discarded; the body is size-capped, content-type-gated, never executed, and passes
   through `sanitizeForPrompt()` before it reaches an AI prompt, where it is labelled as
   untrusted data. A successful rebind yields at most a bounded, credential-free read.
3. **Network-level egress control in production.** Run audit workloads where RFC 1918,
   loopback and link-local destinations are unreachable — an egress proxy with an allow
   list, or a VPC/firewall policy that drops private destinations — and the metadata
   endpoint is the first thing that policy must deny. This is the only complete fix; the
   application-level checks are defence in depth. `allowPrivateNetworks` exists for local
   development and tests and must never be enabled in a deployed environment.

Callers that control their own resolution (self-hosted Node with undici) can pass
`resolveDns` and pin the address at the socket level; the option is part of the public
interface for exactly that reason.

## Usage

```ts
// Website audit: capped, truncating read of a homepage.
const page = await safeFetchUrl(business.websiteUri, { maxBytes: 1_000_000, truncateInsteadOfFail: true });
if (page.ok) analyze(page.body, page.finalUrl);

// Reachability probe (HEAD, falling back to a 1 KB GET on 405/501).
const probe = await safeHead(url);

// Normalise before storing a user-entered address; null means "not usable".
const website = normalizeWebsiteUrl(input); // "example.com/x" -> "https://example.com/x"
```

Audit code catches and classifies rather than letting a fetch failure fail a scan:

```ts
try {
  const res = await safeFetchUrl(url);
  ...
} catch (err) {
  const kind = classifyFetchError(err); // "timeout" | "blocked" | "unreachable" | ...
  // emit an `unavailable` / `error` signal — never `not_found`, which would be a claim
  // about the business rather than about our check.
}
```

Tests inject `resolveDns` and `fetchImpl`; nothing in `src/lib/security/*.test.ts` touches
the network.

## Secrets

* `generateSecureToken(bytes = 32)` — base64url, 256 bits by default. Public report tokens
  and invitations use it.
* `hashToken(token)` — SHA-256 hex. Tokens are stored and looked up **only** as digests
  (`api_keys.key_hash`).
* `generateApiKey()` — `{ key, prefix, hash }`, key = `oos_live_` + 256 bits. `prefix` is
  the first 14 characters (`api_keys.key_prefix`) for display and indexed lookup; the full
  key is shown to the user once and never persisted.
* `safeEqual(a, b)` / `verifyToken(token, storedHash)` — constant-time comparison over
  SHA-256 digests, so neither the value nor its length leaks through timing.

## Untrusted text

* `stripHtml(html)` — text only: `script` / `style` / `svg` / `noscript` blocks and
  comments removed, block tags become spaces, entities decoded, whitespace collapsed.
  Structural extraction (titles, headings, links) belongs in the audit module's cheerio
  pass, not here.
* `sanitizeForPrompt(text, max = 500)` — the boundary for anything that reaches the AI
  provider: control, zero-width and bidi characters removed, whitespace collapsed, code
  fences and angle brackets neutralised, hard length cap. Fetched page text is **data**;
  prompt builders keep it inside a delimited block and the fact-guard checks the output
  against verified facts.
* `escapeHtml(text)` — for HTML assembled outside React (report snapshots, e-mail bodies).
