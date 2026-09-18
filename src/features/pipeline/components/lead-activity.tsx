import {
  ArrowRightLeft,
  CircleCheck,
  CircleX,
  FileSearch,
  MessageSquare,
  Radar,
  Sparkles,
  StickyNote,
  Timer,
  UserPlus,
} from "lucide-react";
import type { ComponentType } from "react";

export interface LeadActivityItem {
  id: string;
  type: string;
  /** Localized label for the event type. */
  label: string;
  /** Optional localized detail line (for example the stage move). */
  detail: string | null;
  /** Pre-formatted on the server. */
  dateLabel: string | null;
}

type IconComponent = ComponentType<{ className?: string }>;

const icons: Record<string, IconComponent> = {
  lead_added: UserPlus,
  stage_changed: ArrowRightLeft,
  note_added: StickyNote,
  follow_up_scheduled: Timer,
  follow_up_completed: Timer,
  lead_won: CircleCheck,
  lead_lost: CircleX,
  lead_reopened: ArrowRightLeft,
  message_generated: Sparkles,
  message_edited: MessageSquare,
  message_copied: MessageSquare,
  channel_opened: MessageSquare,
  audit_completed: FileSearch,
  audit_refreshed: FileSearch,
  opportunity_calculated: Sparkles,
  scan_started: Radar,
  scan_completed: Radar,
};

const tones: Record<string, string> = {
  lead_won: "text-emerald-600 dark:text-emerald-400",
  lead_lost: "text-rose-600 dark:text-rose-400",
  follow_up_scheduled: "text-amber-600 dark:text-amber-400",
};

/** Read-only timeline of what happened on this lead, newest first. */
export function LeadActivity({ items, emptyLabel }: { items: LeadActivityItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
      {items.map((item) => {
        const Icon = icons[item.type] ?? Sparkles;
        return (
          <li key={item.id} className="relative">
            <span
              className={`absolute top-0.5 -left-[1.9rem] flex size-6 items-center justify-center rounded-full bg-card ring-1 ring-foreground/10 ${tones[item.type] ?? "text-muted-foreground"}`}
              aria-hidden
            >
              <Icon className="size-3.5" />
            </span>
            <p className="text-sm font-medium">{item.label}</p>
            {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
            {item.dateLabel ? <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{item.dateLabel}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
