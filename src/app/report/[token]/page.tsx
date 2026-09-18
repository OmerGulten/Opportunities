import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { I18nProvider } from "@/lib/i18n/client";
import { PublicReport, normalizeBranding } from "@/features/reports/components/public-report";
import { ReportNotice } from "@/features/reports/components/report-notice";
import { ReportPrintStyles } from "@/features/reports/components/report-print-styles";
import { getPublicReport } from "@/features/reports/public";
import type { ReportSnapshot } from "@/features/reports/types";
import { getRequestLocale } from "@/lib/auth/context";
import { dictionaries, getT } from "@/lib/i18n";
import { logger } from "@/lib/logging";

/** The token is the authorisation, so the page must never be cached or prerendered. */
export const dynamic = "force-dynamic";

/**
 * Deduplicates the lookup between `generateMetadata` and the page within one
 * request. Without it the report's view counter would tick twice per visit.
 */
const loadReport = cache((token: string) => getPublicReport(token));

interface RouteParams {
  token: string;
}

/**
 * The snapshot is JSON read back from the database, so its shape is checked
 * before it is rendered: a snapshot we cannot render is reported as such rather
 * than crashing the page or, worse, rendering half a report.
 */
function isRenderableSnapshot(snapshot: ReportSnapshot | null | undefined): snapshot is ReportSnapshot {
  return Boolean(
    snapshot &&
      typeof snapshot === "object" &&
      (snapshot.locale === "tr" || snapshot.locale === "en") &&
      typeof snapshot.generatedAt === "string" &&
      snapshot.business &&
      snapshot.summary &&
      snapshot.attribution &&
      typeof snapshot.disclaimer === "string",
  );
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { token } = await params;
  const lookup = await loadReport(token);
  const snapshotLocale = lookup.status === "ok" && isRenderableSnapshot(lookup.report.snapshot) ? lookup.report.snapshot.locale : null;
  const locale = snapshotLocale ?? (await getRequestLocale());
  const t = getT(locale, "reports");

  // Title only: a link preview must never carry findings, scores or gaps.
  const title = lookup.status === "ok" ? lookup.report.title : t("public.documentTitle");

  return {
    // Absolute: a report sent to a prospect is the sender's document, so the
    // product name stays out of the tab and the link preview.
    title: { absolute: title },
    description: t("public.metaDescription"),
    robots: { index: false, follow: false, nocache: true },
    openGraph: { title, description: t("public.metaDescription"), type: "article" },
    twitter: { card: "summary", title, description: t("public.metaDescription") },
  };
}

export default async function PublicReportPage({ params }: { params: Promise<RouteParams> }) {
  const { token } = await params;
  const lookup = await loadReport(token);

  if (lookup.status === "not_found") notFound();

  if (lookup.status === "revoked" || lookup.status === "expired") {
    const locale = await getRequestLocale();
    const t = getT(locale, "reports");
    return <ReportNotice title={t("public.states.inactiveTitle")} description={t("public.states.inactiveDescription")} />;
  }

  const { snapshot, branding, title } = lookup.report;

  // Read before the narrowing guard: inside the failure branch the declared
  // type is already `never`, even though the value at runtime may be anything.
  const snapshotVersion = (snapshot as Partial<ReportSnapshot> | null | undefined)?.version ?? null;

  if (!isRenderableSnapshot(snapshot)) {
    logger.error("public_report_snapshot_unrenderable", { version: snapshotVersion });
    const locale = await getRequestLocale();
    const t = getT(locale, "reports");
    return <ReportNotice title={t("public.states.errorTitle")} description={t("public.states.errorDescription")} />;
  }

  return (
    // The snapshot is frozen in the locale it was created in, so the shared
    // client components have to speak that language too, not the viewer's cookie.
    <I18nProvider locale={snapshot.locale} dictionaries={dictionaries}>
      <ReportPrintStyles />
      <PublicReport snapshot={snapshot} branding={normalizeBranding(branding)} title={title} />
    </I18nProvider>
  );
}
