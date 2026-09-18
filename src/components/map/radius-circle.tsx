"use client";

import { AdvancedMarker, Circle } from "@vis.gl/react-google-maps";

import { useT } from "@/lib/i18n/client";
import type { GeoPoint } from "@/types/common";

import { MAP_COLORS } from "./config";
import { roundPoint } from "./geometry";

export interface RadiusCircleProps {
  center: GeoPoint;
  radiusM: number;
  /** Adds the drag handles that resize the circle. */
  editable?: boolean;
  minRadiusM?: number;
  maxRadiusM?: number;
  /** Omit to pin the centre in place. */
  onCenterChange?: (center: GeoPoint) => void;
  onRadiusChange?: (radiusM: number) => void;
}

/**
 * Centre marker plus the search circle. Both the marker and the circle handles
 * write back through the callbacks, so the form stays the single source of
 * truth for the area.
 */
export function RadiusCircle({
  center,
  radiusM,
  editable = false,
  minRadiusM = 200,
  maxRadiusM = 50_000,
  onCenterChange,
  onRadiusChange,
}: RadiusCircleProps) {
  const t = useT("scans");
  const draggable = Boolean(onCenterChange);

  return (
    <>
      <Circle
        center={center}
        radius={radiusM}
        editable={editable && Boolean(onRadiusChange)}
        clickable={false}
        strokeColor={MAP_COLORS.accentStroke}
        strokeOpacity={0.9}
        strokeWeight={2}
        fillColor={MAP_COLORS.accentFill}
        fillOpacity={0.12}
        onRadiusChanged={(next) => {
          if (!onRadiusChange || !Number.isFinite(next)) return;
          const clamped = Math.round(Math.min(maxRadiusM, Math.max(minRadiusM, next)));
          // The Maps API re-emits the value it was given; only report real changes.
          if (clamped !== Math.round(radiusM)) onRadiusChange(clamped);
        }}
        onCenterChanged={(next) => {
          if (!onCenterChange || !next) return;
          const point = roundPoint({ lat: next.lat(), lng: next.lng() });
          if (point.lat !== center.lat || point.lng !== center.lng) onCenterChange(point);
        }}
      />
      <AdvancedMarker
        position={center}
        draggable={draggable}
        title={t("map.centerTitle")}
        onDragEnd={(event) => {
          const latLng = event.latLng;
          if (latLng && onCenterChange) onCenterChange(roundPoint({ lat: latLng.lat(), lng: latLng.lng() }));
        }}
      >
        <span className="block size-3.5 rounded-full border-2 border-white bg-teal-600 shadow-md" aria-hidden />
      </AdvancedMarker>
    </>
  );
}
