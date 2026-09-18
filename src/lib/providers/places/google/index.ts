import { ValidationError } from "@/lib/errors";
import { GOOGLE_PLACES_POLICY } from "@/lib/providers/policy";
import type { LocationSuggestion, PlaceDetails, PlaceProvider, PlaceSearchParams, PlaceSearchResult } from "@/types/places";

import { DETAILS_MASK_BY_DEPTH, ESTIMATED_COST_USD, LOCATION_SEARCH_MASK, SEARCH_MASK } from "../field-masks";
import { createGooglePlacesClient, type FetchImpl, type GooglePlacesClient, MAX_SEARCH_RADIUS_M, NEARBY_MAX_RESULTS, TEXT_PAGE_SIZE } from "./client";
import { extractPlaceId, mapLocationSuggestion, mapPlaceDetails, mapPlaceSummary } from "./mappers";
import type { GoogleApiPlace, GoogleCallContext } from "./types";

export { createGooglePlacesClient, parseRetryAfterMs, estimateDetailsCost } from "./client";
export type { GooglePlacesClient, GooglePlacesClientOptions, SearchNearbyInput, SearchTextInput, FetchImpl } from "./client";
export { mapPlaceSummary, mapPlaceDetails, mapLocationSuggestion, extractAddressParts, extractPlaceId } from "./mappers";
export type { GoogleApiPlace, GoogleCallContext } from "./types";

/** Text Search pages are 20 results; Google stops paging after three pages. */
export const TEXT_SEARCH_MAX_RESULTS = 60;
export const LOCATION_SUGGESTION_LIMIT = 5;

export interface GooglePlacesProviderOptions {
  apiKey: string;
  languageCode?: string;
  regionCode?: string;
  fetchImpl?: FetchImpl;
  baseUrl?: string;
  timeoutMs?: number;
  /** Injected for tests; built from the other options when omitted. */
  client?: GooglePlacesClient;
}

function mapSummaries(places: GoogleApiPlace[]) {
  // Results without an id cannot be persisted or deduplicated; skip them silently.
  return places.filter((p) => extractPlaceId(p) !== null).map(mapPlaceSummary);
}

/**
 * Google Places API (New) implementation of `PlaceProvider`.
 * - `providerType` set   -> Nearby Search (hard cap 20, no paging).
 * - otherwise `query` set -> Text Search with circle bias, paged up to 60.
 */
export function createGooglePlacesProvider(options: GooglePlacesProviderOptions): PlaceProvider {
  const languageCode = options.languageCode ?? "tr";
  const regionCode = options.regionCode ?? "TR";
  const client =
    options.client ??
    createGooglePlacesClient({ apiKey: options.apiKey, fetchImpl: options.fetchImpl, baseUrl: options.baseUrl, timeoutMs: options.timeoutMs });

  function callContext(params: PlaceSearchParams): GoogleCallContext {
    return {
      workspaceId: params.context?.workspaceId,
      scanId: params.context?.scanId,
      cellIndex: params.context?.cellIndex,
    };
  }

  function validateArea(params: PlaceSearchParams): number {
    const radiusM = params.area?.radiusM;
    if (!params.area || typeof radiusM !== "number" || !Number.isFinite(radiusM) || radiusM <= 0) {
      throw new ValidationError("Search area radius must be a positive number of metres");
    }
    // Google rejects radii above 50 km; the coverage planner never produces them, but be safe.
    return Math.min(radiusM, MAX_SEARCH_RADIUS_M);
  }

  async function searchByType(params: PlaceSearchParams, providerType: string): Promise<PlaceSearchResult> {
    const radiusM = validateArea(params);
    const maxResultCount = Math.min(params.maxResults ?? NEARBY_MAX_RESULTS, NEARBY_MAX_RESULTS);
    const result = await client.searchNearby({
      center: params.area.center,
      radiusM,
      includedTypes: [providerType],
      maxResultCount,
      languageCode: params.languageCode ?? languageCode,
      regionCode: params.regionCode ?? regionCode,
      fieldMask: SEARCH_MASK,
      context: callContext(params),
    });
    const places = mapSummaries(result.places);
    return {
      places,
      // Nearby Search cannot page: a full page means more results likely exist.
      truncated: result.places.length >= maxResultCount && maxResultCount >= NEARBY_MAX_RESULTS,
      providerCalls: 1,
      estimatedCost: ESTIMATED_COST_USD.nearbySearchPro,
    };
  }

  async function searchByQuery(params: PlaceSearchParams, query: string): Promise<PlaceSearchResult> {
    const radiusM = validateArea(params);
    const target = Math.min(Math.max(params.maxResults ?? TEXT_PAGE_SIZE, 1), TEXT_SEARCH_MAX_RESULTS);
    const collected: GoogleApiPlace[] = [];
    let pageToken: string | undefined;
    let providerCalls = 0;
    let rawCount = 0;

    do {
      const remaining = target - collected.length;
      const page = await client.searchText({
        textQuery: query,
        center: params.area.center,
        radiusM,
        maxResultCount: Math.min(TEXT_PAGE_SIZE, Math.max(remaining, 1)),
        pageToken,
        languageCode: params.languageCode ?? languageCode,
        regionCode: params.regionCode ?? regionCode,
        fieldMask: SEARCH_MASK,
        context: callContext(params),
      });
      providerCalls += 1;
      rawCount += page.places.length + page.filteredByDistance;
      collected.push(...page.places);
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken && collected.length < target && rawCount < TEXT_SEARCH_MAX_RESULTS);

    const places = mapSummaries(collected).slice(0, target);
    return {
      places,
      truncated: Boolean(pageToken) || rawCount >= TEXT_SEARCH_MAX_RESULTS,
      providerCalls,
      estimatedCost: providerCalls * ESTIMATED_COST_USD.textSearchPro,
    };
  }

  return {
    name: "google_places",
    policy: GOOGLE_PLACES_POLICY,
    isDemo: false,

    async searchBusinesses(params) {
      if (params.providerType) return searchByType(params, params.providerType);
      if (params.query && params.query.trim().length > 0) return searchByQuery(params, params.query.trim());
      throw new ValidationError("Either providerType or query must be provided");
    },

    async getBusinessDetails(providerPlaceId, opts): Promise<PlaceDetails> {
      const fieldMask = DETAILS_MASK_BY_DEPTH[opts.depth];
      const apiPlace = await client.getPlace(providerPlaceId, fieldMask, opts.languageCode ?? languageCode, opts.regionCode ?? regionCode, {
        workspaceId: opts.context?.workspaceId,
        scanId: opts.context?.scanId,
        businessId: opts.context?.businessId,
        depth: opts.depth,
      });
      // Details responses carry the id in `id`; fall back to the requested id if the mask dropped it.
      return mapPlaceDetails({ ...apiPlace, id: extractPlaceId(apiPlace) ?? providerPlaceId }, opts.depth, fieldMask);
    },

    getBusinessMapUrl(providerPlaceId) {
      return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(providerPlaceId)}`;
    },

    async searchLocations(query, opts): Promise<LocationSuggestion[]> {
      const trimmed = query.trim();
      if (trimmed.length === 0) return [];
      const page = await client.searchText({
        textQuery: trimmed,
        maxResultCount: LOCATION_SUGGESTION_LIMIT,
        languageCode: opts?.languageCode ?? languageCode,
        regionCode: opts?.regionCode ?? regionCode,
        fieldMask: LOCATION_SEARCH_MASK,
        estimatedCost: ESTIMATED_COST_USD.locationSearch,
        operation: "search_locations",
      });
      return page.places
        .map(mapLocationSuggestion)
        .filter((s): s is LocationSuggestion => s !== null)
        .slice(0, LOCATION_SUGGESTION_LIMIT);
    },
  };
}
