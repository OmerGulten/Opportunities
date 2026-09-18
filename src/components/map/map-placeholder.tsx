"use client";

import { cn } from "cn";
import { MapPinOff } from "lucide-react";
import type { ReactNode } from "react";

import { KeyValueList } from "@/components/shared";
import { useT } from "@/lib/i18n/client";

export interface MapPlaceholderItem {
  key: string;
  label: string;
  value: ReactNode;
}

export interface MapPlaceholderProps {
  /** The area in text: centre, radius, vertices, cell count… */
  items?: MapPlaceholderItem[];
  /** Replaces the default explanation (for example "no area chosen yet"). */
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * Rendered instead of a Google map when `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
 * is absent. It is not a disabled state: the same information the map would
 * carry is printed as text so the surrounding flow keeps working.
 */
export function MapPlaceholder({ items = [], description, className, children }: MapPlaceholderProps) {
  const t = useT("scans");

  return (
    <div
      className={cn(
        "flex min-h-56 w-full flex-col gap-3 overflow-y-auto rounded-xl border border-dashed border-border bg-muted/30 p-4",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
          <MapPinOff className="size-4" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{t("map.unavailableTitle")}</p>
          <p className="text-xs text-muted-foreground">{description ?? t("map.unavailableDescription")}</p>
        </div>
      </div>
      {items.length > 0 ? <KeyValueList items={items} className="text-xs" /> : null}
      {children}
    </div>
  );
}
