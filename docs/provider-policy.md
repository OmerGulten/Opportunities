# Provider Policy Layer

External data providers come with licence terms that constrain what we may cache, store,
display and export. OpportunityOS encodes those constraints in code so the rest of the
application does not need to know provider specifics.

## Policy model (`src/lib/providers/policy/types.ts`)

```ts
interface ProviderPolicy {
  provider: string;                 // "google_places", "demo", ...
  termsUrl: string;
  persistentFields: string[];       // may be stored indefinitely (identifiers)
  cacheableFields: string[];        // may be cached for cacheTtlHours, then must be refreshed or purged
  cacheTtlHours: number;            // retention for cacheable content
  attribution: {
    required: boolean;
    logoRequired: boolean;          // when shown outside a provider map
    text: string;                   // fallback text attribution
  };
  export: {
    allowedFields: string[];        // fields that may leave the product (CSV etc.)
    bulkExportAllowed: boolean;     // false for Google Places
  };
  notes: string[];
}
```

`policy.filterForExport(record)` and `policy.isExpired(snapshot)` are the two helpers every
consumer uses. The `businesses` table stores only identifiers (`provider`,
`provider_place_id`, `normalized_name`, `canonical_fingerprint`). Everything else the provider
returns lives in `business_provider_snapshots` with `fetched_at` and `expires_at`. Expired
snapshots are refreshed on demand from the provider or shown as stale.

## Google Places (New)

* **Persistent**: `place_id` only. The application deliberately does not persist Google-derived business names, addresses, coordinates or other secondary identity material.
* **Cacheable (short-lived)**: display name, formatted address, coordinates, types, rating,
  review count, website URL, phone, opening hours, photo count, Maps URL. Default TTL is
  30 days (`cacheTtlHours = 720`), after which snapshots are considered expired.
* **Attribution**: when content is shown on a Google Map no extra attribution is needed. When
  shown in tables, cards, reports or anywhere without a Google map we render the Google
  Maps attribution mark (`<GoogleAttribution />`). Public reports always show it.
* **Export**: bulk export of raw Places content is **not** a product feature.
  `GET /api/export/businesses` only emits fields marked as export-allowed: our own
  identifiers, opportunity scores, statuses and CRM fields plus the `place_id`. Enabling a
  broader export is gated behind a system setting (`export.provider_content_enabled`) which
  must stay off unless the workspace has compliance approval documented.
* **Not a mailing list**: we do not build permanent telemarketing lists from Places data.
  Contact channels shown to the user are opened manually one at a time.
* **Field masks**: all Places requests go through `lib/providers/places/field-masks.ts`.
  Discovery uses the smallest mask (id, displayName, location, types, businessStatus,
  formattedAddress). Details requests add only what the selected audit depth needs.
  Enterprise/Atmosphere fields (reviews, editorialSummary) are requested only for deep
  audits.

## PageSpeed Insights

Public API; results are performance measurements of a public URL. Stored as part of the
website audit summary with `source = pagespeed`. When the API is not configured we run a
heuristic audit labelled `heuristic` and never present it as a Lighthouse score.

## Website content

Fetched HTML is processed in memory, reduced to structured findings and discarded. We do not
store page bodies. Fetched content is untrusted and is never inserted into AI prompts as
instructions, only as extracted structured facts.

## Instagram

We do not scrape authenticated pages or require login. Discovery is limited to links found on
the business website and provider profile references. Unknown remains `not_checked` or
`unavailable`, never `not_found`, unless evidence supports it.

## Demo provider

Fictional businesses with no real people. No restrictions; policy mirrors Google Places so
UI behaviour is identical.

## Adding a provider

1. Implement `PlaceProvider` in `lib/providers/places/<name>/`.
2. Declare its `ProviderPolicy`.
3. Register in `lib/providers/registry.ts`.
4. Add `category_provider_mappings` rows for the provider in the seed / admin.
