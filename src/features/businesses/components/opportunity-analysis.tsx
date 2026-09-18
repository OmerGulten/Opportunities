"use client";

import { cn } from "cn";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { ConfidenceBadge, EvidenceTypeBadge, ScoreBadge, ScoreBar, ServiceIcon, toneBadgeClass } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ScoredService } from "@/features/businesses/queries";
import { useT } from "@/lib/i18n/client";

export interface OpportunityAnalysisProps {
  services: ScoredService[];
  /** Service id -> `services.icon` value. */
  serviceIcons: Record<string, string | null>;
}

const NOT_CHECKED_REASONS = new Set(["signal_missing", "not_checked", "unavailable", "error", "low_confidence", "depth_not_reached"]);

/**
 * Per-service scores, each expandable to the rules that produced it.
 *
 * Matched rules show their points and evidence type; rules that could not be
 * evaluated are listed separately with the reason, so a score is never read as
 * a complete picture when part of the input was missing.
 */
export function OpportunityAnalysis({ services, serviceIcons }: OpportunityAnalysisProps) {
  const t = useT("businesses");
  const [openId, setOpenId] = useState<string | null>(services[0]?.serviceId ?? null);

  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("detail.opportunity.noScores")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {services.map((service) => {
        const open = openId === service.serviceId;
        return (
          <Collapsible
            key={service.serviceId}
            open={open}
            onOpenChange={(next) => setOpenId(next ? service.serviceId : null)}
            className="rounded-xl border border-border bg-card"
          >
            <div className="flex flex-wrap items-center gap-3 p-3">
              <ServiceIcon icon={serviceIcons[service.serviceId] ?? null} colored />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{service.serviceLabel || service.serviceKey}</span>
                  {service.isPrimary ? (
                    <Badge variant="outline" className={toneBadgeClass.positive}>
                      {t("detail.opportunity.primary")}
                    </Badge>
                  ) : null}
                  {service.isSecondary ? (
                    <Badge variant="outline" className={toneBadgeClass.info}>
                      {t("detail.opportunity.secondary")}
                    </Badge>
                  ) : null}
                  <ConfidenceBadge confidence={service.confidence} withLabel />
                </div>
                <ScoreBar score={service.score} />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("detail.opportunity.points", { raw: service.rawPoints, max: service.maxPoints })}
                </span>
              </div>
              <ScoreBadge score={service.score} size="lg" />
              <CollapsibleTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label={open ? t("detail.opportunity.collapse") : t("detail.opportunity.expand")}>
                    <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
                  </Button>
                }
              />
            </div>

            <CollapsibleContent>
              <div className="flex flex-col gap-4 border-t border-border p-3">
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("detail.opportunity.matchedRules")}</h4>
                  {service.reasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("detail.opportunity.noReasons")}</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {service.reasons.map((reason, index) => (
                        <li key={`${service.serviceId}-${reason.label}-${index}`} className="flex flex-col gap-1 rounded-lg bg-muted/40 p-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium tabular-nums">
                              {reason.points >= 0 ? "+" : ""}
                              {reason.points}
                            </span>
                            <span className="text-sm">{reason.label}</span>
                            <EvidenceTypeBadge evidenceType={reason.evidenceType} />
                          </div>
                          {reason.explanation ? <p className="text-xs text-muted-foreground">{reason.explanation}</p> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("detail.opportunity.notChecked")}</h4>
                  <p className="text-xs text-muted-foreground">{t("detail.opportunity.notCheckedDescription")}</p>
                  {service.notChecked.length === 0 ? null : (
                    <ul className="flex flex-col gap-1">
                      {service.notChecked.map((rule, index) => (
                        <li key={`${service.serviceId}-${rule.ruleKey}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-mono text-xs break-all">{rule.ruleKey}</span>
                          <Badge variant="outline" className={toneBadgeClass.neutral}>
                            {NOT_CHECKED_REASONS.has(rule.reason) ? t(`detail.notCheckedReason.${rule.reason}`) : rule.reason}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
