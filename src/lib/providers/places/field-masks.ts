import type { AuditDepth } from "@/types/common";

/**
 * Centralised Google Places API (New) field masks. Every Places request must use
 * one of these masks (docs/provider-policy.md). Search endpoints prefix fields
 * with `places.`; Place Details uses bare field names.
 */

const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.businessStatus",
  "places.addressComponents",
] as const;

/** Smallest mask for discovery searches (Nearby / Text). */
export const SEARCH_MASK: string = SEARCH_FIELDS.join(",");

/** Mask for the wizard's "search a place" step (location suggestions). */
export const LOCATION_SEARCH_MASK: string = ["places.id", "places.displayName", "places.formattedAddress", "places.location", "places.viewport"].join(",");

const DETAILS_DISCOVERY_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "primaryType",
  "businessStatus",
  "addressComponents",
  "googleMapsUri",
] as const;

const DETAILS_BASIC_FIELDS = [
  ...DETAILS_DISCOVERY_FIELDS,
  "rating",
  "userRatingCount",
  "websiteUri",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "regularOpeningHours",
  "photos",
  "priceLevel",
] as const;

const DETAILS_DEEP_FIELDS = [...DETAILS_BASIC_FIELDS, "reviews"] as const;

/** Place Details mask per audit depth. Deep adds Enterprise + Atmosphere fields (reviews). */
export const DETAILS_MASK_BY_DEPTH: Record<AuditDepth, string> = {
  discovery: DETAILS_DISCOVERY_FIELDS.join(","),
  basic: DETAILS_BASIC_FIELDS.join(","),
  deep: DETAILS_DEEP_FIELDS.join(","),
};

export function detailsMaskForDepth(depth: AuditDepth): string {
  return DETAILS_MASK_BY_DEPTH[depth];
}

/**
 * Labelled cost estimates in USD per request, by Google SKU. These are estimates
 * for observability and credit planning only; billing is Google's list price at
 * request time.
 */
export const ESTIMATED_COST_USD = {
  nearbySearchPro: 0.035,
  textSearchPro: 0.035,
  detailsPro: 0.017,
  detailsEnterprise: 0.02,
  detailsEnterpriseAtmosphere: 0.025,
  locationSearch: 0.032,
} as const;

export type EstimatedCostKey = keyof typeof ESTIMATED_COST_USD;

/** SKU tier reached by the details mask of a given depth. */
export function detailsEstimatedCost(depth: AuditDepth): number {
  switch (depth) {
    case "discovery":
      return ESTIMATED_COST_USD.detailsPro;
    case "basic":
      return ESTIMATED_COST_USD.detailsEnterprise;
    case "deep":
      return ESTIMATED_COST_USD.detailsEnterpriseAtmosphere;
  }
}
