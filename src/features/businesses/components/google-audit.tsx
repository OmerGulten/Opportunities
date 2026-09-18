import Link from "next/link";

import { ConfidenceBadge, GoogleAttribution, KeyValueList, ScoreBar, toneBadgeClass, type KeyValueItem } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import type { BusinessDetail } from "@/features/businesses/queries";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/common";

import { AuditObservation, AuditStatusNotice } from "./audit-status";
import { FindingList } from "./finding-list";
import { formatNumber, googleSummary, latestAudit } from "./summaries";
import { BoolValue, TextValue } from "./value-cells";

const KNOWN_FIELDS = new Set(["website", "phone", "address", "opening_hours", "photos", "rating"]);

export interface GoogleAuditSectionProps {
  detail: BusinessDetail;
  locale: Locale;
}

/** Google Business Profile completeness and the review-sample observations. */
export function GoogleAuditSection({ detail, locale }: GoogleAuditSectionProps) {
  const t = getT(locale, "businesses");
  const tc = getT(locale, "common");
  const audit = latestAudit(detail.audits, "google_business");
  const summary = googleSummary(audit);

  if (!audit) {
    return <p className="text-sm text-muted-foreground">{t("detail.google.noAudit")}</p>;
  }

  const completeness = summary?.completenessScore ?? null;
  const missing = (summary?.missingFields ?? []).filter((field): field is string => typeof field === "string");
  const sample = summary?.reviewSample ?? null;

  const items: KeyValueItem[] = [
    { key: "website", label: t("detail.google.fields.website"), value: <BoolValue value={summary?.hasWebsite ?? null} /> },
    { key: "phone", label: t("detail.google.fields.phone"), value: <BoolValue value={summary?.hasPhone ?? null} /> },
    { key: "address", label: t("detail.google.fields.address"), value: <BoolValue value={summary?.hasAddress ?? null} /> },
    { key: "hours", label: t("detail.google.fields.opening_hours"), value: <BoolValue value={summary?.hasOpeningHours ?? null} /> },
    { key: "photos", label: t("detail.google.fields.photos"), value: <TextValue value={formatNumber(summary?.photoCount ?? null, locale)} /> },
    {
      key: "rating",
      label: t("detail.google.fields.rating"),
      value: <TextValue value={formatNumber(summary?.rating ?? null, locale, { maximumFractionDigits: 1 })} />,
      hint: `${formatNumber(summary?.reviewCount ?? null, locale) ?? "–"} ${tc("units.reviews")}`,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AuditStatusNotice audit={audit} locale={locale} />

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t("detail.google.completeness")}</span>
          <AuditObservation audit={audit} />
          {completeness === null ? (
            <Badge variant="outline" className={toneBadgeClass.neutral}>
              {tc("observation.not_checked")}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground tabular-nums">{t("detail.google.completenessValue", { score: completeness })}</span>
          )}
        </div>
        {completeness !== null ? <ScoreBar score={completeness} /> : null}

        <KeyValueList items={items} />

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("detail.google.missingFields")}</h3>
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("detail.google.noMissingFields")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {missing.map((field) => (
                <Badge key={field} variant="outline" className={toneBadgeClass.attention}>
                  {KNOWN_FIELDS.has(field) ? t(`detail.google.fields.${field}`) : field}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("detail.google.reviewSample")}</h3>
          {!sample ? (
            <p className="text-sm text-muted-foreground">{tc("observation.not_checked")}</p>
          ) : (
            <>
              <KeyValueList
                items={[
                  { key: "size", label: t("detail.google.sampleSize"), value: <TextValue value={formatNumber(sample.size ?? null, locale)} /> },
                  {
                    key: "replies",
                    label: t("detail.google.withOwnerReply"),
                    value: <TextValue value={formatNumber(sample.withOwnerReply ?? null, locale)} />,
                  },
                  {
                    key: "rate",
                    label: t("detail.google.responseRate"),
                    value: (
                      <TextValue
                        value={
                          sample.responseRate === null || sample.responseRate === undefined
                            ? null
                            : formatNumber(sample.responseRate, locale, { style: "percent", maximumFractionDigits: 0 })
                        }
                      />
                    ),
                  },
                  {
                    key: "unanswered",
                    label: t("detail.google.recentUnanswered"),
                    value: <TextValue value={formatNumber(sample.recentUnanswered ?? null, locale)} />,
                  },
                ]}
              />
              <div className="flex flex-wrap items-center gap-2">
                {sample.confidence ? <ConfidenceBadge confidence={sample.confidence} withLabel /> : null}
                <p className="text-xs text-muted-foreground">{t("detail.google.sampleNotice")}</p>
              </div>
            </>
          )}
        </div>

        {summary?.mapsUrl ? (
          <Link
            href={summary.mapsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm break-all text-primary hover:underline"
          >
            {t("detail.google.mapsLink")}
          </Link>
        ) : null}

        <GoogleAttribution variant="full" />
      </div>

      <FindingList findings={audit.findings} locale={locale} />
    </div>
  );
}
