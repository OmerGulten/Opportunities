"use client";

import { cn } from "cn";

import { useFormatters, useT } from "@/lib/i18n/client";
import type { ScanRow } from "@/types/db";

export type ScanAreaFields = Pick<
  ScanRow,
  "location_method" | "place_label" | "center_lat" | "center_lng" | "radius_m" | "area_km2"
>;

export interface ScanAreaSummaryProps {
  scan: ScanAreaFields;
  className?: string;
}

/** One neutral line describing the scanned area, shared by the list and detail views. */
export function ScanAreaSummary({ scan, className }: ScanAreaSummaryProps) {
  const t = useT("scans");
  const { number } = useFormatters();

  const parts: string[] = [];

  if (scan.location_method === "polygon") {
    parts.push(t("list.areaPolygon"));
    if (typeof scan.area_km2 === "number") {
      parts.push(t("list.areaKm2", { area: number(scan.area_km2, { maximumFractionDigits: 1 }) }));
    }
  } else {
    if (scan.place_label) parts.push(scan.place_label);
    else if (typeof scan.center_lat === "number" && typeof scan.center_lng === "number") {
      parts.push(`${scan.center_lat.toFixed(4)}, ${scan.center_lng.toFixed(4)}`);
    }
    if (typeof scan.radius_m === "number") {
      parts.push(
        scan.radius_m >= 1000
          ? t("list.radiusKm", { radius: number(scan.radius_m / 1000, { maximumFractionDigits: 1 }) })
          : t("list.radiusM", { radius: number(scan.radius_m) }),
      );
    }
  }

  if (parts.length === 0) return null;

  return <span className={cn("text-xs text-muted-foreground", className)}>{parts.join(" · ")}</span>;
}
