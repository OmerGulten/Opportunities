import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";

import { classifyFetchError, safeFetchUrl, safeHead, type SafeFetchOptions } from "./safe-fetch";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  redirect: RequestRedirect | undefined;
}

interface Fake {
  impl: typeof fetch;
  calls: Call[];
}

type Handler = (url: string, call: Call) => Response | Promise<Response>;

function fakeFetch(handler: Handler): Fake {
  const calls: Call[] = [];
  const impl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
      headers[key.toLowerCase()] = value;
    }
    const call: Call = { url, method: init?.method ?? "GET", headers, redirect: init?.redirect };
    calls.push(call);
    return handler(url, call);
  };
  return { impl, calls };
}

function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });
}

function redirect(location: string, status = 301): Response {
  return new Response(null, { status, headers: { location } });
}

const base: SafeFetchOptions = { resolveDns: async () => ["93.184.216.34"] };

async function caught(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error("expected the call to reject");
}

describe("safeFetchUrl — happy path", () => {
  it("fetches, decodes and reports the response", async () => {
    const fake = fakeFetch(() => html("<html><body>Merhaba</body></html>", { headers: { "content-type": "text/html; charset=utf-8", "set-cookie": "sid=1", server: "nginx" } }));
    const result = await safeFetchUrl("example.com/menu", { ...base, fetchImpl: fake.impl });

    expect(result.url).toBe("https://example.com/menu");
    expect(result.finalUrl).toBe("https://example.com/menu");
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.body).toBe("<html><body>Merhaba</body></html>");
    expect(result.bytes).toBe(33);
    expect(result.contentType).toBe("text/html; charset=utf-8");
    expect(result.redirectChain).toEqual([]);
    expect(result.https).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.headers.server).toBe("nginx");
    // Cookies are never kept.
    expect(result.headers["set-cookie"]).toBeUndefined();
  });

  it("sends the bot user agent and follows redirects manually", async () => {
    const fake = fakeFetch(() => html("ok"));
    await safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl });

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe("GET");
    expect(fake.calls[0]?.redirect).toBe("manual");
    expect(fake.calls[0]?.headers["user-agent"]).toBe("OpportunityOSBot/1.0 (+https://opportunityos.app/bot)");
    expect(fake.calls[0]?.headers.accept).toContain("text/html");
  });

  it("honours a legacy charset from the content type", async () => {
    const latin = new Uint8Array([0x47, 0xfc, 0x7a, 0x65, 0x6c]); // "Güzel" in iso-8859-9
    const fake = fakeFetch(() => new Response(latin, { status: 200, headers: { "content-type": "text/html; charset=iso-8859-9" } }));
    const result = await safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl });
    expect(result.body).toBe("Güzel");
  });

  it("applies caller headers over the defaults", async () => {
    const fake = fakeFetch(() => html("ok"));
    await safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl, headers: { "Accept-Language": "tr" }, userAgent: "Custom/1.0" });
    expect(fake.calls[0]?.headers["accept-language"]).toBe("tr");
    expect(fake.calls[0]?.headers["user-agent"]).toBe("Custom/1.0");
  });
});

describe("safeFetchUrl — redirects", () => {
  it("records the redirect chain and returns the final response", async () => {
    const fake = fakeFetch((url) => {
      if (url === "https://example.com/a") return redirect("/b", 301);
      if (url === "https://example.com/b") return redirect("https://www.example.com/c", 302);
      return html("final");
    });
    const result = await safeFetchUrl("https://example.com/a", { ...base, fetchImpl: fake.impl });

    expect(result.redirectChain).toEqual(["https://example.com/a", "https://example.com/b"]);
    expect(result.finalUrl).toBe("https://www.example.com/c");
    expect(result.body).toBe("final");
    expect(fake.calls.map((c) => c.url)).toEqual(["https://example.com/a", "https://example.com/b", "https://www.example.com/c"]);
  });

  it("blocks a redirect to a host that resolves to a private address", async () => {
    const fake = fakeFetch((url) => (url === "https://example.com/" ? redirect("https://internal.example.com/admin", 302) : html("secret")));
    const err = await caught(
      safeFetchUrl("https://example.com/", {
        fetchImpl: fake.impl,
        resolveDns: async (hostname) => (hostname === "internal.example.com" ? ["10.0.0.5"] : ["93.184.216.34"]),
      }),
    );

    expect(err.code).toBe("website_blocked");
    expect(err.details?.reason).toBe("private_ip");
    expect(err.details?.address).toBe("10.0.0.5");
    // The blocked hop was never requested.
    expect(fake.calls).toHaveLength(1);
  });

  it("blocks a redirect to an IP literal", async () => {
    const fake = fakeFetch(() => redirect("http://169.254.169.254/latest/meta-data/", 302));
    const err = await caught(safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl }));
    expect(err.code).toBe("website_blocked");
    expect(err.details?.reason).toBe("redirect_ip_literal");
    expect(fake.calls).toHaveLength(1);
  });

  it("blocks a redirect to a non-http scheme", async () => {
    const fake = fakeFetch(() => redirect("file:///etc/passwd", 302));
    const err = await caught(safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl }));
    expect(err.code).toBe("website_blocked");
    expect(err.details?.reason).toBe("redirect_scheme");
  });

  it("stops after maxRedirects hops", async () => {
    const fake = fakeFetch((url) => redirect(`${url}x`, 302));
    const err = await caught(safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl, maxRedirects: 2 }));

    expect(err.code).toBe("website_blocked");
    expect(err.details?.reason).toBe("too_many_redirects");
    expect(fake.calls).toHaveLength(3); // initial + 2 allowed hops
  });

  it("rejects a redirect without a Location header", async () => {
    const fake = fakeFetch(() => new Response(null, { status: 302 }));
    const err = await caught(safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl }));
    expect(err.details?.reason).toBe("redirect_without_location");
  });
});

describe("safeFetchUrl — DNS guard", () => {
  it("blocks a hostname resolving to a private address before any request", async () => {
    const fake = fakeFetch(() => html("never"));
    const err = await caught(safeFetchUrl("https://intranet.example.com/", { fetchImpl: fake.impl, resolveDns: async () => ["93.184.216.34", "192.168.1.10"] }));

    expect(err.code).toBe("website_blocked");
    expect(err.details?.reason).toBe("private_ip");
    expect(fake.calls).toHaveLength(0);
  });

  it("blocks IPv4-mapped IPv6 answers", async () => {
    const fake = fakeFetch(() => html("never"));
    const err = await caught(safeFetchUrl("https://example.com/", { fetchImpl: fake.impl, resolveDns: async () => ["::ffff:127.0.0.1"] }));
    expect(err.details?.reason).toBe("private_ip");
    expect(fake.calls).toHaveLength(0);
  });

  it("fails closed when the resolver returns something that is not an address", async () => {
    const fake = fakeFetch(() => html("never"));
    const err = await caught(safeFetchUrl("https://example.com/", { fetchImpl: fake.impl, resolveDns: async () => ["not-an-address"] }));
    expect(err.details?.reason).toBe("unparsable_ip");
    expect(fake.calls).toHaveLength(0);
  });

  it("reports an unresolvable hostname as unreachable", async () => {
    const fake = fakeFetch(() => html("never"));
    const err = await caught(
      safeFetchUrl("https://nx.example.com/", {
        fetchImpl: fake.impl,
        resolveDns: async () => {
          throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" });
        },
      }),
    );

    expect(err.code).toBe("provider_unavailable");
    expect(err.details?.reason).toBe("enotfound");
    expect(classifyFetchError(err)).toBe("unreachable");
  });

  it("reports an empty DNS answer as unreachable", async () => {
    const err = await caught(safeFetchUrl("https://example.com/", { fetchImpl: fakeFetch(() => html("x")).impl, resolveDns: async () => [] }));
    expect(err.details?.reason).toBe("dns_no_records");
  });

  it("maps connection failures to provider_unavailable", async () => {
    const fake = fakeFetch(() => {
      throw Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
    });
    const err = await caught(safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl }));
    expect(err.code).toBe("provider_unavailable");
    expect(err.details?.reason).toBe("econnrefused");
  });
});

describe("safeFetchUrl — limits", () => {
  it("throws when the body exceeds maxBytes", async () => {
    const fake = fakeFetch(() => html("a".repeat(5000)));
    const err = await caught(safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl, maxBytes: 1000 }));

    expect(err.code).toBe("website_too_large");
    expect(err.details?.limitBytes).toBe(1000);
    expect(classifyFetchError(err)).toBe("too_large");
  });

  it("truncates instead when asked", async () => {
    const fake = fakeFetch(() => html("a".repeat(5000)));
    const result = await safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl, maxBytes: 1000, truncateInsteadOfFail: true });

    expect(result.truncated).toBe(true);
    expect(result.bytes).toBe(1000);
    expect(result.body).toHaveLength(1000);
  });

  it("refuses an oversized declared content-length without reading the body", async () => {
    const fake = fakeFetch(() => html("small", { headers: { "content-type": "text/html", "content-length": "9000000" } }));
    const err = await caught(safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl, maxBytes: 1000 }));
    expect(err.code).toBe("website_too_large");
  });

  it("times out on a hanging response", async () => {
    const fake = fakeFetch(() => new Promise<Response>(() => undefined));
    const err = await caught(safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl, timeoutMs: 25 }));

    expect(err.code).toBe("website_timeout");
    expect(err.details?.timeoutMs).toBe(25);
    expect(classifyFetchError(err)).toBe("timeout");
  });

  it("rejects a content type the audit cannot read", async () => {
    const fake = fakeFetch(() => new Response("binary", { status: 200, headers: { "content-type": "image/png" } }));
    const err = await caught(safeFetchUrl("https://example.com/logo.png", { ...base, fetchImpl: fake.impl }));

    expect(err.code).toBe("website_blocked");
    expect(err.details?.reason).toBe("content_type");
  });

  it("accepts xml and json payloads by default", async () => {
    const fake = fakeFetch((url) =>
      url.endsWith("sitemap.xml")
        ? new Response("<urlset/>", { status: 200, headers: { "content-type": "application/xml" } })
        : new Response("{}", { status: 200, headers: { "content-type": "application/ld+json" } }),
    );
    await expect(safeFetchUrl("https://example.com/sitemap.xml", { ...base, fetchImpl: fake.impl })).resolves.toMatchObject({ status: 200 });
    await expect(safeFetchUrl("https://example.com/data", { ...base, fetchImpl: fake.impl })).resolves.toMatchObject({ status: 200 });
  });

  it("keeps a response with no content-type header", async () => {
    const fake = fakeFetch(() => new Response("plain", { status: 200, headers: {} }));
    const result = await safeFetchUrl("https://example.com/", { ...base, fetchImpl: fake.impl });
    expect(result.status).toBe(200);
  });
});

describe("safeFetchUrl — policy", () => {
  it("never requests a URL the policy rejects", async () => {
    const fake = fakeFetch(() => html("never"));
    const err = await caught(safeFetchUrl("http://169.254.169.254/latest/meta-data/", { ...base, fetchImpl: fake.impl }));
    expect(err.code).toBe("website_invalid_url");
    expect(fake.calls).toHaveLength(0);
  });

  it("allows private networks only when explicitly opted in", async () => {
    const fake = fakeFetch(() => html("dev"));
    const result = await safeFetchUrl("http://localhost:3000/health", {
      fetchImpl: fake.impl,
      allowPrivateNetworks: true,
      allowedPorts: [3000],
      resolveDns: async () => ["127.0.0.1"],
    });
    expect(result.ok).toBe(true);
    expect(result.https).toBe(false);
  });

  it("honours a caller blocklist", async () => {
    const fake = fakeFetch(() => html("never"));
    const err = await caught(safeFetchUrl("https://blocked.example/", { ...base, fetchImpl: fake.impl, blocklist: ["blocked.example"] }));
    expect(err.code).toBe("website_blocked");
    expect(err.details?.reason).toBe("blocked_hostname");
    expect(fake.calls).toHaveLength(0);
  });
});

describe("safeHead", () => {
  it("sends HEAD and returns the headers", async () => {
    const fake = fakeFetch(() => new Response(null, { status: 200, headers: { "content-type": "image/png", "content-length": "12345" } }));
    const result = await safeHead("https://example.com/logo.png", { ...base, fetchImpl: fake.impl });

    expect(result.status).toBe(200);
    expect(result.body).toBe("");
    expect(result.bytes).toBe(0);
    expect(result.contentType).toBe("image/png");
  });

  it("falls back to a truncated GET when HEAD is not supported", async () => {
    const fake = fakeFetch((_url, call) => (call.method === "HEAD" ? new Response(null, { status: 405 }) : html("a".repeat(4000))));
    const result = await safeHead("https://example.com/", { ...base, fetchImpl: fake.impl });

    expect(fake.calls.map((c) => c.method)).toEqual(["HEAD", "GET"]);
    expect(result.status).toBe(200);
    expect(result.truncated).toBe(true);
    expect(result.bytes).toBe(1024);
  });

  it("falls back on 501 as well", async () => {
    const fake = fakeFetch((_url, call) => (call.method === "HEAD" ? new Response(null, { status: 501 }) : html("ok")));
    const result = await safeHead("https://example.com/", { ...base, fetchImpl: fake.impl });
    expect(fake.calls.map((c) => c.method)).toEqual(["HEAD", "GET"]);
    expect(result.ok).toBe(true);
  });

  it("reports a 404 without throwing", async () => {
    const fake = fakeFetch(() => new Response(null, { status: 404 }));
    const result = await safeHead("https://example.com/missing", { ...base, fetchImpl: fake.impl });
    expect(result.status).toBe(404);
    expect(result.ok).toBe(false);
  });
});

describe("classifyFetchError", () => {
  it("maps typed errors to a stable kind", async () => {
    expect(classifyFetchError(new AppError("website_timeout", "t"))).toBe("timeout");
    expect(classifyFetchError(new AppError("website_blocked", "b"))).toBe("blocked");
    expect(classifyFetchError(new AppError("website_too_large", "l"))).toBe("too_large");
    expect(classifyFetchError(new AppError("website_invalid_url", "u"))).toBe("invalid_url");
    expect(classifyFetchError(new AppError("provider_unavailable", "n"))).toBe("unreachable");
    expect(classifyFetchError(new AppError("internal_error", "x"))).toBe("unknown");
  });

  it("maps raw runtime failures", () => {
    expect(classifyFetchError(Object.assign(new Error("aborted"), { name: "AbortError" }))).toBe("timeout");
    expect(classifyFetchError(new TypeError("fetch failed"))).toBe("unreachable");
    expect(classifyFetchError(Object.assign(new Error("boom"), { code: "ECONNRESET" }))).toBe("unreachable");
    expect(classifyFetchError(new Error("something else"))).toBe("unknown");
    expect(classifyFetchError("nope")).toBe("unknown");
  });
});
