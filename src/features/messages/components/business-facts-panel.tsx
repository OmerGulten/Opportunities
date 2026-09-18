import { CircleSlash, FileText, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { ConfidenceBadge, GoogleAttribution, ScoreBadge, StatusBadge, WebsiteStatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getT } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils/format";
import type { SenderFacts, VerifiedBusinessFacts } from "@/types/ai";
import type { Locale, ObservationStatus } from "@/types/common";
import type { WebsiteStatus } from "@/types/signals";

export interface BusinessFactsPanelProps {
  locale: Locale;
  /** Exactly the structure handed to the model. */
  facts: VerifiedBusinessFacts;
  sender: SenderFacts;
  /** Raw statuses from the signals, so badges keep their own colour and label. */
  websiteStatus: WebsiteStatus | null;
  instagramStatus: ObservationStatus | null;
  snapshotStale: boolean;
  reportLinkAvailable: boolean;
}

/**
 * Shows the user exactly what the model is allowed to use.
 *
 * The grounding is only credible if it is visible, so this panel mirrors
 * `loadBusinessFacts` one to one: an unchecked field is labelled unchecked, and
 * nothing is filled in with a plausible-looking default.
 */
export function BusinessFactsPanel({
  locale,
  facts,
  sender,
  websiteStatus,
  instagramStatus,
  snapshotStale,
  reportLinkAvailable,
}: BusinessFactsPanelProps) {
  const t = getT(locale, "messages");

  return (
    <aside className="flex flex-col gap-4 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" aria-hidden />
          <h2 className="font-heading text-base leading-snug font-medium">{t("facts.title")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t("facts.description")}</p>
      </header>

      <dl className="divide-y divide-border">
        <FactRow label={t("facts.businessName")} value={facts.businessName || t("facts.none")} />
        <FactRow label={t("facts.category")} value={facts.categoryLabel ?? t("facts.none")} muted={!facts.categoryLabel} />
        <FactRow
          label={t("facts.location")}
          value={[facts.district, facts.city].filter(Boolean).join(", ") || t("facts.none")}
          muted={!facts.district && !facts.city}
        />
        <FactRow
          label={t("facts.rating")}
          value={
            facts.rating === null
              ? t("facts.none")
              : formatNumber(facts.rating, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
          }
          muted={facts.rating === null}
        />
        <FactRow
          label={t("facts.reviewCount")}
          value={facts.reviewCount === null ? t("facts.none") : formatNumber(facts.reviewCount, locale)}
          muted={facts.reviewCount === null}
        />
        <FactRow
          label={t("facts.website")}
          value={websiteStatus ? <WebsiteStatusBadge status={websiteStatus} /> : <span className="text-muted-foreground">{facts.websiteStatus}</span>}
        />
        <FactRow
          label={t("facts.instagram")}
          value={instagramStatus ? <StatusBadge status={instagramStatus} /> : <span className="text-muted-foreground">{facts.instagramStatus}</span>}
        />
      </dl>

      <Separator />

      <section className="space-y-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("facts.gaps")}</h3>
        {facts.googleGaps.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {facts.googleGaps.map((gap) => (
              <li key={gap}>
                <Badge variant="outline" className="border-amber-600/25 bg-amber-500/10 font-normal text-amber-700 dark:border-amber-400/25 dark:text-amber-300">
                  {gap}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine text={t("facts.noGaps")} />
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("facts.findings")}</h3>
        {facts.topFindings.length > 0 ? (
          <ul className="space-y-2">
            {facts.topFindings.map((finding) => (
              <li key={finding.key} className="space-y-1 rounded-lg bg-muted/40 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 font-medium">{finding.title}</span>
                  <ConfidenceBadge confidence={finding.confidence} withLabel />
                </div>
                {finding.explanation ? <p className="text-xs text-muted-foreground">{finding.explanation}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine text={t("facts.noFindings")} />
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("facts.services")}</h3>
        {facts.serviceScores.length > 0 ? (
          <ul className="space-y-1.5">
            {facts.serviceScores.map((service) => (
              <li key={service.serviceKey} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{service.serviceLabel}</span>
                <ScoreBadge score={service.score} size="sm" />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyLine text={t("facts.noServices")} />
        )}
      </section>

      <Separator />

      <dl className="divide-y divide-border">
        <FactRow
          label={t("facts.sender")}
          value={[sender.senderName, sender.senderTitle].filter(Boolean).join(" · ") || t("facts.noSender")}
          muted={!sender.senderName && !sender.senderTitle}
        />
        <FactRow label={t("facts.workspace")} value={sender.workspaceName} />
        <FactRow
          label={t("facts.reportLink")}
          value={
            <span className="inline-flex items-center gap-1.5 text-xs">
              <FileText className="size-3.5 text-muted-foreground" aria-hidden />
              {reportLinkAvailable ? t("facts.reportAvailable") : t("facts.reportUnavailable")}
            </span>
          }
          muted={!reportLinkAvailable}
        />
      </dl>

      <footer className="space-y-2 border-t border-border pt-3">
        {snapshotStale ? <p className="text-xs text-amber-700 dark:text-amber-300">{t("facts.snapshotStale")}</p> : null}
        <p className="text-xs text-muted-foreground">{t("facts.honesty")}</p>
        <GoogleAttribution variant="full" />
      </footer>
    </aside>
  );
}

function FactRow({ label, value, hint, muted = false }: { label: string; value: ReactNode; hint?: string; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="text-xs text-muted-foreground sm:w-36 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1">
        <div className={muted ? "flex flex-wrap items-center gap-2 text-muted-foreground" : "flex flex-wrap items-center gap-2"}>{value}</div>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </dd>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <CircleSlash className="size-3.5" aria-hidden />
      {text}
    </p>
  );
}
