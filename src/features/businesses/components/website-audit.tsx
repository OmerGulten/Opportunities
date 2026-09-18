import Link from "next/link";
import type { ReactNode } from "react";

import { EvidenceTypeBadge, KeyValueList, ScoreBar, WebsiteStatusBadge, toneBadgeClass, type KeyValueItem } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import type { BusinessDetail } from "@/features/businesses/queries";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/common";
import type { AuditFindingRow } from "@/types/db";
import type { WebsiteStatus } from "@/types/signals";

import { AuditStatusNotice } from "./audit-status";
import { FindingList } from "./finding-list";
import { formatDateTime, formatNumber, latestAudit, performanceSummary, websiteSummary } from "./summaries";
import { BoolValue, TextValue } from "./value-cells";

export interface WebsiteAuditSectionProps {
  detail: BusinessDetail;
  locale: Locale;
}

const WEBSITE_STATUSES: readonly WebsiteStatus[] = ["found", "not_found", "unreachable", "redirected", "invalid", "not_checked"];
const QUALITY_VALUES = new Set(["weak", "average", "strong"]);
const SEO_QUALITY_VALUES = new Set(["good", "weak", "missing"]);
const PERFORMANCE_GRADES = new Set(["poor", "needs_improvement", "good"]);
const GROUP_CATEGORIES = new Set(["technical", "seo", "performance", "ux"]);

function Group({ title, children, findings, locale }: { title: string; children: ReactNode; findings: AuditFindingRow[]; locale: Locale }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
      {findings.length > 0 ? <FindingList findings={findings} locale={locale} /> : null}
    </div>
  );
}

/**
 * The website audit, split into the four groups the engine measures.
 *
 * A group whose summary was never produced says so; it is never rendered as a
 * set of absent features. Performance comes from its own audit and is marked
 * when it was estimated heuristically rather than measured.
 */
export function WebsiteAuditSection({ detail, locale }: WebsiteAuditSectionProps) {
  const t = getT(locale, "businesses");

  const audit = latestAudit(detail.audits, "website");
  const perfAudit = latestAudit(detail.audits, "performance");
  const summary = websiteSummary(audit);
  const perf = performanceSummary(perfAudit);

  if (!audit && !perfAudit) {
    return <p className="text-sm text-muted-foreground">{t("detail.website.noAudit")}</p>;
  }

  const status: WebsiteStatus = WEBSITE_STATUSES.includes(summary?.websiteStatus as WebsiteStatus)
    ? (summary?.websiteStatus as WebsiteStatus)
    : "not_checked";
  const technical = summary?.technical ?? null;
  const seo = summary?.seo ?? null;
  const ux = summary?.ux ?? null;

  const findings = audit?.findings ?? [];
  const byCategory = (category: string) => findings.filter((finding) => finding.category === category);
  const otherFindings = findings.filter((finding) => !GROUP_CATEGORIES.has(finding.category));
  const perfFindings = [...byCategory("performance"), ...(perfAudit?.findings ?? [])];

  const notChecked = <p className="text-sm text-muted-foreground">{t("detail.website.notChecked")}</p>;

  const technicalItems: KeyValueItem[] = technical
    ? [
        { key: "https", label: t("detail.website.technical.https"), value: <BoolValue value={technical.https ?? null} /> },
        { key: "status", label: t("detail.website.technical.statusCode"), value: <TextValue value={technical.statusCode ?? null} /> },
        {
          key: "responseTime",
          label: t("detail.website.technical.responseTime"),
          value: <TextValue value={formatNumber(technical.responseTimeMs ?? null, locale)} suffix="ms" />,
        },
        {
          key: "redirects",
          label: t("detail.website.technical.redirects"),
          value: <TextValue value={technical.redirectChain ? technical.redirectChain.length : null} />,
        },
        {
          key: "canonical",
          label: t("detail.website.technical.canonical"),
          value: <BoolValue value={technical.hasCanonical ?? null} />,
          hint: technical.canonicalUrl ?? undefined,
        },
        { key: "robots", label: t("detail.website.technical.robots"), value: <BoolValue value={technical.hasRobotsTxt ?? null} /> },
        { key: "sitemap", label: t("detail.website.technical.sitemap"), value: <BoolValue value={technical.hasSitemap ?? null} /> },
        { key: "viewport", label: t("detail.website.technical.viewport"), value: <BoolValue value={technical.hasViewport ?? null} /> },
        { key: "favicon", label: t("detail.website.technical.favicon"), value: <BoolValue value={technical.hasFavicon ?? null} /> },
        { key: "og", label: t("detail.website.technical.openGraph"), value: <BoolValue value={technical.hasOpenGraph ?? null} /> },
        {
          key: "schema",
          label: t("detail.website.technical.schema"),
          value: <BoolValue value={technical.hasSchemaOrg ?? null} />,
          hint: technical.schemaTypes && technical.schemaTypes.length > 0 ? technical.schemaTypes.join(", ") : undefined,
        },
        { key: "language", label: t("detail.website.technical.language"), value: <TextValue value={technical.languageDeclared ?? null} /> },
        { key: "images", label: t("detail.website.technical.images"), value: <TextValue value={formatNumber(technical.imageCount ?? null, locale)} /> },
        {
          key: "alt",
          label: t("detail.website.technical.imagesWithAlt"),
          value: <TextValue value={formatNumber(technical.imagesWithAlt ?? null, locale)} />,
        },
        {
          key: "broken",
          label: t("detail.website.technical.brokenLinks"),
          // "found / checked" keeps the number honest: 0 of 0 links checked is not a clean result.
          value: (
            <TextValue
              value={
                technical.brokenLinksFound === null || technical.brokenLinksFound === undefined
                  ? null
                  : `${formatNumber(technical.brokenLinksFound, locale)} / ${formatNumber(technical.brokenLinksChecked ?? 0, locale)}`
              }
            />
          ),
        },
        {
          key: "mobile",
          label: t("detail.website.technical.mobileFriendly"),
          value: (
            <span className="flex flex-wrap items-center gap-2">
              <BoolValue value={technical.mobileFriendlyHeuristic ?? null} />
              <EvidenceTypeBadge evidenceType="heuristic" />
            </span>
          ),
        },
      ]
    : [];

  const seoItems: KeyValueItem[] = seo
    ? [
        {
          key: "title",
          label: t("detail.website.seo.title"),
          value: (
            <span className="flex flex-wrap items-center gap-2">
              <TextValue value={seo.title ?? null} />
              {seo.titleQuality && SEO_QUALITY_VALUES.has(seo.titleQuality) ? (
                <Badge variant="outline" className={seo.titleQuality === "good" ? toneBadgeClass.positive : toneBadgeClass.attention}>
                  {t(`detail.website.seo.quality.${seo.titleQuality}`)}
                </Badge>
              ) : null}
            </span>
          ),
          hint: `${t("detail.website.seo.titleLength")}: ${formatNumber(seo.titleLength ?? null, locale) ?? "–"}`,
        },
        {
          key: "description",
          label: t("detail.website.seo.description"),
          value: (
            <span className="flex flex-wrap items-center gap-2">
              <TextValue value={seo.metaDescription ?? null} />
              {seo.descriptionQuality && SEO_QUALITY_VALUES.has(seo.descriptionQuality) ? (
                <Badge variant="outline" className={seo.descriptionQuality === "good" ? toneBadgeClass.positive : toneBadgeClass.attention}>
                  {t(`detail.website.seo.quality.${seo.descriptionQuality}`)}
                </Badge>
              ) : null}
            </span>
          ),
          hint: `${t("detail.website.seo.descriptionLength")}: ${formatNumber(seo.metaDescriptionLength ?? null, locale) ?? "–"}`,
        },
        { key: "h1", label: t("detail.website.seo.h1"), value: <TextValue value={formatNumber(seo.h1Count ?? null, locale)} /> },
        { key: "h2", label: t("detail.website.seo.h2"), value: <TextValue value={formatNumber(seo.h2Count ?? null, locale)} /> },
        { key: "structure", label: t("detail.website.seo.headingStructure"), value: <BoolValue value={seo.headingStructureOk ?? null} /> },
        { key: "indexable", label: t("detail.website.seo.indexable"), value: <BoolValue value={seo.indexable ?? null} /> },
        { key: "words", label: t("detail.website.seo.wordCount"), value: <TextValue value={formatNumber(seo.wordCount ?? null, locale)} /> },
      ]
    : [];

  const uxItems: KeyValueItem[] = ux
    ? [
        { key: "cta", label: t("detail.website.ux.cta"), value: <BoolValue value={ux.hasVisibleCta ?? null} /> },
        { key: "contact", label: t("detail.website.ux.contactInfo"), value: <BoolValue value={ux.hasContactInfo ?? null} /> },
        { key: "phone", label: t("detail.website.ux.phone"), value: <BoolValue value={ux.hasPhone ?? null} /> },
        { key: "email", label: t("detail.website.ux.email"), value: <BoolValue value={ux.hasEmail ?? null} /> },
        { key: "address", label: t("detail.website.ux.address"), value: <BoolValue value={ux.hasAddress ?? null} /> },
        { key: "hours", label: t("detail.website.ux.hours"), value: <BoolValue value={ux.hasOpeningHours ?? null} /> },
        {
          key: "booking",
          label: t("detail.website.ux.booking"),
          value: <BoolValue value={ux.hasBooking ?? ux.hasReservation ?? null} />,
        },
        { key: "menu", label: t("detail.website.ux.menu"), value: <BoolValue value={ux.hasMenu ?? null} /> },
        { key: "whatsapp", label: t("detail.website.ux.whatsapp"), value: <BoolValue value={ux.hasWhatsApp ?? null} /> },
        {
          key: "social",
          label: t("detail.website.ux.socialLinks"),
          value:
            ux.socialLinks && ux.socialLinks.length > 0 ? (
              <span className="flex flex-wrap gap-1.5">
                {ux.socialLinks.map((link, index) => (
                  <Badge key={`${link?.platform ?? "link"}-${index}`} variant="outline" className="font-normal">
                    {link?.platform ?? "–"}
                  </Badge>
                ))}
              </span>
            ) : (
              <BoolValue value={ux.socialLinks ? false : null} />
            ),
        },
      ]
    : [];

  const perfItems: KeyValueItem[] = perf
    ? [
        { key: "mobile", label: t("detail.website.performance.mobileScore"), value: <TextValue value={formatNumber(perf.mobileScore ?? null, locale)} /> },
        { key: "desktop", label: t("detail.website.performance.desktopScore"), value: <TextValue value={formatNumber(perf.desktopScore ?? null, locale)} /> },
        { key: "lcp", label: t("detail.website.performance.lcp"), value: <TextValue value={formatNumber(perf.lcpMs ?? null, locale)} suffix="ms" /> },
        {
          key: "cls",
          label: t("detail.website.performance.cls"),
          value: <TextValue value={formatNumber(perf.cls ?? null, locale, { maximumFractionDigits: 2 })} />,
        },
        { key: "inp", label: t("detail.website.performance.inp"), value: <TextValue value={formatNumber(perf.inpMs ?? null, locale)} suffix="ms" /> },
        {
          key: "grade",
          label: t("detail.website.performance.grade"),
          value:
            perf.mobileGrade && PERFORMANCE_GRADES.has(perf.mobileGrade) ? (
              <Badge
                variant="outline"
                className={
                  perf.mobileGrade === "good"
                    ? toneBadgeClass.positive
                    : perf.mobileGrade === "needs_improvement"
                      ? toneBadgeClass.attention
                      : toneBadgeClass.negative
                }
              >
                {t(`detail.website.performance.grades.${perf.mobileGrade}`)}
              </Badge>
            ) : (
              <TextValue value={null} />
            ),
        },
        {
          key: "measured",
          label: t("detail.website.performance.measuredAt"),
          value: <TextValue value={formatDateTime(perf.measuredAt ?? null, locale)} />,
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <AuditStatusNotice audit={audit} locale={locale} />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t("detail.website.status")}</span>
          <WebsiteStatusBadge status={status} />
          {summary?.quality && QUALITY_VALUES.has(summary.quality) ? (
            <Badge variant="outline" className={summary.quality === "weak" ? toneBadgeClass.attention : toneBadgeClass.positive}>
              {t("detail.website.quality")}: {t(`detail.website.qualityValue.${summary.quality}`)}
            </Badge>
          ) : null}
        </div>

        {summary?.qualityScore !== null && summary?.qualityScore !== undefined ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("detail.website.qualityScore")}</span>
            <ScoreBar score={summary.qualityScore} />
          </div>
        ) : null}

        <KeyValueList
          items={[
            { key: "input", label: t("detail.website.inputUrl"), value: <TextValue value={summary?.inputUrl ?? null} /> },
            {
              key: "final",
              label: t("detail.website.finalUrl"),
              value: technical?.finalUrl ? (
                <Link href={technical.finalUrl} target="_blank" rel="noreferrer noopener" className="text-sm break-all hover:underline">
                  {technical.finalUrl}
                </Link>
              ) : (
                <TextValue value={null} />
              ),
            },
          ]}
        />

        {status !== "found" && status !== "redirected" ? (
          <p className="text-sm text-muted-foreground">{t("detail.website.notFoundNotice")}</p>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Group title={t("detail.website.groups.technical")} findings={byCategory("technical")} locale={locale}>
          {technical ? <KeyValueList items={technicalItems} /> : notChecked}
        </Group>

        <Group title={t("detail.website.groups.seo")} findings={byCategory("seo")} locale={locale}>
          {seo ? <KeyValueList items={seoItems} /> : notChecked}
        </Group>

        <Group title={t("detail.website.groups.performance")} findings={perfFindings} locale={locale}>
          {perf ? (
            <div className="flex flex-col gap-2">
              <KeyValueList items={perfItems} />
              {perf.isHeuristic ? (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <EvidenceTypeBadge evidenceType="heuristic" />
                  {t("detail.website.performance.heuristic")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("detail.website.performance.noAudit")}</p>
          )}
        </Group>

        <Group title={t("detail.website.groups.ux")} findings={byCategory("ux")} locale={locale}>
          {ux ? <KeyValueList items={uxItems} /> : notChecked}
        </Group>
      </div>

      {otherFindings.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("detail.findings.title")}</h3>
          <FindingList findings={otherFindings} locale={locale} />
        </div>
      ) : null}
    </div>
  );
}
