import { z } from "zod";

import { ok, withApi } from "@/lib/api/with-api";
import { getPlaceProvider } from "@/lib/providers/registry";
import type { LocationSuggestion } from "@/types/places";

const locationQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

/**
 * GET /api/places/locations — place suggestions for the scan wizard's location
 * step. Location search is optional on the provider interface, so a provider
 * without it answers with an empty list rather than an error: the wizard then
 * falls back to manual coordinates.
 */
export const GET = withApi(
  async ({ ctx, query }) => {
    const provider = getPlaceProvider();
    if (typeof provider.searchLocations !== "function") return ok<LocationSuggestion[]>([]);
    const suggestions = await provider.searchLocations(query.q, { languageCode: ctx.locale });
    return ok(suggestions);
  },
  { query: locationQuerySchema, rateLimit: "enrichment" },
);
