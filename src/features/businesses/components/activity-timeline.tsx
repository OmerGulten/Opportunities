import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/common";
import type { LeadActivityRow } from "@/types/db";

import { formatDateTime } from "./summaries";

const ACTIVITY_TYPES = new Set([
  "scan_started",
  "scan_completed",
  "scan_failed",
  "scan_cancelled",
  "business_discovered",
  "audit_completed",
  "audit_refreshed",
  "opportunity_calculated",
  "message_generated",
  "message_edited",
  "message_copied",
  "channel_opened",
  "lead_added",
  "stage_changed",
  "note_added",
  "follow_up_scheduled",
  "follow_up_completed",
  "lead_won",
  "lead_lost",
  "lead_reopened",
  "report_created",
  "report_revoked",
  "business_ignored",
  "business_unignored",
]);

export interface ActivityTimelineProps {
  activities: LeadActivityRow[];
  locale: Locale;
}

/** What happened to this business, newest first. */
export function ActivityTimeline({ activities, locale }: ActivityTimelineProps) {
  const t = getT(locale, "businesses");

  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("detail.activity.empty")}</p>;
  }

  return (
    <ol className="flex flex-col gap-0 border-l border-border pl-4">
      {activities.map((activity) => (
        <li key={activity.id} className="relative py-2">
          <span className="absolute -left-[21px] top-3.5 size-2 rounded-full bg-border" aria-hidden />
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm">{ACTIVITY_TYPES.has(activity.type) ? t(`detail.activity.types.${activity.type}`) : activity.type}</span>
            <span className="text-xs text-muted-foreground">{formatDateTime(activity.created_at, locale)}</span>
          </div>
          {activity.title ? <p className="text-xs text-muted-foreground">{activity.title}</p> : null}
        </li>
      ))}
    </ol>
  );
}
