import { describe, expect, it } from "vitest";

import { createFakeFetcher, STRONG_BUSINESS_NAME, STRONG_HTML, WEAK_BUSINESS_NAME, WEAK_HTML } from "../../../../tests/fixtures/html";
import { WebsiteBlockedError, WebsiteTimeoutError } from "@/lib/errors";
import type { Signal } from "@/types/signals";

import { auditWebsite } from "./audit";

const STRONG_URL = "https://denizrestoran.com/";
const SITEMAP_URL = "https://denizrestoran.com/sitemap-index.xml";

function index(signals: readonly Signal[]): Map<string, Signal> {
  return new Map(signals.map((signal) => [signal.signalType, signal]));
}

function strongRoutes() {
  return {
    [STRONG_URL]: { body: STRONG_HTML },
    "/robots.txt": { body: `User-agent: *\nAllow: /\nSitemap: ${SITEMAP_URL}\n`, contentType: "text/plain" },
    [SITEMAP_URL]: { body: '<?xml version="1.0"?><urlset><url><loc>https://denizrestoran.com/</loc></url></urlset>', contentType: "application/xml" },
  };
}

describe("auditWebsite without a URL", () => {
  it("reports not_found and derives only the consequences of having no site", async () => {
    let calls = 0;
    const fetcher = createFakeFetcher({}, () => {
      calls += 1;
    });
    const { outcome, html, responseTimeMs } = await auditWebsite({
      url: null,
      businessName: "Kayıp İşletme",
      locale: "tr",
      depth: "basic",
      fetcher,
    });

    expect(calls).toBe(0);
    expect(html).toBeNull();
    expect(responseTimeMs).toBeNull();
    expect(outcome.status).toBe("completed");
    expect(outcome.observation).toBe("not_found");
    expect(outcome.summary.websiteStatus).toBe("not_found");

    const signals = index(outcome.signals);
    expect(signals.get("website.status")).toMatchObject({ value: "not_found", status: "not_found", evidenceType: "observed", confidence: "high" });
    for (const derived of ["website.has_cta", "website.has_booking", "website.has_contact_info"]) {
      expect(signals.get(derived)).toMatchObject({ value: false, status: "found", evidenceType: "derived", confidence: "medium" });
    }
    expect(signals.get("website.has_h1")).toMatchObject({ status: "not_checked", evidenceType: "unavailable", value: null });
    expect(signals.get("website.quality")?.status).toBe("not_checked");
    expect(outcome.findings.map((finding) => finding.key)).toContain("website_not_found");
    expect(outcome.findings[0].title).not.toBe("website_not_found.title");
  });
});

describe("auditWebsite when the page cannot be read", () => {
  it("maps a timeout to unreachable, never to not_found", async () => {
    const fetcher = createFakeFetcher({ [STRONG_URL]: { error: new WebsiteTimeoutError(STRONG_URL) } });
    const { outcome } = await auditWebsite({ url: STRONG_URL, businessName: "X", locale: "tr", depth: "basic", fetcher });

    expect(outcome.summary.websiteStatus).toBe("unreachable");
    expect(outcome.observation).toBe("unavailable");
    const signals = index(outcome.signals);
    expect(signals.get("website.status")).toMatchObject({ value: "unreachable", status: "found" });
    expect(signals.get("website.has_cta")?.status).toBe("not_checked");
    expect(outcome.findings.map((finding) => finding.key)).toContain("website_unreachable");
  });

  it("maps a blocked host to invalid", async () => {
    const fetcher = createFakeFetcher({ [STRONG_URL]: { error: new WebsiteBlockedError("private_ip") } });
    const { outcome } = await auditWebsite({ url: STRONG_URL, businessName: "X", locale: "tr", depth: "basic", fetcher });

    expect(outcome.summary.websiteStatus).toBe("invalid");
    expect(outcome.observation).toBe("error");
    expect(outcome.findings.map((finding) => finding.key)).toContain("website_invalid");
  });

  it("rejects an unusable address before fetching", async () => {
    let calls = 0;
    const fetcher = createFakeFetcher({}, () => {
      calls += 1;
    });
    const { outcome } = await auditWebsite({ url: "http://localhost:3000", businessName: "X", locale: "tr", depth: "basic", fetcher });

    expect(calls).toBe(0);
    expect(outcome.summary.websiteStatus).toBe("invalid");
  });

  it("treats a non-2xx response as unreachable and records the status code", async () => {
    const fetcher = createFakeFetcher({ [STRONG_URL]: { status: 503, body: "" } });
    const { outcome } = await auditWebsite({ url: STRONG_URL, businessName: "X", locale: "tr", depth: "basic", fetcher });

    expect(outcome.summary.websiteStatus).toBe("unreachable");
    expect(index(outcome.signals).get("website.status_code")).toMatchObject({ value: 503 });
  });
});

describe("auditWebsite on a page it could read", () => {
  it("records a cross-host redirect as an info finding and still reports found", async () => {
    const fetcher = createFakeFetcher({
      "https://eskisite.com/": { body: STRONG_HTML, finalUrl: STRONG_URL, redirectChain: ["https://eskisite.com/", STRONG_URL] },
      "/robots.txt": { status: 404 },
    });
    const { outcome } = await auditWebsite({ url: "https://eskisite.com", businessName: STRONG_BUSINESS_NAME, locale: "tr", depth: "basic", fetcher });

    expect(outcome.summary.websiteStatus).toBe("found");
    const redirected = outcome.findings.find((finding) => finding.key === "website_redirected");
    expect(redirected).toBeDefined();
    expect(redirected?.severity).toBe("info");
    expect(redirected?.evidence.redirectChain).toEqual(["https://eskisite.com/", STRONG_URL]);
  });

  it("detects robots.txt and the sitemap declared inside it", async () => {
    const requested: string[] = [];
    const fetcher = createFakeFetcher(strongRoutes(), (url) => requested.push(url));
    const { outcome } = await auditWebsite({ url: STRONG_URL, businessName: STRONG_BUSINESS_NAME, locale: "tr", depth: "basic", fetcher });

    expect(requested).toContain("https://denizrestoran.com/robots.txt");
    expect(requested).toContain(SITEMAP_URL);
    expect(outcome.summary.technical?.hasRobotsTxt).toBe(true);
    expect(outcome.summary.technical?.hasSitemap).toBe(true);
    const signals = index(outcome.signals);
    expect(signals.get("website.has_robots")).toMatchObject({ value: true, status: "found" });
    expect(signals.get("website.has_sitemap")).toMatchObject({ value: true, status: "found" });
  });

  it("marks robots and sitemap as not checked when the extra requests are disabled", async () => {
    const fetcher = createFakeFetcher({ [STRONG_URL]: { body: STRONG_HTML } });
    const { outcome } = await auditWebsite({
      url: STRONG_URL,
      businessName: STRONG_BUSINESS_NAME,
      locale: "tr",
      depth: "basic",
      fetcher,
      checkSitemapAndRobots: false,
    });

    const signals = index(outcome.signals);
    expect(signals.get("website.has_robots")?.status).toBe("not_checked");
    expect(signals.get("website.has_sitemap")?.status).toBe("not_checked");
    expect(outcome.findings.map((finding) => finding.key)).not.toContain("website_missing_sitemap");
  });

  it("scores a complete page as strong and emits observed signals", async () => {
    const fetcher = createFakeFetcher(strongRoutes());
    const { outcome, html, responseTimeMs } = await auditWebsite({
      url: STRONG_URL,
      businessName: STRONG_BUSINESS_NAME,
      locale: "tr",
      depth: "basic",
      fetcher,
    });

    expect(html).toBe(STRONG_HTML);
    expect(responseTimeMs).toBe(120);
    expect(outcome.summary.quality).toBe("strong");
    expect(outcome.summary.qualityScore ?? 0).toBeGreaterThan(70);
    expect(outcome.summary.seo?.titleQuality).toBe("good");
    expect(outcome.summary.seo?.descriptionQuality).toBe("good");
    expect(outcome.summary.branding?.consistencyScore).toBeGreaterThanOrEqual(85);

    const signals = index(outcome.signals);
    expect(signals.get("website.https")).toMatchObject({ value: true, evidenceType: "observed" });
    expect(signals.get("website.has_cta")).toMatchObject({ value: true });
    expect(signals.get("website.has_whatsapp")).toMatchObject({ value: true });
    expect(signals.get("website.mobile_friendly")).toMatchObject({ value: true, evidenceType: "heuristic" });
    expect(signals.get("website.quality")).toMatchObject({ value: "strong", evidenceType: "derived" });
    expect(signals.get("website.broken_links_count")?.status).toBe("not_checked");
  });

  it("scores a legacy page as weak with the matching findings", async () => {
    const fetcher = createFakeFetcher({ "http://sirinkuafor.com/": { body: WEAK_HTML }, "/robots.txt": { status: 404 } });
    const { outcome } = await auditWebsite({ url: "http://sirinkuafor.com", businessName: WEAK_BUSINESS_NAME, locale: "tr", depth: "basic", fetcher });

    expect(outcome.summary.quality).toBe("weak");
    expect(outcome.summary.qualityScore ?? 100).toBeLessThan(45);
    const keys = outcome.findings.map((finding) => finding.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "website_no_https",
        "website_weak_title",
        "website_missing_meta_description",
        "website_missing_h1",
        "website_missing_viewport",
        "website_missing_cta",
        "website_not_mobile_friendly",
        "website_quality_weak",
      ]),
    );
    const mobile = outcome.findings.find((finding) => finding.key === "website_not_mobile_friendly");
    expect(mobile?.evidenceType).toBe("heuristic");
    expect(index(outcome.signals).get("website.mobile_friendly")).toMatchObject({ value: false, evidenceType: "heuristic" });
  });

  it("samples internal links with HEAD at deep depth", async () => {
    const methods: string[] = [];
    const fetcher = createFakeFetcher(
      {
        ...strongRoutes(),
        "https://denizrestoran.com/menu": { status: 404 },
        "https://denizrestoran.com/rezervasyon": { status: 200, body: "<html></html>" },
        "https://denizrestoran.com/iletisim": { status: 200, body: "<html></html>" },
        "https://denizrestoran.com/favicon.ico": { status: 200, body: "", contentType: "image/x-icon" },
      },
      (_url, method) => methods.push(method),
    );
    const { outcome } = await auditWebsite({
      url: STRONG_URL,
      businessName: STRONG_BUSINESS_NAME,
      locale: "tr",
      depth: "deep",
      fetcher,
      brokenLinkSample: 3,
    });

    expect(methods).toContain("HEAD");
    expect(outcome.summary.technical?.brokenLinksChecked).toBeGreaterThan(0);
    expect(outcome.summary.technical?.brokenLinksFound).toBe(1);
    expect(index(outcome.signals).get("website.broken_links_count")).toMatchObject({ value: 1, status: "found" });
    expect(outcome.findings.map((finding) => finding.key)).toContain("website_broken_links");
  });
});
