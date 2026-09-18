import type { Metadata } from "next";

import { InlineAlert, PageHeader } from "@/components/shared";
import { listFailedJobsQuerySchema } from "@/features/admin/schemas";
import { listFailedJobs } from "@/features/admin/service";
import { FailedJobsTable, type AdminFailedJobItem } from "@/features/admin/components/failed-jobs-table";
import { getRequestLocale, requirePlatformAdmin } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { describeFailedJobs, isPlatformDataAvailable } from "../_data";

export const metadata: Metadata = { title: "Failed jobs" };

const LIMIT = 50;

interface PageSearchParams {
  scan?: string | string[];
}

export default async function AdminFailedJobsPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const ctx = await requirePlatformAdmin();
  const locale = await getRequestLocale();
  const t = getT(locale, "admin");

  if (!isPlatformDataAvailable()) {
    return (
      <>
        <PageHeader title={t("jobs.title")} description={t("jobs.description")} />
        <InlineAlert tone="neutral" title={t("common.notConfiguredTitle")}>
          {t("common.notConfigured")}
        </InlineAlert>
      </>
    );
  }

  const params = await searchParams;
  const rawScan = (Array.isArray(params.scan) ? params.scan[0] : params.scan)?.trim() ?? "";

  // A malformed id in the URL must not 500 the page: it is reported and ignored.
  const parsed = listFailedJobsQuerySchema.safeParse({ limit: LIMIT, ...(rawScan === "" ? {} : { scanId: rawScan }) });
  const invalidScanId = rawScan !== "" && !parsed.success;
  const query = parsed.success ? parsed.data : listFailedJobsQuerySchema.parse({ limit: LIMIT });

  const jobs = await listFailedJobs(ctx, query);
  const described = await describeFailedJobs(jobs);

  const items: AdminFailedJobItem[] = described.map(({ job, scanName }) => ({
    id: job.id,
    scanId: job.scan_id,
    scanName,
    jobType: job.job_type,
    attempt: job.attempt,
    maxAttempts: job.max_attempts,
    errorCode: job.error_code,
    errorMessage: job.error_message,
    updatedAt: job.updated_at,
  }));

  return (
    <>
      <PageHeader title={t("jobs.title")} description={t("jobs.description")} />
      {invalidScanId ? <InlineAlert tone="attention">{t("jobs.invalidScanId")}</InlineAlert> : null}
      <FailedJobsTable items={items} scanId={invalidScanId ? "" : rawScan} limit={LIMIT} />
    </>
  );
}
