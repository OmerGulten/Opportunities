import { GoogleAttribution, toneBadgeClass } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BusinessDetail } from "@/features/businesses/queries";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/common";

import { formatDate, formatNumber, medianOf, readCompetitors, readMetrics, type DeepLoose } from "./summaries";
import { BoolValue, TextValue } from "./value-cells";
import type { BenchmarkMetrics } from "@/types/audits";

const QUALITY_VALUES = new Set(["weak", "average", "strong"]);

export interface BenchmarkSectionProps {
  detail: BusinessDetail;
  locale: Locale;
}

function QualityCell({ value, locale }: { value: DeepLoose<BenchmarkMetrics>["websiteQuality"]; locale: Locale }) {
  const t = getT(locale, "businesses");
  if (!value || !QUALITY_VALUES.has(value)) return <TextValue value={null} />;
  return (
    <Badge variant="outline" className={value === "weak" ? toneBadgeClass.attention : toneBadgeClass.neutral}>
      {t(`detail.website.qualityValue.${value}`)}
    </Badge>
  );
}

/**
 * Side-by-side observations for nearby businesses.
 *
 * Only values that were actually observed are shown, and the statements below
 * the table are counts — never a ranking, a judgement or a claim about what the
 * business should do.
 */
export function BenchmarkSection({ detail, locale }: BenchmarkSectionProps) {
  const t = getT(locale, "businesses");

  if (!detail.benchmark) {
    return <p className="text-sm text-muted-foreground">{t("detail.benchmark.none")}</p>;
  }

  const current = readMetrics(detail.benchmark.metrics);
  const competitors = readCompetitors(detail.benchmark.competitors);
  const total = competitors.length;

  const withWebsite = competitors.filter((entry) => entry.metrics.hasWebsite === true).length;
  const withInstagram = competitors.filter((entry) => entry.metrics.hasInstagram === true).length;
  const withHours = competitors.filter((entry) => entry.metrics.hasOpeningHours === true).length;
  const medianReviews = medianOf(
    competitors
      .map((entry) => entry.metrics.reviewCount)
      .filter((value): value is number => typeof value === "number"),
  );

  const rows: Array<{ key: string; name: string; distance: number | null; metrics: DeepLoose<BenchmarkMetrics>; isCurrent: boolean }> = [
    { key: "current", name: t("detail.benchmark.current"), distance: null, metrics: current, isCurrent: true },
    ...competitors.map((entry, index) => ({
      key: `${entry.providerPlaceId}-${index}`,
      name: entry.displayName,
      distance: entry.distanceM,
      metrics: entry.metrics,
      isCurrent: false,
    })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t("detail.benchmark.neutralNotice")}</p>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("detail.benchmark.competitor")}</TableHead>
              <TableHead>{t("detail.benchmark.metrics.hasWebsite")}</TableHead>
              <TableHead>{t("detail.benchmark.metrics.websiteQuality")}</TableHead>
              <TableHead>{t("detail.benchmark.metrics.rating")}</TableHead>
              <TableHead>{t("detail.benchmark.metrics.reviewCount")}</TableHead>
              <TableHead>{t("detail.benchmark.metrics.hasInstagram")}</TableHead>
              <TableHead>{t("detail.benchmark.metrics.photoCount")}</TableHead>
              <TableHead>{t("detail.benchmark.metrics.hasOpeningHours")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key} className={row.isCurrent ? "bg-primary/5" : undefined}>
                <TableCell>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className={row.isCurrent ? "text-sm font-medium" : "text-sm"}>{row.name}</span>
                    {row.distance !== null ? (
                      <span className="text-xs text-muted-foreground">{t("detail.benchmark.distance", { meters: Math.round(row.distance) })}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <BoolValue value={row.metrics.hasWebsite ?? null} />
                </TableCell>
                <TableCell>
                  <QualityCell value={row.metrics.websiteQuality ?? null} locale={locale} />
                </TableCell>
                <TableCell>
                  <TextValue value={formatNumber(row.metrics.rating ?? null, locale, { maximumFractionDigits: 1 })} />
                </TableCell>
                <TableCell>
                  <TextValue value={formatNumber(row.metrics.reviewCount ?? null, locale)} />
                </TableCell>
                <TableCell>
                  <BoolValue value={row.metrics.hasInstagram ?? null} />
                </TableCell>
                <TableCell>
                  <TextValue value={formatNumber(row.metrics.photoCount ?? null, locale)} />
                </TableCell>
                <TableCell>
                  <BoolValue value={row.metrics.hasOpeningHours ?? null} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {total > 0 ? (
        <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
          <li>{t("detail.benchmark.statements.website", { count: withWebsite, total })}</li>
          <li>{t("detail.benchmark.statements.instagram", { count: withInstagram, total })}</li>
          <li>{t("detail.benchmark.statements.hours", { count: withHours, total })}</li>
          {medianReviews !== null ? <li>{t("detail.benchmark.statements.reviews", { median: medianReviews })}</li> : null}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t("detail.benchmark.generatedAt", { date: formatDate(detail.benchmark.createdAt, locale) ?? "" })}
        </span>
        <GoogleAttribution />
      </div>
    </div>
  );
}
