import type { AuditDepth } from "@/types/common";

/**
 * Subset of the Google Places API (New) wire format that the client and mappers
 * touch. Every field is optional because the response only contains what the
 * field mask asked for.
 */

export interface GoogleLocalizedText {
  text?: string;
  languageCode?: string;
}

export interface GoogleLatLng {
  latitude?: number;
  longitude?: number;
}

export interface GoogleViewport {
  low?: GoogleLatLng;
  high?: GoogleLatLng;
}

export interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
  languageCode?: string;
}

export interface GoogleOpeningHours {
  openNow?: boolean;
  periods?: unknown[];
  weekdayDescriptions?: string[];
}

export interface GooglePhoto {
  name?: string;
  widthPx?: number;
  heightPx?: number;
}

export interface GoogleReview {
  name?: string;
  rating?: number;
  relativePublishTimeDescription?: string;
  publishTime?: string;
  text?: GoogleLocalizedText;
  originalText?: GoogleLocalizedText;
}

export interface GoogleApiPlace {
  /** Bare place id (`ChIJ...`). */
  id?: string;
  /** Resource name (`places/ChIJ...`). */
  name?: string;
  displayName?: GoogleLocalizedText;
  formattedAddress?: string;
  location?: GoogleLatLng;
  viewport?: GoogleViewport;
  types?: string[];
  primaryType?: string;
  businessStatus?: string;
  addressComponents?: GoogleAddressComponent[];
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: GoogleOpeningHours;
  photos?: GooglePhoto[];
  priceLevel?: string;
  reviews?: GoogleReview[];
}

export interface GoogleSearchResponse {
  places?: GoogleApiPlace[];
  nextPageToken?: string;
}

export interface GoogleErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

/** Correlation fields forwarded to provider_call_logs. Never put secrets here. */
export interface GoogleCallContext {
  workspaceId?: string;
  scanId?: string;
  businessId?: string;
  cellIndex?: number;
  depth?: AuditDepth;
}
