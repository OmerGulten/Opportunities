import { ExternalLink, MapPin, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ConfidenceBadge, GoogleAttribution, Kpi, PageHeader, ScoreRing, ServiceBadge, toneBadgeClass } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BusinessDetail } from "@/features/businesses/queries";
import { getT, pickLocalized } from "@/lib/i18n";
import type { Locale } from "@/types/common";

import { BusinessDetailActions } from "./detail-actions";
import { formatDate, formatNumber } from "./summaries";

export interface BusinessDetailHeaderProps {
  detail: BusinessDetail;
  locale: Locale;
  serviceIcons: Record<string, string | null>;
  /** Rendered next to the actions (for example the demo-data indicator). */
  badge?: ReactNode;
}

/**
 * Identity block: who the business is, where it is, what the provider reports
 * and which service opportunity scored highest.
 */
export function BusinessDetailHeader({ detail, locale, serviceIcons, badge }: BusinessDetailHeaderProps) {
  const t = getT(locale, "businesses");
  const tc = getT(locale, "common");
  const snapshot = detail.snapshot;
  const name = snapshot?.display_name ?? t("detail.unnamed");
  const categoryLabel = detail.category ? pickLocalized(detail.category, "name", locale) : null;
  const primary = detail.serviceScores.find((service) => service.isPrimary) ?? null;
  const location = [snapshot?.district, snapshot?.city].filter(Boolean).join(", ");

  return (
    <PageHeader
      title={name}
      description={[categoryLabel, snapshot?.formatted_address].filter(Boolean).join(" · ") || undefined}
      breadcrumbs={[
        { label: t("title"), href: "/businesses" },
        { label: name },
      ]}
      actions={
        <>
          {badge}
          <BusinessDetailActions
            businessId={detail.business.id}
            isIgnored={detail.business.is_ignored}
            inPipeline={Boolean(detail.lead)}
            primaryServiceId={detail.opportunity?.primary_service_id ?? null}
          />
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-card p-4">
        <ScoreRing score={detail.opportunity?.overall_score ?? null} size="lg" caption={t("detail.header.scoreCaption")} />

        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("detail.header.primaryOpportunity")}</span>
          {primary ? (
            <div className="flex flex-wrap items-center gap-2">
              <ServiceBadge name={primary.serviceLabel || primary.serviceKey} icon={serviceIcons[primary.serviceId] ?? null} />
              <Badge variant="outline" className={toneBadgeClass.neutral}>
                {tc("score.outOf", { score: primary.score })}
              </Badge>
              {detail.opportunity ? <ConfidenceBadge confidence={detail.opportunity.confidence} withLabel /> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("detail.header.noPrimary")}</p>
          )}
          {detail.opportunity ? (
            <span className="text-xs text-muted-foreground">
              {t("detail.header.calculatedAt", { date: formatDate(detail.opportunity.calculated_at, locale) ?? tc("states.unknown") })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t("detail.header.notScored")}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-6 sm:ml-auto">
          <Kpi
            label={t("detail.info.rating")}
            value={formatNumber(snapshot?.rating ?? null, locale, { maximumFractionDigits: 1 }) ?? "–"}
            hint={`${formatNumber(snapshot?.user_rating_count ?? null, locale) ?? "–"} ${tc("units.reviews")}`}
            icon={<Star />}
          />
          <Kpi label={t("detail.info.district")} value={location || "–"} icon={<MapPin />} />
          <div className="flex flex-col items-start gap-1">
            {snapshot?.google_maps_uri ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={snapshot.google_maps_uri} target="_blank" rel="noreferrer noopener" />}
              >
                <ExternalLink />
                {t("detail.header.openInProvider")}
              </Button>
            ) : null}
            <GoogleAttribution />
          </div>
        </div>
      </div>
    </PageHeader>
  );
}
