import { providerFieldChecked } from "@/lib/audits/google-business/audit";
import { getT, type TFunction } from "@/lib/i18n";
import type { BenchmarkMetrics, CompetitorBenchmarkSummary } from "@/types/audits";
import type { Locale } from "@/types/common";
import type { PlaceDetails } from "@/types/places";

/**
 * Neutral competitor benchmark.
 *
 * Rules this file enforces, because the output is shown to the business owner:
 *  - competitors are anonymised (`Competitor A`, `Competitor B`, ...), never named;
 *  - every statement names the metric and the numbers behind it;
 *  - no statement ranks anyone: there is no "better", "worse", "leader" or
 *    "behind". A metric nobody has data for produces no statement at all.
 */

const COMPETITOR_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type MetricKey = keyof BenchmarkMetrics;

const METRIC_ORDER: readonly MetricKey[] = [
  "hasWebsite",
  "websiteQuality",
  "rating",
  "reviewCount",
  "hasInstagram",
  "photoCount",
  "hasOpeningHours",
];

export interface CompetitorInput {
  providerPlaceId: string;
  displayName: string;
  distanceM: number | null;
  metrics: BenchmarkMetrics;
}

export interface BenchmarkInput {
  current: { displayName: string; metrics: BenchmarkMetrics };
  competitors: CompetitorInput[];
  categoryKey: string | null;
  radiusM: number;
  locale: Locale;
}

export function competitorLabel(t: TFunction, index: number): string {
  const letter = index < COMPETITOR_LETTERS.length ? COMPETITOR_LETTERS[index] : String(index + 1);
  return t("benchmark.competitor_label", { letter });
}

/** Builds benchmark metrics from a provider payload, without inventing unchecked fields. */
export function metricsFromDetails(
  details: PlaceDetails,
  websiteQuality: BenchmarkMetrics["websiteQuality"] = null,
  hasInstagram: boolean | null = null,
): BenchmarkMetrics {
  const websiteChecked = providerFieldChecked(details, "websiteUri");
  const ratingChecked = providerFieldChecked(details, "rating");
  const reviewsChecked = providerFieldChecked(details, "userRatingCount");
  const photosChecked = providerFieldChecked(details, "photos");
  const hoursChecked = providerFieldChecked(details, "regularOpeningHours");

  return {
    hasWebsite: websiteChecked ? details.websiteUri !== null && details.websiteUri.trim() !== "" : null,
    websiteQuality,
    rating: ratingChecked ? details.rating : null,
    reviewCount: reviewsChecked ? details.userRatingCount : null,
    hasInstagram,
    photoCount: photosChecked ? (details.photoCount ?? 0) : null,
    hasOpeningHours: hoursChecked
      ? details.openingHours !== null && (details.openingHours.periodsCount > 0 || details.openingHours.weekdayDescriptions.length > 0)
      : null,
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  return Math.round(value * 100) / 100;
}

function booleanWord(t: TFunction, value: boolean | null): string {
  if (value === null) return t("value.unknown");
  return value ? t("value.yes") : t("value.no");
}

function qualityWord(t: TFunction, value: BenchmarkMetrics["websiteQuality"]): string {
  if (value === null) return t("value.unknown");
  return t(`value.${value}`);
}

function numberWord(t: TFunction, value: number | null): string {
  return value === null ? t("value.unknown") : String(Math.round(value * 100) / 100);
}

function booleanStatement(t: TFunction, key: string, current: boolean | null, competitors: ReadonlyArray<boolean | null>): string | null {
  const known = competitors.filter((value): value is boolean => value !== null);
  if (known.length === 0) return null;
  return t(`benchmark.${key}`, { count: known.filter(Boolean).length, total: known.length, current: booleanWord(t, current) });
}

function numericStatement(t: TFunction, key: string, current: number | null, competitors: ReadonlyArray<number | null>): string | null {
  const known = competitors.filter((value): value is number => value !== null);
  if (known.length === 0) return null;
  return t(`benchmark.${key}`, {
    current: numberWord(t, current),
    total: known.length,
    min: Math.round(Math.min(...known) * 100) / 100,
    max: Math.round(Math.max(...known) * 100) / 100,
    median: median(known),
  });
}

export function buildCompetitorBenchmark(input: BenchmarkInput): CompetitorBenchmarkSummary {
  const t = getT(input.locale, "findings");
  const metricsOf = <K extends MetricKey>(key: K): Array<BenchmarkMetrics[K]> => input.competitors.map((competitor) => competitor.metrics[key]);

  const comparisons: CompetitorBenchmarkSummary["comparisons"] = [];
  for (const metric of METRIC_ORDER) {
    let statement: string | null = null;
    switch (metric) {
      case "hasWebsite":
        statement = booleanStatement(t, "has_website", input.current.metrics.hasWebsite, metricsOf("hasWebsite"));
        break;
      case "hasInstagram":
        statement = booleanStatement(t, "has_instagram", input.current.metrics.hasInstagram, metricsOf("hasInstagram"));
        break;
      case "hasOpeningHours":
        statement = booleanStatement(t, "has_opening_hours", input.current.metrics.hasOpeningHours, metricsOf("hasOpeningHours"));
        break;
      case "rating":
        statement = numericStatement(t, "rating", input.current.metrics.rating, metricsOf("rating"));
        break;
      case "reviewCount":
        statement = numericStatement(t, "review_count", input.current.metrics.reviewCount, metricsOf("reviewCount"));
        break;
      case "photoCount":
        statement = numericStatement(t, "photo_count", input.current.metrics.photoCount, metricsOf("photoCount"));
        break;
      case "websiteQuality": {
        const known = metricsOf("websiteQuality").filter(
          (value): value is NonNullable<BenchmarkMetrics["websiteQuality"]> => value !== null,
        );
        statement =
          known.length === 0
            ? null
            : t("benchmark.website_quality", {
                total: known.length,
                weak: known.filter((value) => value === "weak").length,
                average: known.filter((value) => value === "average").length,
                strong: known.filter((value) => value === "strong").length,
                current: qualityWord(t, input.current.metrics.websiteQuality),
              });
        break;
      }
    }
    if (statement !== null) comparisons.push({ metric, statement });
  }

  return {
    categoryKey: input.categoryKey,
    radiusM: input.radiusM,
    current: input.current.metrics,
    competitors: input.competitors.map((competitor, index) => ({
      providerPlaceId: competitor.providerPlaceId,
      // Anonymised on purpose: the report never names another business.
      displayName: competitorLabel(t, index),
      distanceM: competitor.distanceM,
      metrics: competitor.metrics,
    })),
    comparisons,
    generatedAt: new Date().toISOString(),
  };
}
