/**
 * Security primitives: SSRF-hardened fetching, URL policy, IP classification,
 * secret generation and untrusted-text sanitisation. See `docs/security.md`.
 *
 * `safe-fetch` and `tokens` are server-only (they reach for `node:dns` and
 * `node:crypto`); `ip`, `url` and `sanitize` are pure and run anywhere.
 */

export {
  formatIpv6,
  isIpLiteral,
  isPrivateOrReservedIp,
  normalizeHostname,
  parseIp,
  parseIpv4,
  parseIpv6,
  stripIpBrackets,
  type IpVersion,
  type ParsedIp,
} from "./ip";

export {
  ALLOWED_PROTOCOLS,
  analyzeWebsiteUrl,
  assertSafeUrl,
  BLOCKED_HOSTNAMES,
  BLOCKED_HOSTNAME_SUFFIXES,
  DEFAULT_ALLOWED_PORTS,
  isBlockedHostname,
  normalizeWebsiteUrl,
  resolveRedirectLocation,
  type UrlAnalysis,
  type UrlPolicyOptions,
  type UrlRejectionReason,
} from "./url";

export {
  ANY_CONTENT_TYPE,
  classifyFetchError,
  DEFAULT_ACCEPT_CONTENT_TYPES,
  DEFAULT_ACCEPT_HEADER,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_REDIRECTS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  safeFetchUrl,
  safeHead,
  type FetchErrorKind,
  type SafeFetcher,
  type SafeFetchOptions,
  type SafeFetchResult,
} from "./safe-fetch";

export {
  API_KEY_PREFIX,
  API_KEY_PREFIX_LENGTH,
  apiKeyPrefix,
  DEFAULT_TOKEN_BYTES,
  generateApiKey,
  generateSecureToken,
  hashToken,
  safeEqual,
  verifyToken,
  type GeneratedApiKey,
} from "./tokens";

export {
  collapseWhitespace,
  decodeHtmlEntities,
  escapeHtml,
  sanitizeForPrompt,
  stripControlCharacters,
  stripHtml,
  truncateText,
} from "./sanitize";
