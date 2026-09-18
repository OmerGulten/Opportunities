"use client";

import { Circle, Polygon } from "@vis.gl/react-google-maps";
import Link from "next/link";
import { useState } from "react";

import {
  BusinessMarkers,
  MAP_COLORS,
  MapCanvas,
  MapPlaceholder,
  formatLatLng,
  ringOf,
  zoomForRadius,
  type BusinessMarkerItem,
  type MapPlaceholderItem,
} from "@/components/map";
import { GoogleAttribution, NotExhaustiveNotice } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useFormatters, useT } from "@/lib/i18n/client";
import type { GeoPoint, GeoPolygon, LocationMethod } from "@/types/common";

export interface CoverageCellView {
  index: number;
  center: GeoPoint;
  radiusM: number;
}

export interface ScanCoverageMapProps {
  locationMethod: LocationMethod;
  center: GeoPoint | null;
  radiusM: number | null;
  polygon: GeoPolygon | null;
  cells: CoverageCellView[];
  businesses: BusinessMarkerItem[];
}

/**
 * The planned area: the requested shape, the provider search cells it was split
 * into, and the businesses discovered inside it.
 */
export function ScanCoverageMap({ locationMethod, center, radiusM, polygon, cells, businesses }: ScanCoverageMapProps) {
  const t = useT("scans");
  const tc = useT("common");
  const { number } = useFormatters();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const vertices = ringOf(polygon);
  const cameraCenter = center ?? cells[0]?.center ?? vertices[0] ?? null;
  const selected = businesses.find((business) => business.id === selectedId) ?? null;

  const placeholderItems: MapPlaceholderItem[] = [
    { key: "method", label: t("wizard.location.method"), value: t(`wizard.location.methods.${locationMethod}.label`) },
    ...(center ? [{ key: "center", label: t("wizard.location.center"), value: formatLatLng(center) }] : []),
    ...(radiusM ? [{ key: "radius", label: t("wizard.location.radius"), value: `${number(radiusM)} ${tc("units.m")}` }] : []),
    ...(vertices.length > 0 ? [{ key: "vertices", label: t("wizard.location.vertices"), value: number(vertices.length) }] : []),
    { key: "cells", label: t("detail.cells"), value: number(cells.length) },
    { key: "businesses", label: t("counters.discovered"), value: number(businesses.length) },
  ];

  // Nothing to centre on: show the recorded figures rather than an empty map.
  if (!cameraCenter) {
    return <MapPlaceholder items={placeholderItems} description={t("detail.noArea")} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <MapCanvas
        center={cameraCenter}
        zoom={zoomForRadius(radiusM ?? 4000)}
        className="h-96"
        label={t("detail.mapLabel")}
        placeholderItems={placeholderItems}
      >
        {polygon ? (
          <Polygon
            paths={vertices}
            clickable={false}
            strokeColor={MAP_COLORS.accentStroke}
            strokeOpacity={0.9}
            strokeWeight={2}
            fillColor={MAP_COLORS.accentFill}
            fillOpacity={0.08}
          />
        ) : null}

        {center && radiusM ? (
          <Circle
            center={center}
            radius={radiusM}
            clickable={false}
            strokeColor={MAP_COLORS.accentStroke}
            strokeOpacity={0.9}
            strokeWeight={2}
            fillColor={MAP_COLORS.accentFill}
            fillOpacity={0.06}
          />
        ) : null}

        {cells.map((cell) => (
          <Circle
            key={cell.index}
            center={cell.center}
            radius={cell.radiusM}
            clickable={false}
            strokeColor={MAP_COLORS.cellStroke}
            strokeOpacity={0.5}
            strokeWeight={1}
            fillColor={MAP_COLORS.cellFill}
            fillOpacity={0.05}
          />
        ))}

        <BusinessMarkers items={businesses} selectedId={selectedId} onSelect={setSelectedId} />
      </MapCanvas>

      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{formatLatLng(selected.location)}</p>
          </div>
          <Button size="sm" variant="outline" render={<Link href={`/businesses/${selected.id}`} />}>
            {t("detail.openBusiness")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t("detail.cellsAndBusinesses", { cells: number(cells.length), businesses: number(businesses.length) })}
        </p>
        <GoogleAttribution />
      </div>
      <NotExhaustiveNotice />
    </div>
  );
}
