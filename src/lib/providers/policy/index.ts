import type { ProviderPolicy } from "@/types/places";

/**
 * Provider policy layer. Encodes licence constraints so the rest of the app
 * stays provider-agnostic. See docs/provider-policy.md.
 */

export const GOOGLE_PLACES_POLICY: ProviderPolicy = {
  provider: "google_places",
  termsUrl: "https://cloud.google.com/maps-platform/terms",
  persistentFields: ["providerPlaceId"],
  cacheableFields: [
    "displayName",
    "formattedAddress",
    "location",
    "primaryType",
    "types",
    "businessStatus",
    "rating",
    "userRatingCount",
    "websiteUri",
    "phoneNational",
    "phoneInternational",
    "googleMapsUri",
    "openingHours",
    "photoCount",
    "priceLevel",
    "reviewSample",
  ],
  cacheTtlHours: 24 * 30,
  attribution: {
    required: true,
    logoRequired: true,
    text: "Google Maps",
  },
  export: {
    // Only our own derived data + the persistent identifier.
    allowedFields: ["providerPlaceId", "provider"],
    bulkExportAllowed: false,
  },
  notes: [
    "Place IDs may be stored indefinitely; other content is short-lived cache and must be refreshed or purged.",
    "Show the Google Maps attribution when content is displayed outside a Google map.",
    "Bulk export of raw Places content is not permitted.",
    "Do not build permanent telemarketing or mailing lists from Places content.",
  ],
};

export const DEMO_POLICY: ProviderPolicy = {
  ...GOOGLE_PLACES_POLICY,
  provider: "demo",
  termsUrl: "/legal/terms",
  attribution: { required: false, logoRequired: false, text: "Demo data" },
  notes: ["Fictional demo data. Mirrors Google Places policy so UI behaviour is identical."],
};

export function getPolicy(provider: string): ProviderPolicy {
  switch (provider) {
    case "google_places":
      return GOOGLE_PLACES_POLICY;
    case "demo":
      return DEMO_POLICY;
    default:
      return GOOGLE_PLACES_POLICY; // most restrictive default
  }
}

export function snapshotExpiryDate(policy: ProviderPolicy, fetchedAt: Date = new Date()): Date {
  return new Date(fetchedAt.getTime() + policy.cacheTtlHours * 3600 * 1000);
}

export function isSnapshotExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

/**
 * Fields that may leave the product in exports. Combines provider-allowed
 * identifiers with our own derived and CRM fields (never raw provider content
 * unless `providerContentEnabled` is explicitly on).
 */
export const OWN_EXPORT_FIELDS = [
  "id",
  "provider",
  "provider_place_id",
  "overall_score",
  "primary_service",
  "secondary_services",
  "digital_gaps",
  "website_status",
  "instagram_status",
  "google_completeness",
  "lead_stage",
  "lead_status",
  "last_contacted_at",
  "next_follow_up_at",
  "first_scan_id",
  "created_at",
] as const;

export const PROVIDER_CONTENT_EXPORT_FIELDS = ["display_name", "formatted_address", "city", "district", "rating", "user_rating_count", "website_uri", "phone_national"] as const;

export function exportableFields(policy: ProviderPolicy, providerContentEnabled: boolean): string[] {
  const fields: string[] = [...OWN_EXPORT_FIELDS];
  if (providerContentEnabled && policy.export.bulkExportAllowed) fields.push(...PROVIDER_CONTENT_EXPORT_FIELDS);
  return fields;
}

export function filterForExport<T extends Record<string, unknown>>(record: T, policy: ProviderPolicy, providerContentEnabled: boolean): Partial<T> {
  const allowed = new Set(exportableFields(policy, providerContentEnabled));
  const out: Partial<T> = {};
  for (const key of Object.keys(record) as Array<keyof T>) {
    if (allowed.has(String(key))) out[key] = record[key];
  }
  return out;
}
