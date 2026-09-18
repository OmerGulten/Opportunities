"use client";

import { cn } from "cn";
import { CircleAlert, CircleDot, Info, TriangleAlert } from "lucide-react";
import type { ComponentType } from "react";

import { EmptyState } from "@/components/shared";
import { useFormatters, useT } from "@/lib/i18n/client";
import type { ScanJobEventRow } from "@/types/db";

type Level = ScanJobEventRow["level"];

const levelIcon: Record<Level, ComponentType<{ className?: string }>> = {
  debug: CircleDot,
  info: Info,
  warn: TriangleAlert,
  error: CircleAlert,
};

const levelClass: Record<Level, string> = {
  debug: "text-muted-foreground",
  info: "text-sky-600 dark:text-sky-400",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-rose-600 dark:text-rose-400",
};

export interface ScanEventsProps {
  events: ScanJobEventRow[];
  className?: string;
}

/**
 * Recent workflow events for a scan.
 *
 * Event types are translated when the namespace knows them; anything new is
 * shown with its raw type instead of a guessed description. The step's own
 * message is rendered as secondary text, exactly as it was recorded.
 */
export function ScanEvents({ events, className }: ScanEventsProps) {
  const t = useT("scans");
  const { dateTime } = useFormatters();

  if (events.length === 0) {
    return <EmptyState title={t("detail.eventsEmptyTitle")} description={t("detail.eventsEmptyBody")} />;
  }

  return (
    <ol className={cn("flex flex-col", className)}>
      {events.map((event) => {
        const Icon = levelIcon[event.level];
        const key = `events.${event.event_type}`;
        const label = t(key);

        return (
          <li key={event.id} className="flex gap-3 border-b border-border/60 py-2.5 last:border-b-0">
            <Icon className={cn("mt-0.5 size-4 shrink-0", levelClass[event.level])} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={cn("text-sm", label === key && "font-mono text-xs")}>{label === key ? event.event_type : label}</span>
                <time dateTime={event.created_at} className="text-xs text-muted-foreground tabular-nums">
                  {dateTime(event.created_at)}
                </time>
              </div>
              {event.message ? <p className="text-xs break-words text-muted-foreground">{event.message}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
