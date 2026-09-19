import type { VerifiedBusinessFacts } from "@/types/ai";

/**
 * Removes Google-derived Places content from the facts before they reach a
 * third-party model.
 *
 * Lineage: businessName, district, city, rating and reviewCount all originate
 * in a Places response and are held in business_provider_snapshots; googleGaps
 * describes observations of the Google Business profile. Everything else on
 * VerifiedBusinessFacts is ours -- website audit results, service scores and
 * findings this application produced.
 *
 * Why this exists rather than a comment saying it is probably fine: the Google
 * Maps Platform Service Specific Terms prohibit using Google Maps Content to
 * "train, test, validate or fine-tune" machine learning models, and prohibit
 * separating Google Maps Content from grounded output. Passing content to a
 * model for inference is not training, and OpenAI states API data is not used
 * for training by default -- but whether handing Google Maps Content to a
 * third-party LLM is permitted under the Agreement is an unresolved
 * contractual question. An unresolved question is not a licence, so the default
 * is to not do it.
 *
 * The draft still has plenty to work with: what is wrong with the site, which
 * services score highest, and what the workspace sells.
 */
export function redactProviderContent(facts: VerifiedBusinessFacts): VerifiedBusinessFacts {
  return {
    ...facts,
    businessName: "",
    district: null,
    city: null,
    rating: null,
    reviewCount: null,
    googleGaps: [],
  };
}

/** The fields redactProviderContent() strips, for tests and for the report. */
export const PROVIDER_DERIVED_FACT_KEYS = ["businessName", "district", "city", "rating", "reviewCount", "googleGaps"] as const;
