import { AtSign, Building2, Globe, Mail, MapPin, Phone, Star } from "lucide-react";
import type { ReactNode } from "react";

import {
  ConfidenceBadge,
  EvidenceTypeBadge,
  GoogleAttribution,
  ScoreRing,
  SeverityBadge,
  StatusBadge,
  WebsiteStatusBadge,
} from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { dateLocaleTag, getT } from "@/lib/i18n";
import type { ObservationStatus } from "@/types/common";
import type { WebsiteStatus } from "@/types/signals";
import type { ReportBranding, ReportSnapshot } from "@/features/reports/types";

import { ReportPrintButton } from "./report-print-button";

const OBSERVATION_STATUSES: readonly ObservationStatus[] = ["found", "not_found", "not_checked", "unavailable", "error", "ambiguous"];
const WEBSITE_STATUSES: readonly WebsiteStatus[] = ["found", "not_found", "unreachable", "redirected", "invalid", "not_checked"];

/**
 * Unknown values fall back to `not_checked`, never to `not_found`: an outcome we
 * cannot interpret is an outcome we did not establish.
 */
function asObservationStatus(value: string): ObservationStatus {
  return (OBSERVATION_STATUSES as readonly string[]).includes(value) ? (value as ObservationStatus) : "not_checked";
}

/** `website.status` carries its own vocabulary (unreachable, redirected, invalid…). */
function asWebsiteStatus(value: string): WebsiteStatus {
  return (WEBSITE_STATUSES as readonly string[]).includes(value) ? (value as WebsiteStatus) : "not_checked";
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Only plain hex colours reach a `style` attribute; anything else is dropped. */
function safeColor(value: unknown): string | null {
  const text = safeString(value);
  return text && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? text : null;
}

/** Branding and business URLs come from stored data, so only http(s) is rendered. */
function safeHttpUrl(value: unknown): string | null {
  const text = safeString(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The `branding` column is stored as loose JSON; read it defensively. */
export function normalizeBranding(value: Record<string, unknown> | null | undefined): ReportBranding {
  const source = value ?? {};
  return {
    workspaceName: safeString(source.workspaceName) ?? "",
    logoUrl: safeHttpUrl(source.logoUrl),
    primaryColor: safeColor(source.primaryColor),
    senderName: safeString(source.senderName),
    senderTitle: safeString(source.senderTitle),
    contactEmail: safeString(source.contactEmail),
    contactPhone: safeString(source.contactPhone),
    companyWebsite: safeHttpUrl(source.companyWebsite),
  };
}

const BILLING_PERIODS = new Set(["one_time", "monthly", "yearly"]);

/** `website_missing_title` -> `Website missing title`, used when a rule key has no translation. */
function humanizeKey(key: string): string {
  const words = key.replace(/[._-]+/g, " ").trim();
  return words.length === 0 ? key : words.charAt(0).toUpperCase() + words.slice(1);
}

export interface PublicReportProps {
  snapshot: ReportSnapshot;
  branding: ReportBranding;
  /** Title stored with the link; usually the business name. */
  title: string;
}

/**
 * The shared, read-only audit report.
 *
 * It renders exactly what the frozen snapshot carries — no live lookups, no CRM
 * data (no lead stage, owner, notes, activity or estimated value), and no
 * purchase-likelihood or revenue projection. Checks that could not be run are
 * shown as such, next to the ones that were, so the reader is never led to
 * treat "not checked" as "not there".
 */
export function PublicReport({ snapshot, branding, title }: PublicReportProps) {
  const locale = snapshot.locale;
  const t = getT(locale, "reports");
  const tc = getT(locale, "common");
  const tFindings = getT(locale, "findings");
  const tag = dateLocaleTag[locale];

  // A public page has no operator watching it, so formatting never throws: a bad
  // date or an unknown currency code degrades instead of taking the report down.
  const formatDate = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : new Intl.DateTimeFormat(tag, { dateStyle: "long" }).format(parsed);
  };
  const formatNumber = (value: number) => (Number.isFinite(value) ? new Intl.NumberFormat(tag).format(value) : "—");
  const formatMoney = (value: number, currency: string) => {
    try {
      return new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
    } catch {
      return `${formatNumber(value)} ${currency}`;
    }
  };

  const accent = branding.primaryColor;
  const generatedAt = formatDate(snapshot.generatedAt);
  const websiteUrl = safeHttpUrl(snapshot.business.websiteUrl);
  const mapsUrl = safeHttpUrl(snapshot.business.mapsUrl);
  const location = [snapshot.business.district, snapshot.business.city].filter(Boolean).join(", ");

  // The snapshot is JSON read back from the database; an older or partial one
  // must degrade to an empty section rather than take the whole page down.
  const digitalGaps = snapshot.summary.digitalGaps ?? [];
  const findings = snapshot.findings ?? [];
  const serviceOpportunities = snapshot.serviceOpportunities ?? [];
  const recommendations = snapshot.recommendations ?? [];

  const gapLabel = (gap: string) => {
    const label = t(`gaps.${gap}`);
    return label === `gaps.${gap}` ? humanizeKey(gap) : label;
  };

  const notCheckedLabel = (key: string) => {
    const label = tFindings(`${key}.title`);
    return label === `${key}.title` ? humanizeKey(key) : label;
  };

  return (
    <article
      data-report-root
      lang={locale}
      className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 md:py-12"
    >
      {/* Branding + document meta ------------------------------------------ */}
      <header data-report-section className="flex flex-col gap-4">
        <div data-report-accent className="border-t-2 border-primary" style={accent ? { borderTopColor: accent } : undefined} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- workspace logos are arbitrary remote URLs, not covered by images.remotePatterns
              <img src={branding.logoUrl} alt={branding.workspaceName} className="h-10 w-auto max-w-40 object-contain" />
            ) : (
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                style={accent ? { color: accent, backgroundColor: `${accent}1a` } : undefined}
              >
                <Building2 className="size-5" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <p className="font-heading text-sm leading-tight font-semibold">{branding.workspaceName}</p>
              <p data-report-muted className="text-xs text-muted-foreground">
                {t("public.documentTitle")}
              </p>
            </div>
          </div>
          <div data-report-hide-print>
            <ReportPrintButton />
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance">{title}</h1>
          <p data-report-muted className="text-sm text-muted-foreground">
            {t("public.preparedBy", { workspace: branding.workspaceName })}
            {generatedAt ? ` · ${t("public.generatedAt", { date: generatedAt })}` : null}
          </p>
        </div>
        <p className="text-sm text-pretty">{snapshot.summary.headline}</p>
      </header>

      {/* Business ---------------------------------------------------------- */}
      <section data-report-section className="flex flex-col gap-3">
        <h2 className="font-heading text-base font-medium">{t("public.business.title")}</h2>
        <Card data-report-card>
          <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label={t("public.business.category")} value={snapshot.business.categoryLabel ?? t("public.business.unknown")} />
            <Detail label={t("public.business.location")} value={location === "" ? t("public.business.unknown") : location} />
            {snapshot.business.address ? <Detail label={t("public.business.address")} value={snapshot.business.address} wide /> : null}
            <Detail
              label={t("public.business.rating")}
              value={
                snapshot.business.rating === null ? (
                  <span data-report-muted className="text-muted-foreground">
                    {t("public.business.unknown")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Star className="size-3.5 text-amber-500" aria-hidden />
                    {t("public.business.ratingValue", { rating: snapshot.business.rating.toFixed(1) })}
                    {snapshot.business.reviewCount === null ? null : (
                      <span data-report-muted className="text-muted-foreground">
                        · {formatNumber(snapshot.business.reviewCount)} {tc("units.reviews")}
                      </span>
                    )}
                  </span>
                )
              }
            />
            <Detail
              label={t("public.business.website")}
              value={
                <span className="flex flex-wrap items-center gap-2">
                  <WebsiteStatusBadge status={asWebsiteStatus(String(snapshot.business.websiteStatus))} />
                  {websiteUrl ? (
                    <a href={websiteUrl} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
                      <Globe className="size-3.5" aria-hidden />
                      {t("public.business.openWebsite")}
                    </a>
                  ) : null}
                </span>
              }
            />
            <Detail
              label={t("public.business.instagram")}
              value={
                <span className="flex items-center gap-2">
                  <AtSign className="size-3.5 text-muted-foreground" aria-hidden />
                  <StatusBadge status={asObservationStatus(String(snapshot.business.instagramStatus))} />
                </span>
              }
            />
            {mapsUrl ? (
              <Detail
                label={t("public.business.maps")}
                value={
                  <a href={mapsUrl} target="_blank" rel="noreferrer nofollow" className="inline-flex items-center gap-1 text-sm underline underline-offset-4">
                    <MapPin className="size-3.5" aria-hidden />
                    {t("public.business.openMaps")}
                  </a>
                }
              />
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Opportunity summary ----------------------------------------------- */}
      <section data-report-section className="flex flex-col gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-medium">{t("public.summary.title")}</h2>
          <p data-report-muted className="text-sm text-muted-foreground">
            {t("public.summary.description")}
          </p>
        </div>
        <Card data-report-card>
          <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            <div className="flex shrink-0 flex-col items-center gap-1">
              <ScoreRing score={snapshot.summary.overallScore} size="lg" caption={t("public.summary.scoreCaption")} />
              {snapshot.summary.overallScore === null ? (
                <p data-report-muted className="max-w-40 text-center text-xs text-muted-foreground">
                  {t("public.summary.notScoredHint")}
                </p>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-4">
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt data-report-muted className="text-xs text-muted-foreground">
                    {t("public.summary.primaryService")}
                  </dt>
                  <dd className="text-sm font-medium">{snapshot.summary.primaryServiceLabel ?? tc("states.unknown")}</dd>
                </div>
                <div>
                  <dt data-report-muted className="text-xs text-muted-foreground">
                    {t("public.summary.confidence")}
                  </dt>
                  <dd className="mt-0.5">
                    {snapshot.summary.confidence ? (
                      <ConfidenceBadge confidence={snapshot.summary.confidence} />
                    ) : (
                      <span data-report-muted className="text-sm text-muted-foreground">
                        {tc("states.notAvailable")}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="space-y-2">
                <p data-report-muted className="text-xs text-muted-foreground">
                  {t("public.summary.gapsTitle")}
                </p>
                {digitalGaps.length === 0 ? (
                  <p className="text-sm">{t("public.summary.gapsEmpty")}</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {digitalGaps.map((gap) => (
                      <li
                        key={gap}
                        className="inline-flex items-center rounded-4xl border border-amber-600/25 bg-amber-500/14 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-400/25 dark:text-amber-300"
                      >
                        {gapLabel(gap)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Findings ----------------------------------------------------------- */}
      <section data-report-section className="flex flex-col gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-medium">{t("public.findings.title")}</h2>
          <p data-report-muted className="text-sm text-muted-foreground">
            {t("public.findings.description")}
          </p>
        </div>
        {findings.length === 0 ? (
          <Card data-report-card>
            <CardContent className="space-y-1">
              <p className="text-sm font-medium">{t("public.findings.empty")}</p>
              <p data-report-muted className="text-sm text-muted-foreground">
                {t("public.findings.emptyHint")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {findings.map((finding) => (
              <li key={finding.key}>
                <Card data-report-card>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-medium text-pretty">{finding.title}</h3>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <SeverityBadge severity={finding.severity} />
                        <StatusBadge status={finding.status} />
                      </div>
                    </div>
                    {finding.explanation ? <p className="text-sm text-pretty">{finding.explanation}</p> : null}
                    {finding.whyItMatters ? (
                      <p data-report-muted className="text-sm text-pretty text-muted-foreground">
                        <span className="font-medium">{t("public.findings.whyItMatters")}: </span>
                        {finding.whyItMatters}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <EvidenceTypeBadge evidenceType={finding.evidenceType} />
                      <ConfidenceBadge confidence={finding.confidence} withLabel />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Per-service scores -------------------------------------------------- */}
      <section data-report-section className="flex flex-col gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-medium">{t("public.services.title")}</h2>
          <p data-report-muted className="text-sm text-muted-foreground">
            {t("public.services.description")}
          </p>
        </div>
        {serviceOpportunities.length === 0 ? (
          <Card data-report-card>
            <CardContent>
              <p className="text-sm">{t("public.services.empty")}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {serviceOpportunities.map((service) => (
              <li key={service.serviceKey}>
                <Card data-report-card>
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                    <div className="flex shrink-0 sm:pt-1">
                      <ScoreRing score={service.score} size="md" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{service.serviceLabel || humanizeKey(service.serviceKey)}</h3>
                        <ConfidenceBadge confidence={service.confidence} withLabel />
                      </div>

                      <div className="space-y-1.5">
                        <p data-report-muted className="text-xs text-muted-foreground">
                          {t("public.services.reasons")}
                        </p>
                        {(service.reasons ?? []).length === 0 ? (
                          <p className="text-sm">{t("public.services.noReasons")}</p>
                        ) : (
                          <ul className="flex flex-col gap-1.5">
                            {(service.reasons ?? []).map((reason, index) => (
                              <li key={`${service.serviceKey}-reason-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-mono text-xs tabular-nums text-emerald-700 dark:text-emerald-400">
                                  {t("public.services.reasonPoints", { points: formatNumber(reason.points) })}
                                </span>
                                <span className="min-w-0 flex-1">{reason.label}</span>
                                <EvidenceTypeBadge evidenceType={reason.evidenceType} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {(service.notChecked ?? []).length > 0 ? (
                        <div className="space-y-1.5 rounded-lg bg-muted/50 p-3">
                          <p className="text-xs font-medium">{t("public.services.notChecked")}</p>
                          <ul className="flex flex-wrap gap-1.5">
                            {(service.notChecked ?? []).map((key) => (
                              <li
                                key={`${service.serviceKey}-notchecked-${key}`}
                                className="inline-flex items-center rounded-4xl border border-slate-500/25 bg-slate-500/10 px-2 py-0.5 text-xs text-slate-700 dark:border-slate-400/20 dark:text-slate-300"
                              >
                                {notCheckedLabel(key)}
                              </li>
                            ))}
                          </ul>
                          <p data-report-muted className="text-xs text-muted-foreground">
                            {t("public.services.notCheckedHint")}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recommendations ------------------------------------------------------ */}
      <section data-report-section className="flex flex-col gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-base font-medium">{t("public.recommendations.title")}</h2>
          <p data-report-muted className="text-sm text-muted-foreground">
            {t("public.recommendations.description")}
          </p>
        </div>
        {recommendations.length === 0 ? (
          <Card data-report-card>
            <CardContent>
              <p className="text-sm">{t("public.recommendations.empty")}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recommendations.map((recommendation, index) => {
              const from = recommendation.priceFrom;
              const to = recommendation.priceTo;
              const price =
                from !== null && to !== null
                  ? t("public.recommendations.priceRange", {
                      from: formatMoney(from, recommendation.currency),
                      to: formatMoney(to, recommendation.currency),
                    })
                  : from !== null
                    ? t("public.recommendations.priceFrom", { from: formatMoney(from, recommendation.currency) })
                    : to !== null
                      ? t("public.recommendations.priceTo", { to: formatMoney(to, recommendation.currency) })
                      : t("public.recommendations.priceUnknown");
              const billingLabel =
                recommendation.billingPeriod && BILLING_PERIODS.has(recommendation.billingPeriod)
                  ? t(`public.recommendations.billing.${recommendation.billingPeriod}`)
                  : null;
              return (
                <li key={`${recommendation.serviceKey}-${index}`} className="h-full">
                  <Card data-report-card className="h-full">
                    <CardContent className="flex h-full flex-col gap-2">
                      <p data-report-muted className="text-xs text-muted-foreground">
                        {recommendation.serviceLabel || humanizeKey(recommendation.serviceKey)}
                      </p>
                      <h3 className="font-medium text-pretty">{recommendation.offeringName ?? recommendation.serviceLabel}</h3>
                      {recommendation.description ? (
                        <p data-report-muted className="text-sm text-pretty text-muted-foreground">
                          {recommendation.description}
                        </p>
                      ) : null}
                      <div className="mt-auto space-y-1 pt-2">
                        <p className="text-sm font-medium tabular-nums">{price}</p>
                        {billingLabel || recommendation.deliveryTime ? (
                          <p data-report-muted className="text-xs text-muted-foreground">
                            {billingLabel}
                            {billingLabel && recommendation.deliveryTime ? " · " : null}
                            {recommendation.deliveryTime ? t("public.recommendations.delivery", { time: recommendation.deliveryTime }) : null}
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Call to action + contact --------------------------------------------- */}
      {snapshot.callToAction || branding.senderName || branding.contactEmail || branding.contactPhone || branding.companyWebsite ? (
        <section data-report-section>
          <Card data-report-card className="border-t-2 border-primary" style={accent ? { borderTopColor: accent } : undefined}>
            <CardContent className="flex flex-col gap-4">
              {snapshot.callToAction ? (
                <div className="space-y-1">
                  <h2 className="font-heading text-base font-medium">{snapshot.callToAction.heading}</h2>
                  <p className="text-sm text-pretty">{snapshot.callToAction.body}</p>
                </div>
              ) : null}

              {branding.senderName || branding.contactEmail || branding.contactPhone || branding.companyWebsite ? (
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  {branding.senderName ? (
                    <p className="text-sm font-medium">
                      {branding.senderName}
                      {branding.senderTitle ? (
                        <span data-report-muted className="font-normal text-muted-foreground">
                          {" · "}
                          {branding.senderTitle}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    {branding.contactEmail ? (
                      <li>
                        <a href={`mailto:${branding.contactEmail}`} className="inline-flex items-center gap-1.5 underline underline-offset-4">
                          <Mail className="size-3.5" aria-hidden />
                          {branding.contactEmail}
                        </a>
                      </li>
                    ) : null}
                    {branding.contactPhone ? (
                      <li>
                        <a href={`tel:${branding.contactPhone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 underline underline-offset-4">
                          <Phone className="size-3.5" aria-hidden />
                          {branding.contactPhone}
                        </a>
                      </li>
                    ) : null}
                    {branding.companyWebsite ? (
                      <li>
                        <a
                          href={branding.companyWebsite}
                          target="_blank"
                          rel="noreferrer nofollow"
                          className="inline-flex items-center gap-1.5 underline underline-offset-4"
                        >
                          <Globe className="size-3.5" aria-hidden />
                          {branding.companyWebsite.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* Attribution + disclaimer ---------------------------------------------- */}
      <footer data-report-section className="flex flex-col gap-3 border-t border-border pt-5">
        <div className="space-y-1">
          <p data-report-muted className="text-xs font-medium text-muted-foreground">
            {t("public.attributionTitle")}
          </p>
          <p data-report-muted className="text-xs text-muted-foreground">
            {snapshot.attribution.text}
          </p>
          {snapshot.attribution.provider === "google_places" ? <GoogleAttribution variant="full" /> : null}
        </div>
        <div className="space-y-1">
          <p data-report-muted className="text-xs font-medium text-muted-foreground">
            {t("public.disclaimerTitle")}
          </p>
          <p data-report-muted className="text-xs text-pretty text-muted-foreground">
            {snapshot.disclaimer}
          </p>
        </div>
      </footer>
    </article>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p data-report-muted className="text-xs text-muted-foreground">
        {label}
      </p>
      <div className="text-sm">{value}</div>
    </div>
  );
}
