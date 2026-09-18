import { PenLine } from "lucide-react";
import Link from "next/link";

import { CopyButton, toneBadgeClass } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BusinessDetail } from "@/features/businesses/queries";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/common";

import { formatDateTime } from "./summaries";

const CHANNELS = new Set(["whatsapp", "email", "instagram_dm"]);
const MESSAGE_STATUSES = new Set(["draft", "edited", "copied", "channel_opened", "sent_manually", "archived"]);

export interface OutreachSectionProps {
  detail: BusinessDetail;
  locale: Locale;
}

/**
 * Prepared outreach drafts. Nothing is sent from here: the user copies the text
 * and opens the channel themselves.
 */
export function OutreachSection({ detail, locale }: OutreachSectionProps) {
  const t = getT(locale, "businesses");
  const tc = getT(locale, "common");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("detail.outreach.manualNotice")}</p>
        <Button size="sm" render={<Link href={`/messages/new?businessId=${detail.business.id}`} />}>
          <PenLine />
          {t("detail.outreach.write")}
        </Button>
      </div>

      {detail.messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("detail.outreach.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {detail.messages.map((message) => (
            <li key={message.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {CHANNELS.has(message.channel) ? tc(`channel.${message.channel}`) : message.channel}
                </Badge>
                <Badge variant="outline" className={message.status === "draft" ? toneBadgeClass.neutral : toneBadgeClass.info}>
                  {MESSAGE_STATUSES.has(message.status) ? t(`detail.outreach.statusValue.${message.status}`) : message.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {t("detail.outreach.created")}: {formatDateTime(message.created_at, locale)}
                </span>
                <CopyButton value={message.body} withLabel className="ml-auto" />
              </div>

              <p className="text-sm font-medium">
                {message.subject ? message.subject : <span className="text-muted-foreground">{t("detail.outreach.noSubject")}</span>}
              </p>
              <p className="line-clamp-4 text-sm whitespace-pre-wrap text-muted-foreground">{message.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
