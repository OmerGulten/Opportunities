import { parseHtml } from "@/lib/audits/website/parse";
import { createLogger } from "@/lib/logging";
import { classifyFetchError, safeFetchUrl, type SafeFetcher } from "@/lib/security/safe-fetch";
import type { PerformanceAuditSummary } from "@/types/audits";

import { timedProviderCall } from "../call-log";

import type { PerformanceAuditOptions, PerformanceProvider } from "./types";

/**
 * Markup-based performance estimate. Used when no PageSpeed key is configured
 * and in demo mode.
 *
 * This is explicitly NOT a Lighthouse run: it never measures the browser, it
 * only counts things in the HTML that are known to cost time. Everything it
 * produces is labelled `isHeuristic: true` so the UI and the findings can say
 * so, and the lab metrics (LCP / CLS / INP) stay `null` rather than being
 * invented.
 */

const logger = createLogger({ module: "providers/performance/heuristic" });

const HTML_BUDGET_BYTES = 300_000;
const FETCH_TIMEOUT_MS = 10_000;
const FETCH_MAX_BYTES = 1_500_000;

export interface HeuristicPerformanceProviderOptions {
  /** Injected in tests and in demo mode; defaults to the SSRF-hardened fetcher. */
  fetcher?: SafeFetcher;
}

interface Penalty {
  points: number;
  note: string;
}

export function gradeFor(score: number): NonNullable<PerformanceAuditSummary["mobileGrade"]> {
  if (score < 50) return "poor";
  return score >= 90 ? "good" : "needs_improvement";
}

export function createHeuristicPerformanceProvider(options: HeuristicPerformanceProviderOptions = {}): PerformanceProvider {
  const fetcher = options.fetcher ?? safeFetchUrl;

  return {
    name: "heuristic",
    isHeuristic: true,
    async audit(url: string, auditOptions: PerformanceAuditOptions = {}): Promise<PerformanceAuditSummary> {
      let html = auditOptions.html ?? null;
      let responseTimeMs = auditOptions.responseTimeMs ?? null;
      const notes: string[] = [];

      if (html === null) {
        try {
          const response = await timedProviderCall(
            { providerName: "heuristic", operation: "fetch_page", estimatedCost: 0, requestContext: { url } },
            () => fetcher(url, { method: "GET", maxBytes: FETCH_MAX_BYTES, timeoutMs: FETCH_TIMEOUT_MS, truncateInsteadOfFail: true }),
          );
          html = response.body;
          responseTimeMs = response.durationMs;
        } catch (error) {
          const kind = classifyFetchError(error);
          logger.info("heuristic_fetch_failed", { url, kind });
          return {
            source: "heuristic",
            isHeuristic: true,
            mobileScore: null,
            desktopScore: null,
            lcpMs: null,
            cls: null,
            inpMs: null,
            mobileGrade: null,
            measuredAt: new Date().toISOString(),
            notes: [`The page could not be fetched (${kind}); no heuristic estimate was produced.`],
          };
        }
      }

      const parsed = parseHtml(html, url, "");
      const penalties: Penalty[] = [];

      if (parsed.htmlBytes > HTML_BUDGET_BYTES) {
        const overBudget = parsed.htmlBytes - HTML_BUDGET_BYTES;
        const points = Math.min(20, Math.ceil(overBudget / 100_000) * 5);
        penalties.push({ points, note: `HTML document is ${Math.round(parsed.htmlBytes / 1024)} KB, above the 300 KB budget (-${points}).` });
      }
      if (parsed.scripts.total > 10) {
        const points = Math.min(15, (parsed.scripts.total - 10) * 2);
        penalties.push({ points, note: `${parsed.scripts.total} script tags on the page (-${points}).` });
      }
      if (parsed.scripts.external > 8) {
        const points = Math.min(10, (parsed.scripts.external - 8) * 2);
        penalties.push({ points, note: `${parsed.scripts.external} external scripts to download (-${points}).` });
      }
      if (parsed.scripts.inHeadBlocking > 2) {
        const points = Math.min(15, (parsed.scripts.inHeadBlocking - 2) * 5);
        penalties.push({ points, note: `${parsed.scripts.inHeadBlocking} render-blocking scripts in <head> (-${points}).` });
      }
      if (parsed.styles.external > 4) {
        const points = Math.min(10, (parsed.styles.external - 4) * 2);
        penalties.push({ points, note: `${parsed.styles.external} external stylesheets (-${points}).` });
      }
      if (parsed.styles.inlineBytes > 50_000) {
        const points = Math.min(8, Math.ceil((parsed.styles.inlineBytes - 50_000) / 50_000) * 4);
        penalties.push({ points, note: `${Math.round(parsed.styles.inlineBytes / 1024)} KB of inline CSS (-${points}).` });
      }
      if (parsed.images.withoutDimensions > 5) {
        const points = Math.min(10, (parsed.images.withoutDimensions - 5) * 2);
        penalties.push({ points, note: `${parsed.images.withoutDimensions} images without width/height attributes, which causes layout shift (-${points}).` });
      }
      if (responseTimeMs !== null) {
        if (responseTimeMs >= 3000) penalties.push({ points: 20, note: `The document responded in ${responseTimeMs} ms (-20).` });
        else if (responseTimeMs >= 1500) penalties.push({ points: 10, note: `The document responded in ${responseTimeMs} ms (-10).` });
      } else {
        notes.push("Response time was not measured, so no latency penalty was applied.");
      }
      if (parsed.viewport === null) {
        penalties.push({ points: 15, note: "No viewport meta tag, so the page is not laid out for mobile screens (-15)." });
      }

      const deducted = penalties.reduce((sum, penalty) => sum + penalty.points, 0);
      const mobileScore = Math.max(0, Math.min(100, 100 - deducted));
      const desktopScore = Math.min(100, mobileScore + 10);

      notes.unshift("Heuristic estimate from the HTML only. It is not a Lighthouse score and no browser was run.");
      for (const penalty of penalties) notes.push(penalty.note);
      if (penalties.length === 0) notes.push("No markup-level performance penalties were detected.");

      return {
        source: "heuristic",
        isHeuristic: true,
        mobileScore,
        desktopScore,
        lcpMs: null,
        cls: null,
        inpMs: null,
        mobileGrade: gradeFor(mobileScore),
        measuredAt: new Date().toISOString(),
        notes,
      };
    },
  };
}
