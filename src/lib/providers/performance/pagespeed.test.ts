import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";

import { drainPendingProviderCalls } from "../call-log";

import { createPageSpeedProvider, parsePageSpeedResponse } from "./pagespeed";

const API_KEY = "test-pagespeed-key-123";
const URL_UNDER_TEST = "https://denizrestoran.com/";

function payload(score: number) {
  return {
    lighthouseResult: {
      categories: { performance: { score } },
      audits: {
        "largest-contentful-paint": { numericValue: 2843.7 },
        "cumulative-layout-shift": { numericValue: 0.0821 },
      },
    },
    loadingExperience: { metrics: { INTERACTION_TO_NEXT_PAINT: { percentile: 213 } } },
  };
}

function fakeFetch(handler: (url: URL) => Response | Promise<Response>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return handler(new URL(href));
  }) as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("parsePageSpeedResponse", () => {
  it("maps the Lighthouse and CrUX fields", () => {
    expect(parsePageSpeedResponse(payload(0.42))).toEqual({ score: 42, lcpMs: 2844, cls: 0.082, inpMs: 213 });
  });

  it("returns nulls instead of guesses for a payload it does not recognise", () => {
    expect(parsePageSpeedResponse({})).toEqual({ score: null, lcpMs: null, cls: null, inpMs: null });
    expect(parsePageSpeedResponse(null)).toEqual({ score: null, lcpMs: null, cls: null, inpMs: null });
  });
});

describe("createPageSpeedProvider", () => {
  it("requests the documented endpoint and maps both strategies", async () => {
    const seen: URL[] = [];
    const provider = createPageSpeedProvider({
      apiKey: API_KEY,
      fetchImpl: fakeFetch((url) => {
        seen.push(url);
        return jsonResponse(payload(url.searchParams.get("strategy") === "mobile" ? 0.38 : 0.71));
      }),
    });

    const summary = await provider.audit(URL_UNDER_TEST, { strategies: ["mobile", "desktop"] });

    expect(provider.name).toBe("pagespeed");
    expect(provider.isHeuristic).toBe(false);
    expect(seen).toHaveLength(2);
    expect(seen[0].origin + seen[0].pathname).toBe("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    expect(seen[0].searchParams.get("url")).toBe(URL_UNDER_TEST);
    expect(seen[0].searchParams.get("category")).toBe("PERFORMANCE");
    expect(seen[0].searchParams.get("key")).toBe(API_KEY);
    expect(summary).toMatchObject({ source: "pagespeed", isHeuristic: false, mobileScore: 38, desktopScore: 71, lcpMs: 2844, cls: 0.082, inpMs: 213, mobileGrade: "poor" });
  });

  it("keeps the API key out of the provider call log", async () => {
    drainPendingProviderCalls();
    const provider = createPageSpeedProvider({ apiKey: API_KEY, fetchImpl: fakeFetch(() => jsonResponse(payload(0.9))) });
    await provider.audit(URL_UNDER_TEST);

    const records = drainPendingProviderCalls();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ providerName: "pagespeed", success: true, estimatedCost: 0 });
    expect(JSON.stringify(records)).not.toContain(API_KEY);
  });

  it("maps 429 to a rate limit error", async () => {
    const provider = createPageSpeedProvider({ apiKey: API_KEY, fetchImpl: fakeFetch(() => jsonResponse({ error: "quota" }, 429)) });
    await expect(provider.audit(URL_UNDER_TEST)).rejects.toMatchObject({ code: "provider_rate_limited" });
  });

  it("maps 5xx to an unavailable error", async () => {
    const provider = createPageSpeedProvider({ apiKey: API_KEY, fetchImpl: fakeFetch(() => jsonResponse({ error: "boom" }, 503)) });
    await expect(provider.audit(URL_UNDER_TEST)).rejects.toMatchObject({ code: "provider_unavailable" });
  });

  it("maps other failures to a provider error", async () => {
    const provider = createPageSpeedProvider({ apiKey: API_KEY, fetchImpl: fakeFetch(() => jsonResponse({ error: "bad request" }, 400)) });
    const error = await provider.audit(URL_UNDER_TEST).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("provider_error");
    expect((error as AppError).message).not.toContain(API_KEY);
  });

  it("maps a non-JSON body to a provider error", async () => {
    const provider = createPageSpeedProvider({
      apiKey: API_KEY,
      fetchImpl: fakeFetch(() => new Response("<html>gateway</html>", { status: 200, headers: { "content-type": "text/html" } })),
    });
    await expect(provider.audit(URL_UNDER_TEST)).rejects.toMatchObject({ code: "provider_error" });
  });

  it("maps a transport failure to an unavailable error", async () => {
    const provider = createPageSpeedProvider({
      apiKey: API_KEY,
      fetchImpl: fakeFetch(() => {
        throw new Error("socket hang up");
      }),
    });
    await expect(provider.audit(URL_UNDER_TEST)).rejects.toMatchObject({ code: "provider_unavailable" });
  });
});
