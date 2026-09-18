import { ProviderError } from "@/lib/errors";
import type { AuditDepth } from "@/types/common";
import type { LocationSuggestion, PlaceDetails, PlaceOpeningHours, PlaceReviewSample, PlaceSummary } from "@/types/places";

import type { GoogleAddressComponent, GoogleApiPlace } from "./types";

/**
 * Pure mappers from the Google Places (New) wire format to our domain types.
 * They never invent data: anything the mask did not return is `null`.
 */

const PROVIDER = "google_places" as const;

/** Accepts either the bare `id` or the `places/<id>` resource name. */
export function extractPlaceId(place: GoogleApiPlace): string | null {
  if (typeof place.id === "string" && place.id.length > 0) return place.id;
  if (typeof place.name === "string" && place.name.startsWith("places/")) {
    const id = place.name.slice("places/".length);
    return id.length > 0 ? id : null;
  }
  return null;
}

function componentText(components: GoogleAddressComponent[], type: string, field: "longText" | "shortText"): string | null {
  const match = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
  const value = match?.[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export interface AddressParts {
  countryCode: string | null;
  city: string | null;
  district: string | null;
}

/**
 * Turkish addresses: `administrative_area_level_1` is the province (İstanbul),
 * `administrative_area_level_2` the district (Kadıköy). `locality` and
 * `sublocality_level_1` are used as fallbacks for other regions.
 */
export function extractAddressParts(components: GoogleAddressComponent[] | undefined): AddressParts {
  const list = Array.isArray(components) ? components : [];
  const countryCode = componentText(list, "country", "shortText");
  const city = componentText(list, "administrative_area_level_1", "longText") ?? componentText(list, "locality", "longText");
  const district = componentText(list, "administrative_area_level_2", "longText") ?? componentText(list, "sublocality_level_1", "longText");
  return { countryCode: countryCode ? countryCode.toUpperCase() : null, city, district };
}

function mapLocation(place: GoogleApiPlace): PlaceSummary["location"] {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mapPlaceSummary(apiPlace: GoogleApiPlace): PlaceSummary {
  const providerPlaceId = extractPlaceId(apiPlace);
  if (!providerPlaceId) throw new ProviderError(PROVIDER, "Place result without an id");
  const parts = extractAddressParts(apiPlace.addressComponents);
  return {
    provider: PROVIDER,
    providerPlaceId,
    displayName: optionalString(apiPlace.displayName?.text) ?? providerPlaceId,
    formattedAddress: optionalString(apiPlace.formattedAddress),
    location: mapLocation(apiPlace),
    primaryType: optionalString(apiPlace.primaryType),
    types: Array.isArray(apiPlace.types) ? apiPlace.types.filter((t): t is string => typeof t === "string") : [],
    businessStatus: optionalString(apiPlace.businessStatus),
    city: parts.city,
    district: parts.district,
    countryCode: parts.countryCode,
  };
}

function mapOpeningHours(place: GoogleApiPlace): PlaceOpeningHours | null {
  const hours = place.regularOpeningHours;
  if (!hours || typeof hours !== "object") return null;
  const weekdayDescriptions = Array.isArray(hours.weekdayDescriptions) ? hours.weekdayDescriptions.filter((d): d is string => typeof d === "string") : [];
  const periodsCount = Array.isArray(hours.periods) ? hours.periods.length : 0;
  if (weekdayDescriptions.length === 0 && periodsCount === 0) return null;
  return { weekdayDescriptions, periodsCount };
}

/**
 * Review sample. The API returns at most five reviews and does not expose owner
 * replies, so `hasOwnerReply` is always `null` (unknown), never `false`.
 */
function mapReviewSample(place: GoogleApiPlace): PlaceReviewSample[] | null {
  if (!Array.isArray(place.reviews)) return null;
  return place.reviews.map((r) => ({
    rating: optionalNumber(r.rating),
    relativeTime: optionalString(r.relativePublishTimeDescription),
    publishTime: optionalString(r.publishTime),
    hasOwnerReply: null,
  }));
}

/**
 * Maps a details response. `photoCount` is `photos.length`; the API returns at
 * most 10 photos, so the audit must label the count as capped. Fields the mask
 * did not request are `null` — callers use `fieldMask` to tell "not requested"
 * apart from "not present".
 */
export function mapPlaceDetails(apiPlace: GoogleApiPlace, depth: AuditDepth, fieldMask: string, fetchedAt: string = new Date().toISOString()): PlaceDetails {
  const summary = mapPlaceSummary(apiPlace);
  return {
    ...summary,
    rating: optionalNumber(apiPlace.rating),
    userRatingCount: optionalNumber(apiPlace.userRatingCount),
    websiteUri: optionalString(apiPlace.websiteUri),
    phoneNational: optionalString(apiPlace.nationalPhoneNumber),
    phoneInternational: optionalString(apiPlace.internationalPhoneNumber),
    googleMapsUri: optionalString(apiPlace.googleMapsUri),
    openingHours: mapOpeningHours(apiPlace),
    photoCount: Array.isArray(apiPlace.photos) ? apiPlace.photos.length : null,
    priceLevel: optionalString(apiPlace.priceLevel),
    reviewSample: mapReviewSample(apiPlace),
    // Google Places does not expose social profiles.
    socialProfiles: null,
    detailLevel: depth,
    fieldMask,
    fetchedAt,
  };
}

/** Location suggestion for the wizard. Returns null when the result has no coordinates. */
export function mapLocationSuggestion(apiPlace: GoogleApiPlace): LocationSuggestion | null {
  const location = mapLocation(apiPlace);
  if (!location) return null;
  const name = optionalString(apiPlace.displayName?.text);
  const address = optionalString(apiPlace.formattedAddress);
  const label = name && address ? (address.startsWith(name) ? address : `${name}, ${address}`) : (name ?? address ?? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`);
  const low = apiPlace.viewport?.low;
  const high = apiPlace.viewport?.high;
  const viewport =
    typeof low?.latitude === "number" && typeof low?.longitude === "number" && typeof high?.latitude === "number" && typeof high?.longitude === "number"
      ? { south: low.latitude, west: low.longitude, north: high.latitude, east: high.longitude }
      : undefined;
  const providerPlaceId = extractPlaceId(apiPlace) ?? undefined;
  return { label, location, ...(viewport ? { viewport } : {}), ...(providerPlaceId ? { providerPlaceId } : {}) };
}
