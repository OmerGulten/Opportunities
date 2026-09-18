import type { PlaceDetails } from "@/types/places";

/** Seed category keys (supabase/seed.sql). */
export type DemoCategoryKey =
  | "restaurants_cafes"
  | "hair_salons"
  | "dentists"
  | "gyms_pilates"
  | "real_estate"
  | "accounting_tax"
  | "education_courses"
  | "hotels"
  | "auto_services"
  | "beauty"
  | "retail";

/**
 * Website quality profile of a demo business. Each profile is rendered as its
 * own HTML document by `lib/demo/websites.ts`; `unreachable` means the URL
 * exists on the profile but the demo fetcher answers 404.
 */
export type DemoWebsiteProfile =
  | "strong"
  | "average"
  | "corporate"
  | "booking_no_seo"
  | "template_generic"
  | "menu_no_contact"
  | "weak_legacy"
  | "under_construction"
  | "unreachable";

/** Full fictional business record. `detailLevel`, `fieldMask`, `fetchedAt` are added by the provider. */
export interface DemoBusiness extends Omit<PlaceDetails, "detailLevel" | "fieldMask" | "fetchedAt"> {
  provider: "demo";
  categoryKey: DemoCategoryKey;
  websiteProfile: DemoWebsiteProfile | null;
  /** Extra search terms (Turkish) used by the demo provider's text query matching. */
  keywords: string[];
}
