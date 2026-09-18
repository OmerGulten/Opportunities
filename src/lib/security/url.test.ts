import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";

import { analyzeWebsiteUrl, assertSafeUrl, isBlockedHostname, normalizeWebsiteUrl, resolveRedirectLocation } from "./url";

function codeOf(fn: () => unknown): { code: string; reason: unknown } {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return { code: err.code, reason: err.details?.reason };
    throw err;
  }
  throw new Error("expected the call to throw");
}

describe("normalizeWebsiteUrl", () => {
  it("adds https, lowercases the host and keeps path and query", () => {
    expect(normalizeWebsiteUrl("Example.COM/Menu?x=1")).toBe("https://example.com/Menu?x=1");
    expect(normalizeWebsiteUrl("  https://www.example.com  ")).toBe("https://www.example.com/");
    expect(normalizeWebsiteUrl("HTTP://Example.com/a")).toBe("http://example.com/a");
    expect(normalizeWebsiteUrl("//example.com/a")).toBe("https://example.com/a");
  });

  it("drops the fragment and the trailing root dot", () => {
    expect(normalizeWebsiteUrl("https://example.com/a#section")).toBe("https://example.com/a");
    expect(normalizeWebsiteUrl("https://example.com./a")).toBe("https://example.com/a");
  });

  it("applies IDN punycode", () => {
    expect(normalizeWebsiteUrl("https://güzelkuaför.example/randevu")).toBe("https://xn--gzelkuafr-77a2d.example/randevu");
  });

  it("rejects non-http(s) schemes", () => {
    for (const input of ["ftp://example.com", "javascript:alert(1)", "mailto:a@example.com", "data:text/html,hi", "file:///etc/passwd"]) {
      expect(normalizeWebsiteUrl(input), input).toBeNull();
    }
  });

  it("rejects embedded credentials", () => {
    expect(normalizeWebsiteUrl("https://user:pass@example.com")).toBeNull();
    expect(normalizeWebsiteUrl("https://user@example.com")).toBeNull();
  });

  it("rejects dotless hosts and IP literals by default", () => {
    expect(normalizeWebsiteUrl("http://localhost")).toBeNull();
    expect(normalizeWebsiteUrl("http://intranet/reports")).toBeNull();
    expect(normalizeWebsiteUrl("http://127.0.0.1")).toBeNull();
    expect(normalizeWebsiteUrl("http://[::1]/")).toBeNull();
    expect(normalizeWebsiteUrl("http://2130706433/")).toBeNull();
  });

  it("allows IP literals and extra ports when the policy says so", () => {
    expect(normalizeWebsiteUrl("http://93.184.216.34/a", { allowIpLiterals: true })).toBe("http://93.184.216.34/a");
    expect(normalizeWebsiteUrl("http://example.com:8080/a")).toBeNull();
    expect(normalizeWebsiteUrl("http://example.com:8080/a", { allowedPorts: [8080] })).toBe("http://example.com:8080/a");
    expect(normalizeWebsiteUrl("https://example.com:443/a")).toBe("https://example.com/a");
    expect(normalizeWebsiteUrl("http://localhost:3000/a", { allowPrivateHostnames: true, allowedPorts: [3000] })).toBe(
      "http://localhost:3000/a",
    );
  });

  it("rejects empty and unparsable input", () => {
    expect(normalizeWebsiteUrl("")).toBeNull();
    expect(normalizeWebsiteUrl("   ")).toBeNull();
    expect(normalizeWebsiteUrl("https://")).toBeNull();
    expect(normalizeWebsiteUrl("http://[")).toBeNull();
  });

  it("reports why an address was rejected", () => {
    expect(analyzeWebsiteUrl("")).toEqual({ ok: false, reason: "empty" });
    expect(analyzeWebsiteUrl("ftp://example.com")).toEqual({ ok: false, reason: "scheme" });
    expect(analyzeWebsiteUrl("https://u:p@example.com")).toEqual({ ok: false, reason: "userinfo" });
    expect(analyzeWebsiteUrl("https://intranet")).toEqual({ ok: false, reason: "hostname" });
    expect(analyzeWebsiteUrl("https://127.0.0.1")).toEqual({ ok: false, reason: "ip_literal" });
    expect(analyzeWebsiteUrl("https://example.com:99")).toEqual({ ok: false, reason: "port" });
  });
});

describe("isBlockedHostname", () => {
  it("blocks loopback, internal and metadata names", () => {
    for (const host of [
      "localhost",
      "LOCALHOST",
      "api.localhost",
      "db.internal",
      "printer.local",
      "metadata.google.internal",
      "metadata.goog",
      "169.254.169.254",
    ]) {
      expect(isBlockedHostname(host), host).toBe(true);
    }
    expect(isBlockedHostname("")).toBe(true);
  });

  it("does not block ordinary hosts", () => {
    for (const host of ["example.com", "www.localhost.example.com", "internal.example.com", "local.example.com"]) {
      expect(isBlockedHostname(host), host).toBe(false);
    }
  });

  it("honours a caller blocklist, including subdomains and wildcard entries", () => {
    const opts = { blocklist: ["blocked.example", "*.partner.example"] };
    expect(isBlockedHostname("blocked.example", opts)).toBe(true);
    expect(isBlockedHostname("api.blocked.example", opts)).toBe(true);
    expect(isBlockedHostname("api.partner.example", opts)).toBe(true);
    expect(isBlockedHostname("partner.example", opts)).toBe(false);
    expect(isBlockedHostname("other.example", opts)).toBe(false);
  });

  it("keeps the caller blocklist active when private hostnames are allowed", () => {
    expect(isBlockedHostname("localhost", { allowPrivateHostnames: true })).toBe(false);
    expect(isBlockedHostname("localhost", { allowPrivateHostnames: true, blocklist: ["localhost"] })).toBe(true);
  });
});

describe("assertSafeUrl", () => {
  it("returns the normalised URL", () => {
    const url = assertSafeUrl("Example.com/a#b");
    expect(url.toString()).toBe("https://example.com/a");
    expect(url.hostname).toBe("example.com");
  });

  it("throws website_invalid_url with a reason for syntactic problems", () => {
    expect(codeOf(() => assertSafeUrl("javascript:alert(1)"))).toEqual({ code: "website_invalid_url", reason: "scheme" });
    expect(codeOf(() => assertSafeUrl("https://u:p@example.com"))).toEqual({ code: "website_invalid_url", reason: "userinfo" });
    expect(codeOf(() => assertSafeUrl(""))).toEqual({ code: "website_invalid_url", reason: "empty" });
  });

  it("throws website_blocked for policy violations", () => {
    expect(codeOf(() => assertSafeUrl("http://api.localhost/"))).toEqual({
      code: "website_blocked",
      reason: "blocked_hostname",
    });
    expect(codeOf(() => assertSafeUrl("http://metadata.google.internal/computeMetadata/v1/"))).toEqual({
      code: "website_blocked",
      reason: "blocked_hostname",
    });
    expect(codeOf(() => assertSafeUrl("http://169.254.169.254/latest/meta-data/", { allowIpLiterals: true }))).toEqual({
      code: "website_blocked",
      reason: "blocked_hostname",
    });
    expect(codeOf(() => assertSafeUrl("http://10.0.0.5/admin", { allowIpLiterals: true }))).toEqual({
      code: "website_blocked",
      reason: "private_ip",
    });
    expect(codeOf(() => assertSafeUrl("http://[::1]/", { allowIpLiterals: true }))).toEqual({
      code: "website_blocked",
      reason: "private_ip",
    });
  });

  it("canonicalises obfuscated numeric hosts and blocks what is behind them", () => {
    for (const input of ["http://0177.0.0.1/", "http://2130706433/", "http://0x7f.1/", "http://127.1/"]) {
      expect(codeOf(() => assertSafeUrl(input, { allowIpLiterals: true })), input).toEqual({
        code: "website_blocked",
        reason: "private_ip",
      });
    }
    // Without `allowIpLiterals` they never get that far: they are literals, not names.
    expect(codeOf(() => assertSafeUrl("http://2130706433/"))).toEqual({ code: "website_invalid_url", reason: "ip_literal" });
  });

  it("accepts a public IP literal when the policy allows literals", () => {
    expect(assertSafeUrl("http://93.184.216.34/a", { allowIpLiterals: true }).toString()).toBe("http://93.184.216.34/a");
  });

  it("allows development hosts only when the policy opts in", () => {
    expect(codeOf(() => assertSafeUrl("http://localhost:3000"))).toEqual({ code: "website_invalid_url", reason: "hostname" });
    expect(
      assertSafeUrl("http://localhost:3000", { allowPrivateHostnames: true, allowedPorts: [3000] }).toString(),
    ).toBe("http://localhost:3000/");
  });
});

describe("resolveRedirectLocation", () => {
  const base = new URL("https://example.com/a/b?x=1");

  it("resolves relative, absolute and protocol-relative locations", () => {
    expect(resolveRedirectLocation("/c", base)?.toString()).toBe("https://example.com/c");
    expect(resolveRedirectLocation("d", base)?.toString()).toBe("https://example.com/a/d");
    expect(resolveRedirectLocation("//other.example/x", base)?.toString()).toBe("https://other.example/x");
    expect(resolveRedirectLocation("https://other.example/x", base)?.toString()).toBe("https://other.example/x");
  });

  it("returns null for garbage", () => {
    expect(resolveRedirectLocation("http://[", base)).toBeNull();
  });
});
