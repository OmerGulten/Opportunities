import type { AuditDepth, GeoPoint, GeoPolygon } from "./common";

export type PlaceProviderName = "google_places" | "demo";

export interface PlaceSearchArea {
  center: GeoPoint;
  radiusM: number; // <= 50000 for Google
}

export interface PlaceSearchParams {
  area: PlaceSearchArea;
  /** Provider-specific type (e.g. Google "restaurant"). Either type or query must be set. */
  providerType?: string;
  /** Free text query for providers that support it. */
  query?: string;
  maxResults?: number; // provider max: 20 for Google Nearby
  languageCode?: string;
  regionCode?: string;
  /** Correlation for provider_call_logs */
  context?: { workspaceId?: string; scanId?: string; cellIndex?: number };
}

/** Minimal discovery record. Fields beyond `providerPlaceId` are short-lived cache. */
export interface PlaceSummary {
  provider: PlaceProviderName;
  providerPlaceId: string;
  displayName: string;
  formattedAddress: string | null;
  location: GeoPoint | null;
  primaryType: string | null;
  types: string[];
  businessStatus: string | null;
  city: string | null;
  district: string | null;
  countryCode: string | null;
}

export interface PlaceOpeningHours {
  weekdayDescriptions: string[];
  periodsCount: number;
}

export interface PlaceReviewSample {
  rating: number | null;
  relativeTime: string | null;
  publishTime: string | null; // ISO
  /** null when the provider does not expose owner replies (Google Places API (New) does not). */
  hasOwnerReply: boolean | null;
}

export interface PlaceDetails extends PlaceSummary {
  rating: number | null;
  userRatingCount: number | null;
  websiteUri: string | null;
  phoneNational: string | null;
  phoneInternational: string | null;
  googleMapsUri: string | null;
  openingHours: PlaceOpeningHours | null;
  photoCount: number | null;
  priceLevel: string | null;
  reviewSample: PlaceReviewSample[] | null;
  /** Social profile references if the provider exposes them (Google does not; demo does). */
  socialProfiles: Array<{ platform: string; url: string }> | null;
  detailLevel: AuditDepth;
  fieldMask: string;
  fetchedAt: string;
}

export interface PlaceSearchResult {
  places: PlaceSummary[];
  /** True when the provider returned its hard cap and more results likely exist. */
  truncated: boolean;
  providerCalls: number;
  estimatedCost: number;
}

export interface PlaceDetailsOptions {
  depth: AuditDepth;
  languageCode?: string;
  regionCode?: string;
  context?: { workspaceId?: string; scanId?: string; businessId?: string };
}

export interface ProviderAttribution {
  required: boolean;
  logoRequired: boolean;
  text: string;
}

export interface ProviderPolicy {
  provider: PlaceProviderName | string;
  termsUrl: string;
  persistentFields: string[];
  cacheableFields: string[];
  cacheTtlHours: number;
  attribution: ProviderAttribution;
  export: {
    allowedFields: string[];
    bulkExportAllowed: boolean;
  };
  notes: string[];
}

export interface PlaceProvider {
  readonly name: PlaceProviderName;
  readonly policy: ProviderPolicy;
  readonly isDemo: boolean;
  searchBusinesses(params: PlaceSearchParams): Promise<PlaceSearchResult>;
  getBusinessDetails(providerPlaceId: string, options: PlaceDetailsOptions): Promise<PlaceDetails>;
  getBusinessMapUrl(providerPlaceId: string): string;
  /** Optional location text search used by the wizard's "Search place" step. */
  searchLocations?(query: string, opts?: { languageCode?: string; regionCode?: string }): Promise<LocationSuggestion[]>;
}

export interface LocationSuggestion {
  label: string;
  location: GeoPoint;
  viewport?: { north: number; south: number; east: number; west: number };
  providerPlaceId?: string;
}

export interface CoverageCell {
  index: number;
  center: GeoPoint;
  radiusM: number;
}

export interface CoveragePlan {
  method: "radius" | "polygon" | "place";
  cells: CoverageCell[];
  bbox: { minLat: number; minLng: number; maxLat: number; maxLng: number } | null;
  polygon: GeoPolygon | null;
  areaKm2: number | null;
  notes: string[];
}
