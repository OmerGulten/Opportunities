import { describe, expect, it } from "vitest";

import { createFakeFetcher, STRONG_HTML, WEAK_HTML } from "../../../../tests/fixtures/html";
import { WebsiteTimeoutError } from "@/lib/errors";

import { createHeuristicPerformanceProvider, gradeFor } from "./heuristic";

const URL_UNDER_TEST = "https://denizrestoran.com/";

function heavyHtml(): string {
  const scripts = Array.from({ length: 14 }, (_, i) => `<script src="/js/vendor-${i}.js"></script>`).join("\n");
  const styles = Array.from({ length: 7 }, (_, i) => `<link rel="stylesheet" href="/css/part-${i}.css">`).join("\n");
  const images = Array.from({ length: 12 }, (_, i) => `<img src="/img/${i}.jpg">`).join("\n");
  const filler = "lorem ipsum dolor sit amet ".repeat(20000);
  return `<html><head>${scripts}${styles}</head><body>${images}<p>${filler}</p></body></html>`;
}

describe("gradeFor", () => {
  it("uses the documented thresholds", () => {
    expect(gradeFor(49)).toBe("poor");
    expect(gradeFor(50)).toBe("needs_improvement");
    expect(gradeFor(89)).toBe("needs_improvement");
    expect(gradeFor(90)).toBe("good");
  });
});

describe("createHeuristicPerformanceProvider", () => {
  it("identifies itself as heuristic and never invents lab metrics", async () => {
    const provider = createHeuristicPerformanceProvider();
    const summary = await provider.audit(URL_UNDER_TEST, { html: STRONG_HTML, responseTimeMs: 120 });

    expect(provider.name).toBe("heuristic");
    expect(provider.isHeuristic).toBe(true);
    expect(summary.source).toBe("heuristic");
    expect(summary.lcpMs).toBeNull();
    expect(summary.cls).toBeNull();
    expect(summary.inpMs).toBeNull();
    expect(summary.notes[0]).toContain("not a Lighthouse score");
  });

  it("scores a lean page highly and derives the desktop score from it", async () => {
    const provider = createHeuristicPerformanceProvider();
    const summary = await provider.audit(URL_UNDER_TEST, { html: STRONG_HTML, responseTimeMs: 120 });

    expect(summary.mobileScore).toBe(100);
    expect(summary.desktopScore).toBe(100);
    expect(summary.mobileGrade).toBe("good");
  });

  it("penalises page weight, scripts, stylesheets, images and latency", async () => {
    const provider = createHeuristicPerformanceProvider();
    const summary = await provider.audit(URL_UNDER_TEST, { html: heavyHtml(), responseTimeMs: 3200 });

    expect(summary.mobileScore).not.toBeNull();
    expect(summary.mobileScore ?? 100).toBeLessThan(50);
    expect(summary.mobileGrade).toBe("poor");
    expect(summary.desktopScore).toBe(Math.min(100, (summary.mobileScore ?? 0) + 10));
    const notes = summary.notes.join(" ");
    expect(notes).toContain("KB");
    expect(notes).toContain("script tags");
    expect(notes).toContain("external stylesheets");
    expect(notes).toContain("width/height");
    expect(notes).toContain("3200 ms");
    expect(notes).toContain("viewport");
  });

  it("penalises a legacy page without a viewport", async () => {
    const provider = createHeuristicPerformanceProvider();
    const summary = await provider.audit("http://sirinkuafor.com/", { html: WEAK_HTML, responseTimeMs: 800 });

    expect(summary.mobileScore ?? 100).toBeLessThanOrEqual(85);
    expect(summary.notes.join(" ")).toContain("viewport");
  });

  it("fetches the page itself when no HTML was supplied", async () => {
    const requested: string[] = [];
    const provider = createHeuristicPerformanceProvider({
      fetcher: createFakeFetcher({ [URL_UNDER_TEST]: { body: STRONG_HTML, durationMs: 2000 } }, (url) => requested.push(url)),
    });
    const summary = await provider.audit(URL_UNDER_TEST);

    expect(requested).toEqual([URL_UNDER_TEST]);
    expect(summary.mobileScore).toBe(90);
    expect(summary.notes.join(" ")).toContain("2000 ms");
  });

  it("returns an explicit empty result when the page cannot be fetched", async () => {
    const provider = createHeuristicPerformanceProvider({
      fetcher: createFakeFetcher({ [URL_UNDER_TEST]: { error: new WebsiteTimeoutError(URL_UNDER_TEST) } }),
    });
    const summary = await provider.audit(URL_UNDER_TEST);

    expect(summary.mobileScore).toBeNull();
    expect(summary.mobileGrade).toBeNull();
    expect(summary.notes.join(" ")).toContain("timeout");
  });
});
