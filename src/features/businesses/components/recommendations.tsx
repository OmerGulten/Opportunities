import { ScoreBadge, ServiceBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import type { BusinessDetail } from "@/features/businesses/queries";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/common";

import { formatMoney } from "./summaries";

const BILLING_PERIODS = new Set(["one_time", "monthly", "yearly"]);

export interface RecommendationsSectionProps {
  detail: BusinessDetail;
  locale: Locale;
  serviceIcons: Record<string, string | null>;
}

/**
 * The workspace's own packages whose service has a real opportunity score.
 *
 * The match is stated as a service fit and is justified by the observed gaps;
 * it never claims the business is likely to buy.
 */
export function RecommendationsSection({ detail, locale, serviceIcons }: RecommendationsSectionProps) {
  const t = getT(locale, "businesses");

  if (detail.recommendations.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("detail.recommendations.none")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        {detail.recommendations.map((offering) => {
          const from = formatMoney(offering.price_from, offering.currency, locale);
          const to = formatMoney(offering.price_to, offering.currency, locale);
          const price = from && to ? t("detail.recommendations.priceRange", { from, to }) : from ? t("detail.recommendations.priceFrom", { price: from }) : null;

          return (
            <article key={offering.id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-sm font-medium">{offering.name}</h3>
                  <ServiceBadge name={offering.serviceLabel || offering.serviceKey} icon={serviceIcons[offering.service_id] ?? null} />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ScoreBadge score={offering.score} />
                  <span className="text-[0.7rem] text-muted-foreground">{t("detail.recommendations.serviceScore")}</span>
                </div>
              </div>

              {offering.description ? <p className="text-sm text-muted-foreground">{offering.description}</p> : null}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium tabular-nums">{price ?? t("detail.recommendations.noPrice")}</span>
                {BILLING_PERIODS.has(offering.billing_period) ? (
                  <Badge variant="outline" className="font-normal">
                    {t(`detail.recommendations.billing.${offering.billing_period}`)}
                  </Badge>
                ) : null}
                {offering.delivery_time ? (
                  <span className="text-xs text-muted-foreground">
                    {t("detail.recommendations.delivery")}: {offering.delivery_time}
                  </span>
                ) : null}
              </div>

              {offering.reasons.length > 0 ? (
                <div className="flex flex-col gap-1 border-t border-border pt-2">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("detail.recommendations.reasons")}</span>
                  <ul className="flex list-disc flex-col gap-0.5 pl-4 text-sm text-muted-foreground">
                    {offering.reasons.map((reason, index) => (
                      <li key={`${offering.id}-${index}`}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{t("detail.recommendations.matchNotice")}</p>
    </div>
  );
}
