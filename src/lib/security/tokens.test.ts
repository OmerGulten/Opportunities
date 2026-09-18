import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  API_KEY_PREFIX,
  API_KEY_PREFIX_LENGTH,
  apiKeyPrefix,
  generateApiKey,
  generateSecureToken,
  hashToken,
  safeEqual,
  verifyToken,
} from "./tokens";

describe("generateSecureToken", () => {
  it("produces url-safe tokens of the requested entropy", () => {
    const token = generateSecureToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toContain("=");
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(Buffer.from(generateSecureToken(16), "base64url")).toHaveLength(16);
    expect(Buffer.from(generateSecureToken(64), "base64url")).toHaveLength(64);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateSecureToken()));
    expect(seen.size).toBe(200);
  });

  it("refuses weak or absurd lengths", () => {
    expect(() => generateSecureToken(8)).toThrow(RangeError);
    expect(() => generateSecureToken(0)).toThrow(RangeError);
    expect(() => generateSecureToken(4096)).toThrow(RangeError);
    expect(() => generateSecureToken(32.5)).toThrow(RangeError);
  });
});

describe("hashToken", () => {
  it("is a stable sha256 hex digest", () => {
    expect(hashToken("hello")).toBe(createHash("sha256").update("hello", "utf8").digest("hex"));
    expect(hashToken("hello")).toHaveLength(64);
    expect(hashToken("hello")).toBe(hashToken("hello"));
    expect(hashToken("hello")).not.toBe(hashToken("hellp"));
  });

  it("handles non-ascii input consistently", () => {
    expect(hashToken("kuaför")).toBe(createHash("sha256").update("kuaför", "utf8").digest("hex"));
  });
});

describe("generateApiKey", () => {
  it("returns the key, its display prefix and the digest to store", () => {
    const { key, prefix, hash } = generateApiKey();

    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(prefix).toBe(key.slice(0, API_KEY_PREFIX_LENGTH));
    expect(prefix).toHaveLength(14);
    expect(prefix.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(hash).toBe(hashToken(key));
    expect(hash).toHaveLength(64);
    expect(Buffer.from(key.slice(API_KEY_PREFIX.length), "base64url")).toHaveLength(32);
    expect(apiKeyPrefix(key)).toBe(prefix);
  });

  it("issues distinct keys", () => {
    const keys = Array.from({ length: 50 }, () => generateApiKey());
    expect(new Set(keys.map((k) => k.key)).size).toBe(50);
    expect(new Set(keys.map((k) => k.hash)).size).toBe(50);
  });
});

describe("safeEqual", () => {
  it("compares values without leaking length", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcdef")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("", "a")).toBe(false);
    expect(safeEqual("kuaför", "kuaför")).toBe(true);
  });
});

describe("verifyToken", () => {
  it("accepts the original token and rejects everything else", () => {
    const token = generateSecureToken();
    const stored = hashToken(token);

    expect(verifyToken(token, stored)).toBe(true);
    expect(verifyToken(`${token}x`, stored)).toBe(false);
    expect(verifyToken(generateSecureToken(), stored)).toBe(false);
    expect(verifyToken(token, "")).toBe(false);
  });

  it("verifies an issued API key against its stored hash", () => {
    const issued = generateApiKey();
    expect(verifyToken(issued.key, issued.hash)).toBe(true);
    expect(verifyToken(issued.prefix, issued.hash)).toBe(false);
  });
});
