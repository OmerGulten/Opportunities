import Link from "next/link";

import { KeyValueList, StatusBadge, type KeyValueItem } from "@/components/shared";
import type { BusinessDetail } from "@/features/businesses/queries";
import { getT } from "@/lib/i18n";
import type { Locale, ObservationStatus } from "@/types/common";

import { AuditStatusNotice } from "./audit-status";
import { FindingList } from "./finding-list";
import { formatDate, formatNumber, instagramSummary, latestAudit } from "./summaries";
import { BoolValue, TextValue } from "./value-cells";

const OBSERVATION_STATUSES = new Set(["found", "not_found", "not_checked", "unavailable", "error", "ambiguous"]);
const DISCOVERY_SOURCES = new Set(["website", "provider", "manual"]);

export interface InstagramSectionProps {
  detail: BusinessDetail;
  locale: Locale;
}

/**
 * Instagram observations.
 *
 * The audit is deliberately conservative: only public signals are recorded, and
 * anything it could not establish stays "not checked".
 */
export function InstagramSection({ detail, locale }: InstagramSectionProps) {
  const t = getT(locale, "businesses");
  const audit = latestAudit(detail.audits, "instagram");
  const summary = instagramSummary(audit);

  if (!audit) {
    return <p className="text-sm text-muted-foreground">{t("detail.instagram.noAudit")}</p>;
  }

  const status = (summary?.status && OBSERVATION_STATUSES.has(summary.status) ? summary.status : "not_checked") as ObservationStatus;
  const notes = (summary?.notes ?? []).filter((note): note is string => typeof note === "string");

  const items: KeyValueItem[] = [
    {
      key: "profile",
      label: t("detail.instagram.profile"),
      value: summary?.profileUrl ? (
        <Link href={summary.profileUrl} target="_blank" rel="noreferrer noopener" className="text-sm break-all hover:underline">
          {summary.profileUrl}
        </Link>
      ) : (
        <TextValue value={null} />
      ),
    },
    { key: "handle", label: t("detail.instagram.handle"), value: <TextValue value={summary?.handle ?? null} /> },
    {
      key: "discovered",
      label: t("detail.instagram.discoveredVia"),
      value: (
        <TextValue
          value={summary?.discoveredVia && DISCOVERY_SOURCES.has(summary.discoveredVia) ? t(`detail.instagram.discovery.${summary.discoveredVia}`) : null}
        />
      ),
    },
    { key: "lastActivity", label: t("detail.instagram.lastActivity"), value: <TextValue value={formatDate(summary?.lastActivitySignal ?? null, locale)} /> },
    {
      key: "days",
      label: t("detail.instagram.daysSinceLastPost"),
      value: <TextValue value={formatNumber(summary?.daysSinceLastPost ?? null, locale)} />,
    },
    {
      key: "active",
      label: t("detail.instagram.active"),
      value: <BoolValue value={summary?.isActive ?? null} />,
      hint: summary?.isActive === true ? t("detail.instagram.activeYes") : summary?.isActive === false ? t("detail.instagram.activeNo") : undefined,
    },
    { key: "followers", label: t("detail.instagram.followers"), value: <TextValue value={formatNumber(summary?.followerCount ?? null, locale)} /> },
    { key: "bio", label: t("detail.instagram.bioComplete"), value: <BoolValue value={summary?.bioComplete ?? null} /> },
    { key: "websiteLink", label: t("detail.instagram.websiteLink"), value: <BoolValue value={summary?.hasWebsiteLink ?? null} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AuditStatusNotice audit={audit} locale={locale} />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t("detail.instagram.status")}</span>
          <StatusBadge status={status} />
        </div>

        <KeyValueList items={items} />

        {notes.length > 0 ? (
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("detail.instagram.notes")}</span>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
              {notes.map((note, index) => (
                <li key={`${note}-${index}`}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">{t("detail.instagram.conservativeNotice")}</p>
      </div>

      <FindingList findings={audit.findings} locale={locale} />
    </div>
  );
}
