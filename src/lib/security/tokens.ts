/**
 * Secret generation and comparison. Server-only (`node:crypto`).
 *
 * Nothing here ever stores a secret in plaintext: public report tokens and API
 * keys are shown to the user once and persisted as a SHA-256 hex digest
 * (`public_reports.token` is looked up by digest, `api_keys.key_hash`), with a
 * short non-secret prefix kept for display and lookup.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Environment marker for issued keys. Live keys are the only kind today. */
export const API_KEY_PREFIX = "oos_live_";

/** Characters of an API key stored in `api_keys.key_prefix` (`oos_live_` + 5). */
export const API_KEY_PREFIX_LENGTH = 14;

/** Default entropy for tokens: 32 bytes = 256 bits. */
export const DEFAULT_TOKEN_BYTES = 32;

/**
 * URL-safe random token. 32 bytes (256 bits) by default, which is what public
 * report links and invitation tokens use.
 */
export function generateSecureToken(bytes: number = DEFAULT_TOKEN_BYTES): string {
  if (!Number.isInteger(bytes) || bytes < 16 || bytes > 1024) {
    throw new RangeError("Token length must be an integer between 16 and 1024 bytes");
  }
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 hex digest. Tokens are stored and compared in this form only. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export interface GeneratedApiKey {
  /** Full secret, shown to the user exactly once. */
  key: string;
  /** Non-secret display/lookup prefix (`api_keys.key_prefix`). */
  prefix: string;
  /** SHA-256 hex digest to persist (`api_keys.key_hash`). */
  hash: string;
}

/** Issue a workspace API key: `oos_live_` + 256 bits of base64url entropy. */
export function generateApiKey(): GeneratedApiKey {
  const key = `${API_KEY_PREFIX}${generateSecureToken(DEFAULT_TOKEN_BYTES)}`;
  return { key, prefix: key.slice(0, API_KEY_PREFIX_LENGTH), hash: hashToken(key) };
}

/** The non-secret prefix of a presented key, for indexed lookups. */
export function apiKeyPrefix(key: string): string {
  return key.slice(0, API_KEY_PREFIX_LENGTH);
}

/**
 * Constant-time string comparison. Both sides are hashed first so that the
 * comparison is over equal-length buffers and no length information leaks.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a, "utf8").digest();
  const right = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(left, right);
}

/** Check a presented token against a stored SHA-256 hex digest, in constant time. */
export function verifyToken(token: string, storedHash: string): boolean {
  return safeEqual(hashToken(token), storedHash);
}
