import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalFingerprint } from "@/features/businesses/dedupe";

/**
 * Matching fingerprints for a scan's businesses, derived from the provider
 * cache and never stored.
 *
 * `businesses` rows have no expiry, so a provider-derived identity column there
 * would be an indefinite copy of Places content, which the licence does not
 * allow. `business_provider_snapshots` is the copy it does allow: it carries
 * `expires_at` and `purge_expired_provider_cache()` collects it. Discovery
 * writes the snapshot moments before deduplication runs, so the material is
 * always present when it is needed, and it disappears on the same schedule as
 * the rest of the cached payload.
 *
 * The fingerprint is a one-way digest, but deriving it here rather than storing
 * it means there is no second copy of provider identity to keep in step with
 * the retention rules at all.
 *
 * Kept in its own module so it can be tested: the discovery step reaches
 * `server-only` code that cannot be imported from a test.
 */

interface SnapshotIdentity {
  business_id: string;
  display_name: string;
  formatted_address: string | null;
  lat: number | null;
  lng: number | null;
}

/** Batched so a large scan does not build one enormous PostgREST URL. */
const BATCH_SIZE = 200;

export async function fingerprintsFromSnapshots(client: SupabaseClient, businessIds: readonly string[]): Promise<Map<string, string>> {
  const fingerprints = new Map<string, string>();
  const unique = [...new Set(businessIds)];
  if (unique.length === 0) return fingerprints;

  for (let offset = 0; offset < unique.length; offset += BATCH_SIZE) {
    const batch = unique.slice(offset, offset + BATCH_SIZE);
    const { data } = await client
      .from("business_provider_snapshots")
      .select("business_id, display_name, formatted_address, lat, lng")
      .in("business_id", batch)
      .order("fetched_at", { ascending: false })
      .returns<SnapshotIdentity[]>();

    // Newest first, so the first row seen for a business is its latest snapshot:
    // a deeper re-fetch is not overwritten by the discovery-level row beneath it.
    for (const row of data ?? []) {
      if (fingerprints.has(row.business_id)) continue;
      fingerprints.set(
        row.business_id,
        canonicalFingerprint({
          name: row.display_name,
          address: row.formatted_address ?? "",
          lat: row.lat ?? 0,
          lng: row.lng ?? 0,
        }),
      );
    }
  }

  return fingerprints;
}
