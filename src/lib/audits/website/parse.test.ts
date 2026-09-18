import { describe, expect, it } from "vitest";

import { AVERAGE_HTML, STRONG_BUSINESS_NAME, STRONG_HTML, WEAK_BUSINESS_NAME, WEAK_HTML } from "../../../../tests/fixtures/html";

import { foldText, parseHtml } from "./parse";

const STRONG_URL = "https://denizrestoran.com/";
const WEAK_URL = "http://sirinkuafor.com/";

describe("foldText", () => {
  it("folds Turkish characters so matching is diacritic-insensitive", () => {
    expect(foldText("Şirin Kuaför İSTANBUL")).toBe("sirin kuafor istanbul");
    expect(foldText("İletişim  -  Çağrı")).toBe("iletisim cagri");
  });
});

describe("parseHtml on a well-built page", () => {
  const parsed = parseHtml(STRONG_HTML, STRONG_URL, STRONG_BUSINESS_NAME);

  it("reads the head metadata", () => {
    expect(parsed.title).toBe("Deniz Restoran Kadıköy | Balık ve Meze");
    expect(parsed.metaDescription).not.toBeNull();
    expect((parsed.metaDescription ?? "").length).toBeGreaterThanOrEqual(50);
    expect(parsed.lang).toBe("tr");
    expect(parsed.languageDeclared).toBe(true);
    expect(parsed.viewport).toContain("width=device-width");
    expect(parsed.canonical).toBe("https://denizrestoran.com/");
    expect(parsed.twitterCard).toBe("summary_large_image");
    expect(parsed.ogTags["og:title"]).toBe("Deniz Restoran Kadıköy");
    expect(parsed.ogTags["og:site_name"]).toBe("Deniz Restoran Kadıköy");
  });

  it("collects JSON-LD types from @graph and from array @type values", () => {
    expect(parsed.jsonLdTypes).toEqual(expect.arrayContaining(["Restaurant", "LocalBusiness", "PostalAddress", "OpeningHoursSpecification"]));
  });

  it("resolves favicon links and reports no implicit candidate", () => {
    expect(parsed.faviconLinks).toEqual(["https://denizrestoran.com/favicon.ico"]);
    expect(parsed.implicitFavicon).toBeNull();
  });

  it("counts headings and images", () => {
    expect(parsed.h1s).toHaveLength(1);
    expect(parsed.h2s).toHaveLength(2);
    expect(parsed.headingCount).toBe(3);
    expect(parsed.images.total).toBe(3);
    expect(parsed.images.withAlt).toBe(3);
    expect(parsed.images.withoutDimensions).toBe(0);
  });

  it("classifies links by kind and platform", () => {
    expect(parsed.links.tel).toContain("+902161234567");
    expect(parsed.links.mailto).toContain("bilgi@denizrestoran.com");
    expect(parsed.links.whatsapp).toEqual(["https://wa.me/905321234567"]);
    expect(parsed.links.social.map((link) => link.platform).sort()).toEqual(["facebook", "instagram"]);
    expect(parsed.links.internal).toEqual(expect.arrayContaining(["https://denizrestoran.com/menu", "https://denizrestoran.com/rezervasyon"]));
    expect(parsed.links.external).toHaveLength(0);
  });

  it("detects contact, hours, CTA, booking and menu evidence", () => {
    expect(parsed.phoneMatches.length).toBeGreaterThan(0);
    expect(parsed.emailMatches).toContain("bilgi@denizrestoran.com");
    expect(parsed.addressHints.length).toBeGreaterThan(0);
    expect(parsed.openingHoursHints.length).toBeGreaterThan(0);
    expect(parsed.ctaCandidates).toEqual(expect.arrayContaining(["Rezervasyon Yap"]));
    expect(parsed.booking.found).toBe(true);
    expect(parsed.menu.found).toBe(true);
  });

  it("measures weight, scripts and styles", () => {
    expect(parsed.wordCount).toBeGreaterThan(150);
    expect(parsed.scripts.total).toBe(1);
    expect(parsed.scripts.external).toBe(1);
    expect(parsed.scripts.inHeadBlocking).toBe(0);
    expect(parsed.styles.external).toBe(1);
    expect(parsed.htmlBytes).toBeGreaterThan(1000);
    expect(parsed.hasFixedWidthLayout).toBe(false);
  });

  it("finds the logo and recognises the business name", () => {
    expect(parsed.logo.found).toBe(true);
    expect(parsed.logo.url).toBe("https://denizrestoran.com/img/logo.svg");
    expect(parsed.nameConsistency).toBe(true);
  });
});

describe("parseHtml on a legacy page", () => {
  const parsed = parseHtml(WEAK_HTML, WEAK_URL, WEAK_BUSINESS_NAME);

  it("reports the missing head metadata as absent, not as unknown", () => {
    expect(parsed.title).toBe("Anasayfa");
    expect(parsed.metaDescription).toBeNull();
    expect(parsed.canonical).toBeNull();
    expect(parsed.viewport).toBeNull();
    expect(parsed.lang).toBeNull();
    expect(parsed.languageDeclared).toBe(false);
    expect(parsed.ogTags).toEqual({});
    expect(parsed.jsonLdTypes).toEqual([]);
  });

  it("offers /favicon.ico as an implicit candidate when no icon link exists", () => {
    expect(parsed.faviconLinks).toEqual([]);
    expect(parsed.implicitFavicon).toBe("http://sirinkuafor.com/favicon.ico");
  });

  it("detects the fixed desktop layout and render-blocking scripts", () => {
    expect(parsed.hasFixedWidthLayout).toBe(true);
    expect(parsed.scripts.total).toBe(4);
    expect(parsed.scripts.external).toBe(3);
    expect(parsed.scripts.inHeadBlocking).toBe(4);
  });

  it("finds no headings, alt text, CTA or social links", () => {
    expect(parsed.h1s).toEqual([]);
    expect(parsed.images.total).toBe(4);
    expect(parsed.images.withAlt).toBe(0);
    expect(parsed.images.withoutDimensions).toBe(4);
    expect(parsed.ctaCandidates).toEqual([]);
    expect(parsed.links.social).toEqual([]);
    expect(parsed.booking.found).toBe(false);
    expect(parsed.nameConsistency).toBe(false);
  });
});

describe("parseHtml edge cases", () => {
  it("ignores malformed JSON-LD instead of throwing", () => {
    const html = `<html><head><script type="application/ld+json">{ "@type": </script></head><body><p>hi</p></body></html>`;
    expect(() => parseHtml(html, "https://example.com/", "Example")).not.toThrow();
    expect(parseHtml(html, "https://example.com/", "Example").jsonLdTypes).toEqual([]);
  });

  it("reads microdata item types", () => {
    const html = `<html><body><div itemscope itemtype="https://schema.org/LocalBusiness"><span>x</span></div></body></html>`;
    expect(parseHtml(html, "https://example.com/", "Example").microdataTypes).toEqual(["LocalBusiness"]);
  });

  it("treats post and reel URLs as links without a profile handle", () => {
    const html = `<html><body><a href="https://www.instagram.com/p/Cabc123/">Gönderi</a></body></html>`;
    const parsed = parseHtml(html, "https://example.com/", "Example");
    expect(parsed.links.social).toEqual([{ platform: "instagram", url: "https://www.instagram.com/p/Cabc123/" }]);
  });

  it("keeps an average page's partial metadata", () => {
    const parsed = parseHtml(AVERAGE_HTML, "https://ahmetemlak.com/", "Ahmet Emlak");
    expect(parsed.title).toBe("Ahmet Emlak");
    expect(parsed.metaDescription).toBe("Bahçelievler emlak ofisi.");
    expect(parsed.images.withAlt).toBe(1);
    expect(parsed.images.total).toBe(3);
    expect(parsed.links.social.map((link) => link.platform)).toEqual(["facebook"]);
    expect(parsed.nameConsistency).toBe(true);
  });
});
