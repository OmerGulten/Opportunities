import { Kanban } from "lucide-react";
import Link from "next/link";

import { KeyValueList, toneBadgeClass, type KeyValueItem } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BusinessDetail } from "@/features/businesses/queries";
import { getT } from "@/lib/i18n";
import type { Locale } from "@/types/common";

import { formatDate, formatMoney } from "./summaries";
import { TextValue } from "./value-cells";

const LEAD_STATUSES = new Set(["open", "won", "lost", "archived"]);

export interface PipelineCardProps {
  detail: BusinessDetail;
  locale: Locale;
}

/** Where this business stands in the sales pipeline, if it was added. */
export function PipelineCard({ detail, locale }: PipelineCardProps) {
  const t = getT(locale, "businesses");
  const lead = detail.lead;

  if (!lead) {
    return <p className="text-sm text-muted-foreground">{t("detail.pipeline.notInPipeline")}</p>;
  }

  const statusTone = lead.status === "won" ? toneBadgeClass.positive : lead.status === "lost" ? toneBadgeClass.negative : toneBadgeClass.info;

  const items: KeyValueItem[] = [
    {
      key: "stage",
      label: t("detail.pipeline.stage"),
      value: lead.stage ? (
        <Badge variant="outline" className="font-normal">
          {lead.stage.name}
        </Badge>
      ) : (
        <TextValue value={null} />
      ),
    },
    {
      key: "status",
      label: t("detail.pipeline.status"),
      value: (
        <Badge variant="outline" className={statusTone}>
          {LEAD_STATUSES.has(lead.status) ? t(`detail.pipeline.statusValue.${lead.status}`) : lead.status}
        </Badge>
      ),
    },
    {
      key: "estimated",
      label: t("detail.pipeline.estimatedValue"),
      value: <TextValue value={formatMoney(lead.estimated_value, lead.currency, locale)} />,
    },
    {
      key: "won",
      label: t("detail.pipeline.wonValue"),
      value: <TextValue value={formatMoney(lead.won_value, lead.currency, locale)} />,
    },
    { key: "followUp", label: t("detail.pipeline.nextFollowUp"), value: <TextValue value={formatDate(lead.next_follow_up_at, locale)} /> },
    { key: "contacted", label: t("detail.pipeline.lastContacted"), value: <TextValue value={formatDate(lead.last_contacted_at, locale)} /> },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <KeyValueList items={items} />
      <div className="flex justify-end">
        <Button variant="outline" size="sm" render={<Link href="/pipeline" />}>
          <Kanban />
          {t("detail.pipeline.open")}
        </Button>
      </div>
    </div>
  );
}
