import { AlarmClock } from "lucide-react";
import Link from "next/link";

import { EmptyState, ScoreBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";

export interface DueFollowUpItem {
  leadId: string;
  businessName: string;
  location: string | null;
  overallScore: number | null;
  /** Pre-formatted on the server. */
  dueLabel: string | null;
  overdue: boolean;
}

export interface DueFollowUpsProps {
  items: DueFollowUpItem[];
  labels: {
    empty: string;
    emptyHint: string;
    overdue: string;
    open: string;
    reminder: string;
  };
}

/**
 * Reminders that have come due. The list is a to-do for the user: nothing here
 * has been sent, and nothing will be sent automatically.
 */
export function DueFollowUps({ items, labels }: DueFollowUpsProps) {
  if (items.length === 0) {
    return <EmptyState icon={<AlarmClock />} title={labels.empty} description={labels.emptyHint} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.leadId}>
            <Link
              href={`/pipeline/${item.leadId}`}
              aria-label={labels.open}
              className="flex items-center justify-between gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.businessName}</span>
                {item.location ? <span className="block truncate text-xs text-muted-foreground">{item.location}</span> : null}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {item.dueLabel ? (
                  <Badge
                    variant="outline"
                    className={
                      item.overdue
                        ? "border-amber-600/25 bg-amber-500/14 font-normal text-amber-700 dark:border-amber-400/25 dark:text-amber-300"
                        : "font-normal text-muted-foreground"
                    }
                  >
                    {item.overdue ? `${labels.overdue} · ${item.dueLabel}` : item.dueLabel}
                  </Badge>
                ) : null}
                <ScoreBadge score={item.overallScore} size="sm" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{labels.reminder}</p>
    </div>
  );
}
