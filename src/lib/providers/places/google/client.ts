import { AppError, InvalidBusinessError, ProviderError, ProviderRateLimitedError, ProviderUnavailableError, ValidationError } from "@/lib/errors";
import { timedProviderCall } from "@/lib/providers/call-log";
import { haversineMeters } from "@/lib/geo";
import type { GeoPoint, Json } from "@/types/common";

import { ESTIMATED_COST_USD, SEARCH_MASK } from "../field-masks";
import type { GoogleApiPlace, GoogleCallContext, GoogleErrorBody, GoogleSearchResponse } from "./types";

/**
 * Thin HTTP client for Google Places API (New). Knows about transport, headers,
 * timeouts and error mapping — nothing about our domain. Every call is wrapped
 * in `timedProviderCall` for provider_call_logs. The API key is only ever
 * placed in the request header and is scrubbed from any error text.
 */

export const GOOGLE_PLACES_PROVIDER_NAME = "google_places" as const;
export const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1";
export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_RETRY_AFTER_MS = 30_000;
/** Google's hard limits. */
export const NEARBY_MAX_RESULTS = 20;
export const TEXT_PAGE_SIZE = 20;
export const MAX_SEARCH_RADIUS_M = 50_000;

export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export interface GooglePlacesClientOptions {
  apiKey: string;
  fetchImpl?: FetchImpl;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface SearchNearbyInput {
  center: GeoPoint;
  radiusM: number;
  includedTypes: string[];
  maxResultCount?: number;
  languageCode?: string;
  regionCode?: string;
  fieldMask?: string;
  context?: GoogleCallContext;
}

export interface SearchTextInput {
  textQuery: string;
  /** Optional circle bias; results are additionally filtered to `radiusM` when both are set. */
  center?: GeoPoint;
  radiusM?: number;
  maxResultCount?: number;
  pageToken?: string;
  languageCode?: string;
  regionCode?: string;
  fieldMask?: string;
  /** Overrides the default text-search SKU estimate (e.g. location search). */
  estimatedCost?: number;
  /** Operation label for provider_call_logs; defaults to `search_text`. */
  operation?: string;
  context?: GoogleCallContext;
}

export interface SearchNearbyResult {
  places: GoogleApiPlace[];
}

export interface SearchTextResult {
  places: GoogleApiPlace[];
  nextPageToken: string | null;
  /** Results Google returned outside the requested circle (bias is not a restriction). */
  filteredByDistance: number;
}

export interface GooglePlacesClient {
  searchNearby(input: SearchNearbyInput): Promise<SearchNearbyResult>;
  searchText(input: SearchTextInput): Promise<SearchTextResult>;
  getPlace(placeId: string, fieldMask: string, languageCode?: string, regionCode?: string, context?: GoogleCallContext): Promise<GoogleApiPlace>;
}

/** Parses a Retry-After header (delta seconds or HTTP date) into milliseconds. */
export function parseRetryAfterMs(header: string | null | undefined, fallbackMs: number = DEFAULT_RETRY_AFTER_MS, now: number = Date.now()): number {
  if (!header) return fallbackMs;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return clampRetry(seconds * 1000, fallbackMs);
  }
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return fallbackMs;
  return clampRetry(date - now, fallbackMs);
}

function clampRetry(ms: number, fallbackMs: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return fallbackMs;
  return Math.min(Math.max(ms, 1000), 5 * 60 * 1000);
}

function scrubSecret(text: string, secret: string): string {
  const withoutKey = secret.length > 0 ? text.split(secret).join("[redacted]") : text;
  // Defensive: strip any `key=` query parameter Google might echo back.
  return withoutKey.replace(/([?&]key=)[^&\s]+/gi, "$1[redacted]").slice(0, 300);
}

function contextToJson(ctx: GoogleCallContext | undefined): Record<string, Json> {
  const out: Record<string, Json> = {};
  if (!ctx) return out;
  if (ctx.cellIndex !== undefined) out.cellIndex = ctx.cellIndex;
  if (ctx.depth !== undefined) out.depth = ctx.depth;
  if (ctx.businessId !== undefined) out.businessId = ctx.businessId;
  return out;
}

export function createGooglePlacesClient(options: GooglePlacesClientOptions): GooglePlacesClient {
  const apiKey = options.apiKey;
  if (!apiKey) throw new ValidationError("Google Places API key is required");
  const fetchImpl: FetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const baseUrl = (options.baseUrl ?? GOOGLE_PLACES_BASE_URL).replace(/\/$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(method: "GET" | "POST", path: string, fieldMask: string, body?: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      throw new ProviderUnavailableError(GOOGLE_PLACES_PROVIDER_NAME, {
        details: { reason: isAbort ? "timeout" : "network", timeoutMs: isAbort ? timeoutMs : undefined },
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) throw mapHttpError(response, parsed, text);
    if (parsed === null && text.length > 0) {
      throw new ProviderError(GOOGLE_PLACES_PROVIDER_NAME, "Response was not valid JSON", { details: { status: response.status } });
    }
    return (parsed ?? {}) as T;
  }

  function mapHttpError(response: Response, parsed: unknown, rawText: string): AppError {
    const status = response.status;
    const errorBody = (parsed ?? {}) as GoogleErrorBody;
    const googleStatus = errorBody.error?.status ?? null;
    const googleMessage = scrubSecret(errorBody.error?.message ?? (rawText ? rawText : `HTTP ${status}`), apiKey);

    if (status === 429 || googleStatus === "RESOURCE_EXHAUSTED") {
      return new ProviderRateLimitedError(GOOGLE_PLACES_PROVIDER_NAME, {
        retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
        details: { status, googleStatus },
      });
    }
    if (status >= 500) {
      return new ProviderUnavailableError(GOOGLE_PLACES_PROVIDER_NAME, { details: { status, googleStatus, message: googleMessage } });
    }
    if (status === 404) {
      return new InvalidBusinessError("Place was not found or is no longer available", { details: { status, googleStatus } });
    }
    // 400 / 403 and anything else: surface Google's message (key already scrubbed).
    return new ProviderError(GOOGLE_PLACES_PROVIDER_NAME, googleMessage, { details: { status, googleStatus } });
  }

  function circle(center: GeoPoint, radiusM: number) {
    return { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: Math.min(Math.max(radiusM, 1), MAX_SEARCH_RADIUS_M) } };
  }

  return {
    async searchNearby(input) {
      const fieldMask = input.fieldMask ?? SEARCH_MASK;
      const maxResultCount = Math.min(Math.max(input.maxResultCount ?? NEARBY_MAX_RESULTS, 1), NEARBY_MAX_RESULTS);
      const body: Record<string, unknown> = {
        includedTypes: input.includedTypes,
        maxResultCount,
        locationRestriction: circle(input.center, input.radiusM),
      };
      if (input.languageCode) body.languageCode = input.languageCode;
      if (input.regionCode) body.regionCode = input.regionCode;

      return timedProviderCall(
        {
          providerName: GOOGLE_PLACES_PROVIDER_NAME,
          operation: "search_nearby",
          estimatedCost: ESTIMATED_COST_USD.nearbySearchPro,
          requestContext: { operation: "search_nearby", radiusM: input.radiusM, includedTypes: input.includedTypes, maxResultCount, ...contextToJson(input.context) },
          workspaceId: input.context?.workspaceId ?? null,
          scanId: input.context?.scanId ?? null,
        },
        async () => {
          const data = await request<GoogleSearchResponse>("POST", "/places:searchNearby", fieldMask, body);
          return { places: Array.isArray(data.places) ? data.places : [] };
        },
      );
    },

    async searchText(input) {
      const fieldMask = input.fieldMask ?? SEARCH_MASK;
      const pageSize = Math.min(Math.max(input.maxResultCount ?? TEXT_PAGE_SIZE, 1), TEXT_PAGE_SIZE);
      const hasCircle = input.center !== undefined && input.radiusM !== undefined && input.radiusM > 0;
      const body: Record<string, unknown> = { textQuery: input.textQuery, pageSize };
      // Text Search only supports a rectangle restriction; we bias with a circle and post-filter.
      if (hasCircle) body.locationBias = circle(input.center!, input.radiusM!);
      if (input.pageToken) body.pageToken = input.pageToken;
      if (input.languageCode) body.languageCode = input.languageCode;
      if (input.regionCode) body.regionCode = input.regionCode;
      const operation = input.operation ?? "search_text";

      return timedProviderCall(
        {
          providerName: GOOGLE_PLACES_PROVIDER_NAME,
          operation,
          estimatedCost: input.estimatedCost ?? ESTIMATED_COST_USD.textSearchPro,
          requestContext: { operation, radiusM: input.radiusM ?? null, pageSize, paged: Boolean(input.pageToken), ...contextToJson(input.context) },
          workspaceId: input.context?.workspaceId ?? null,
          scanId: input.context?.scanId ?? null,
        },
        async () => {
          const data = await request<GoogleSearchResponse>("POST", "/places:searchText", fieldMask, body);
          const all = Array.isArray(data.places) ? data.places : [];
          let filteredByDistance = 0;
          const places = hasCircle
            ? all.filter((p) => {
                const lat = p.location?.latitude;
                const lng = p.location?.longitude;
                // Keep results without coordinates; the caller decides how to treat them.
                if (typeof lat !== "number" || typeof lng !== "number") return true;
                const inside = haversineMeters(input.center!, { lat, lng }) <= input.radiusM!;
                if (!inside) filteredByDistance += 1;
                return inside;
              })
            : all;
          return { places, nextPageToken: typeof data.nextPageToken === "string" && data.nextPageToken.length > 0 ? data.nextPageToken : null, filteredByDistance };
        },
      );
    },

    async getPlace(placeId, fieldMask, languageCode, regionCode, context) {
      if (!placeId) throw new ValidationError("placeId is required");
      const query = new URLSearchParams();
      if (languageCode) query.set("languageCode", languageCode);
      if (regionCode) query.set("regionCode", regionCode);
      const qs = query.toString();
      const path = `/places/${encodeURIComponent(placeId)}${qs ? `?${qs}` : ""}`;

      return timedProviderCall(
        {
          providerName: GOOGLE_PLACES_PROVIDER_NAME,
          operation: "get_place",
          estimatedCost: estimateDetailsCost(fieldMask),
          requestContext: { operation: "get_place", fieldMask, ...contextToJson(context) },
          workspaceId: context?.workspaceId ?? null,
          scanId: context?.scanId ?? null,
        },
        () => request<GoogleApiPlace>("GET", path, fieldMask),
      );
    },
  };
}

/** Infers the SKU tier from the mask so the log carries the right estimate even for custom masks. */
export function estimateDetailsCost(fieldMask: string): number {
  const fields = new Set(fieldMask.split(",").map((f) => f.trim()));
  if (fields.has("reviews") || fields.has("editorialSummary")) return ESTIMATED_COST_USD.detailsEnterpriseAtmosphere;
  const enterprise = ["rating", "userRatingCount", "websiteUri", "nationalPhoneNumber", "internationalPhoneNumber", "regularOpeningHours", "priceLevel", "currentOpeningHours"];
  if (enterprise.some((f) => fields.has(f))) return ESTIMATED_COST_USD.detailsEnterprise;
  return ESTIMATED_COST_USD.detailsPro;
}
