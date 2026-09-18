import type { SafeFetchResult, SafeFetcher } from "@/lib/security/safe-fetch";

export { AVERAGE_HTML, AVERAGE_BUSINESS_NAME } from "./average";
export { NO_CONTACT_HTML, NO_CONTACT_BUSINESS_NAME } from "./noContact";
export { STRONG_HTML, STRONG_BUSINESS_NAME } from "./strong";
export { WEAK_HTML, WEAK_BUSINESS_NAME } from "./weak";

/** One canned response of the fake fetcher. */
export interface FakeResponse {
  status?: number;
  body?: string;
  contentType?: string;
  finalUrl?: string;
  redirectChain?: string[];
  durationMs?: number;
  https?: boolean;
  /** Thrown instead of answering, to exercise the failure paths. */
  error?: unknown;
}

export function fakeResult(url: string, response: FakeResponse = {}): SafeFetchResult {
  const status = response.status ?? 200;
  const body = response.body ?? "";
  const finalUrl = response.finalUrl ?? url;
  const contentType = response.contentType ?? "text/html; charset=utf-8";
  return {
    url,
    finalUrl,
    status,
    ok: status >= 200 && status < 300,
    headers: { "content-type": contentType },
    contentType,
    body,
    bytes: new TextEncoder().encode(body).length,
    redirectChain: response.redirectChain ?? [],
    durationMs: response.durationMs ?? 120,
    https: response.https ?? finalUrl.startsWith("https://"),
    truncated: false,
  };
}

/**
 * Deterministic fetcher for audit tests. Keys are matched exactly first, then by
 * suffix (so "/robots.txt" catches any origin). Unmatched URLs answer 404.
 */
export function createFakeFetcher(routes: Record<string, FakeResponse>, onRequest?: (url: string, method: string) => void): SafeFetcher {
  return async (url, opts) => {
    onRequest?.(url, opts?.method ?? "GET");
    const direct = routes[url];
    const suffixKey = Object.keys(routes).find((key) => key.startsWith("/") && new URL(url).pathname === key);
    const response = direct ?? (suffixKey === undefined ? undefined : routes[suffixKey]);
    if (response === undefined) return fakeResult(url, { status: 404, body: "not found" });
    if (response.error !== undefined) throw response.error;
    const result = fakeResult(url, response);
    return opts?.method === "HEAD" ? { ...result, body: "", bytes: 0 } : result;
  };
}
