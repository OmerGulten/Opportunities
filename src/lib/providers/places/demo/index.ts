import { DEMO_BUSINESSES, DEMO_LOCATIONS, findDemoBusiness } from "@/lib/demo/businesses";
import type { DemoBusiness } from "@/lib/demo/types";
import { InvalidBusinessError, ValidationError } from "@/lib/errors";
import { haversineMeters } from "@/lib/geo";
import { timedProviderCall } from "@/lib/providers/call-log";
import { DEMO_POLICY } from "@/lib/providers/policy";
import { AUDIT_DEPTH_ORDER, type AuditDepth } from "@/types/common";
import type { LocationSuggestion, PlaceDetails, PlaceProvider, PlaceSearchParams, PlaceSearchResult, PlaceSummary } from "@/types/places";

import { DETAILS_MASK_BY_DEPTH } from "../field-masks";

/**
 * Deterministic demo `PlaceProvider` over the fictional Kadıköy dataset. Mirrors
 * the Google provider's behaviour (caps, depth-based detail stripping, map URLs)
 * so the rest of the app cannot tell the difference.
 */

export const DEMO_PROVIDER_NAME = "demo" as const;
export const DEMO_DEFAULT_MAX_RESULTS = 20;
export const DEMO_LATENCY_MS = 40;

export interface DemoPlaceProviderOptions {
  /** Simulated network latency per call; tests pass 0. */
  latencyMs?: number;
}

const TR_FOLD: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u" };

/** Turkish-insensitive folding for substring matching ("Kadıköy" matches "kadikoy"). */
export function foldForSearch(input: string): string {
  return input
    .split("")
    .map((ch) => TR_FOLD[ch] ?? ch)
    .join("")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms: number): Promise<void> {
  return ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));
}

function toSummary(b: DemoBusiness): PlaceSummary {
  return {
    provider: "demo",
    providerPlaceId: b.providerPlaceId,
    displayName: b.displayName,
    formattedAddress: b.formattedAddress,
    location: b.location,
    primaryType: b.primaryType,
    types: [...b.types],
    businessStatus: b.businessStatus,
    city: b.city,
    district: b.district,
    countryCode: b.countryCode,
  };
}

/**
 * Builds depth-appropriate details: discovery keeps identity + map URL only,
 * basic adds profile fields, deep adds the review sample. Mirrors what the
 * Google mask of the same depth would return, so audits see the same nulls.
 */
export function toDetails(b: DemoBusiness, depth: AuditDepth, fetchedAt: string = new Date().toISOString()): PlaceDetails {
  const level = AUDIT_DEPTH_ORDER[depth];
  const atLeastBasic = level >= AUDIT_DEPTH_ORDER.basic;
  const deep = level >= AUDIT_DEPTH_ORDER.deep;
  return {
    ...toSummary(b),
    rating: atLeastBasic ? b.rating : null,
    userRatingCount: atLeastBasic ? b.userRatingCount : null,
    websiteUri: atLeastBasic ? b.websiteUri : null,
    phoneNational: atLeastBasic ? b.phoneNational : null,
    phoneInternational: atLeastBasic ? b.phoneInternational : null,
    googleMapsUri: b.googleMapsUri,
    openingHours: atLeastBasic && b.openingHours ? { weekdayDescriptions: [...b.openingHours.weekdayDescriptions], periodsCount: b.openingHours.periodsCount } : null,
    photoCount: atLeastBasic ? b.photoCount : null,
    priceLevel: atLeastBasic ? b.priceLevel : null,
    reviewSample: deep && b.reviewSample ? b.reviewSample.map((r) => ({ ...r })) : null,
    socialProfiles: atLeastBasic && b.socialProfiles ? b.socialProfiles.map((s) => ({ ...s })) : null,
    detailLevel: depth,
    fieldMask: DETAILS_MASK_BY_DEPTH[depth],
    fetchedAt,
  };
}

function matchesType(b: DemoBusiness, providerType: string): boolean {
  const wanted = providerType.toLowerCase();
  return b.primaryType === wanted || b.types.includes(wanted);
}

function matchesQuery(b: DemoBusiness, query: string): boolean {
  const haystack = foldForSearch([b.displayName, ...b.types, ...b.keywords].join(" "));
  const needle = foldForSearch(query);
  if (needle.length === 0) return true;
  if (haystack.includes(needle)) return true;
  // All tokens present anywhere ("kadıköy kuaför" matches "Salon Ayna Kuaför" only if both appear).
  const tokens = needle.split(" ").filter(Boolean);
  return tokens.length > 1 && tokens.every((t) => haystack.includes(t));
}

export function createDemoPlaceProvider(options: DemoPlaceProviderOptions = {}): PlaceProvider {
  const latencyMs = options.latencyMs ?? DEMO_LATENCY_MS;

  return {
    name: DEMO_PROVIDER_NAME,
    policy: DEMO_POLICY,
    isDemo: true,

    async searchBusinesses(params: PlaceSearchParams): Promise<PlaceSearchResult> {
      const radiusM = params.area?.radiusM;
      if (!params.area || typeof radiusM !== "number" || !Number.isFinite(radiusM) || radiusM <= 0) {
        throw new ValidationError("Search area radius must be a positive number of metres");
      }
      if (!params.providerType && !(params.query && params.query.trim().length > 0)) {
        throw new ValidationError("Either providerType or query must be provided");
      }
      const maxResults = Math.max(1, Math.min(params.maxResults ?? DEMO_DEFAULT_MAX_RESULTS, 60));

      return timedProviderCall(
        {
          providerName: DEMO_PROVIDER_NAME,
          operation: params.providerType ? "search_nearby" : "search_text",
          estimatedCost: 0,
          requestContext: { operation: params.providerType ? "search_nearby" : "search_text", radiusM, providerType: params.providerType ?? null, cellIndex: params.context?.cellIndex ?? null },
          workspaceId: params.context?.workspaceId ?? null,
          scanId: params.context?.scanId ?? null,
        },
        async () => {
          await sleep(latencyMs);
          const center = params.area.center;
          const matched = DEMO_BUSINESSES.map((b) => ({ b, distanceM: b.location ? haversineMeters(center, b.location) : Number.POSITIVE_INFINITY }))
            .filter(({ b, distanceM }) => distanceM <= radiusM && (params.providerType ? matchesType(b, params.providerType) : matchesQuery(b, params.query!)))
            .sort((x, y) => x.distanceM - y.distanceM || x.b.providerPlaceId.localeCompare(y.b.providerPlaceId));
          const page = matched.slice(0, maxResults);
          return {
            places: page.map(({ b }) => toSummary(b)),
            truncated: matched.length > maxResults,
            providerCalls: 1,
            estimatedCost: 0,
          };
        },
      );
    },

    async getBusinessDetails(providerPlaceId, opts): Promise<PlaceDetails> {
      return timedProviderCall(
        {
          providerName: DEMO_PROVIDER_NAME,
          operation: "get_place",
          estimatedCost: 0,
          requestContext: { operation: "get_place", depth: opts.depth, businessId: opts.context?.businessId ?? null },
          workspaceId: opts.context?.workspaceId ?? null,
          scanId: opts.context?.scanId ?? null,
        },
        async () => {
          await sleep(latencyMs);
          const business = findDemoBusiness(providerPlaceId);
          if (!business) throw new InvalidBusinessError("Demo business not found", { details: { providerPlaceId } });
          return toDetails(business, opts.depth);
        },
      );
    },

    getBusinessMapUrl(providerPlaceId) {
      const business = findDemoBusiness(providerPlaceId);
      if (business?.googleMapsUri) return business.googleMapsUri;
      if (business?.location) return `https://www.google.com/maps/search/?api=1&query=${business.location.lat},${business.location.lng}`;
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(providerPlaceId)}`;
    },

    async searchLocations(query): Promise<LocationSuggestion[]> {
      await sleep(latencyMs);
      const needle = foldForSearch(query);
      if (needle.length === 0) return [];
      return DEMO_LOCATIONS.filter((loc) => foldForSearch(loc.label).startsWith(needle)).slice(0, 5).map((loc) => ({ ...loc, location: { ...loc.location }, viewport: loc.viewport ? { ...loc.viewport } : undefined }));
    },
  };
}
