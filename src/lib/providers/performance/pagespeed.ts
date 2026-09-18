import { ProviderError, ProviderRateLimitedError, ProviderUnavailableError } from "@/lib/errors";
import { createLogger } from "@/lib/logging";
import type { PerformanceAuditSummary } from "@/types/audits";

import { timedProviderCall } from "../call-log";

import { gradeFor } from "./heuristic";
import type { PerformanceAuditOptions, PerformanceProvider, PerformanceStrategy } from "./types";

/**
 * Google PageSpeed Insights (Lighthouse + CrUX field data).
 *
 * The API key is never logged, never placed in `requestContext` and never put in
 * an error message; only the URL and the strategy are.
 */

const logger = createLogger({ module: "providers/performance/pagespeed" });

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const DEFAULT_TIMEOUT_MS = 60_000;

export interface PageSpeedProviderOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface StrategyResult {
  score: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pathRecord(root: Record<string, unknown> | null, ...keys: string[]): Record<string, unknown> | null {
  let current = root;
  for (const key of keys) {
    if (current === null) return null;
    current = asRecord(current[key]);
  }
  return current;
}

export function parsePageSpeedResponse(payload: unknown): StrategyResult {
  const root = asRecord(payload);
  const performance = pathRecord(root, "lighthouseResult", "categories", "performance");
  const rawScore = readNumber(performance?.["score"]);
  const audits = pathRecord(root, "lighthouseResult", "audits");
  const lcp = readNumber(pathRecord(audits, "largest-contentful-paint")?.["numericValue"]);
  const cls = readNumber(pathRecord(audits, "cumulative-layout-shift")?.["numericValue"]);
  const inp = readNumber(pathRecord(root, "loadingExperience", "metrics", "INTERACTION_TO_NEXT_PAINT")?.["percentile"]);

  return {
    score: rawScore === null ? null : Math.round(rawScore * 100),
    lcpMs: lcp === null ? null : Math.round(lcp),
    cls: cls === null ? null : Math.round(cls * 1000) / 1000,
    inpMs: inp === null ? null : Math.round(inp),
  };
}

export function createPageSpeedProvider(options: PageSpeedProviderOptions): PerformanceProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function run(url: string, strategy: PerformanceStrategy, context: PerformanceAuditOptions["context"]): Promise<StrategyResult> {
    const endpoint = new URL(ENDPOINT);
    endpoint.searchParams.set("url", url);
    endpoint.searchParams.set("strategy", strategy);
    endpoint.searchParams.set("category", "PERFORMANCE");
    endpoint.searchParams.set("key", options.apiKey);

    return timedProviderCall(
      {
        providerName: "pagespeed",
        operation: `runPagespeed:${strategy}`,
        estimatedCost: 0,
        requestContext: { url, strategy },
        workspaceId: context?.workspaceId ?? null,
        scanId: context?.scanId ?? null,
      },
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response: Response;
        try {
          response = await fetchImpl(endpoint.toString(), { method: "GET", signal: controller.signal, headers: { accept: "application/json" } });
        } catch (error) {
          throw new ProviderUnavailableError("pagespeed", {
            cause: error,
            details: { url, strategy, reason: controller.signal.aborted ? "timeout" : "network" },
          });
        } finally {
          clearTimeout(timer);
        }

        if (response.status === 429) throw new ProviderRateLimitedError("pagespeed", { details: { url, strategy } });
        if (response.status >= 500) throw new ProviderUnavailableError("pagespeed", { details: { url, strategy, status: response.status } });
        if (!response.ok) throw new ProviderError("pagespeed", `request failed with status ${response.status}`, { details: { url, strategy, status: response.status } });

        let payload: unknown;
        try {
          payload = await response.json();
        } catch (error) {
          throw new ProviderError("pagespeed", "response was not valid JSON", { cause: error, details: { url, strategy } });
        }
        return parsePageSpeedResponse(payload);
      },
    );
  }

  return {
    name: "pagespeed",
    isHeuristic: false,
    async audit(url: string, auditOptions: PerformanceAuditOptions = {}): Promise<PerformanceAuditSummary> {
      const strategies = auditOptions.strategies ?? ["mobile"];
      const notes: string[] = [];
      let mobile: StrategyResult | null = null;
      let desktop: StrategyResult | null = null;

      for (const strategy of strategies) {
        const result = await run(url, strategy, auditOptions.context);
        if (strategy === "mobile") mobile = result;
        else desktop = result;
      }

      const primary = mobile ?? desktop;
      if (primary === null) {
        throw new ProviderError("pagespeed", "no strategy was requested", { details: { url } });
      }
      if (primary.inpMs === null) notes.push("No INTERACTION_TO_NEXT_PAINT field data was available for this URL.");
      if (mobile === null) notes.push("Only the desktop strategy was requested; the mobile score was not measured.");
      logger.debug("pagespeed_audit", { url, strategies: strategies.join(","), mobileScore: mobile?.score ?? null });

      return {
        source: "pagespeed",
        isHeuristic: false,
        mobileScore: mobile?.score ?? null,
        desktopScore: desktop?.score ?? null,
        lcpMs: primary.lcpMs,
        cls: primary.cls,
        inpMs: primary.inpMs,
        mobileGrade: mobile?.score === null || mobile?.score === undefined ? null : gradeFor(mobile.score),
        measuredAt: new Date().toISOString(),
        notes,
      };
    },
  };
}
