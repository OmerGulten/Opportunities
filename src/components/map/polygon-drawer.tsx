"use client";

import { AdvancedMarker, ControlPosition, MapControl, Polygon, Polyline, useMap } from "@vis.gl/react-google-maps";
import { Eraser, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";
import type { GeoPoint, GeoPolygon } from "@/types/common";

import { MAP_COLORS } from "./config";
import { ringOf, roundPoint, toGeoPolygon } from "./geometry";

export interface PolygonDrawerProps {
  /** Seeds the drawing; the drawer owns the vertices while it is mounted. */
  value: GeoPolygon | null;
  /** Receives a closed GeoJSON Polygon, or null while fewer than three vertices exist. */
  onChange: (polygon: GeoPolygon | null) => void;
  /** `false` renders the shape read-only (scan detail, review step). */
  editable?: boolean;
  /** Distinct vertices allowed; the API schema accepts at most 199. */
  maxVertices?: number;
}

/**
 * Draws and edits the scan area. Clicking the map appends a vertex, each vertex
 * can be dragged, and the last point or the whole shape can be removed. The
 * emitted ring is closed by repeating the first position, which is what
 * `geoPolygonSchema` and the coverage planner expect.
 */
export function PolygonDrawer({ value, onChange, editable = true, maxVertices = 100 }: PolygonDrawerProps) {
  const t = useT("scans");
  const map = useMap();
  const [points, setPoints] = useState<GeoPoint[]>(() => ringOf(value));

  function commit(next: GeoPoint[]) {
    setPoints(next);
    onChange(toGeoPolygon(next));
  }

  // The map listener is registered once; the ref keeps it calling the current
  // handler without re-subscribing on every render.
  const appendRef = useRef<(point: GeoPoint) => void>(() => {});
  useEffect(() => {
    appendRef.current = (point: GeoPoint) => {
      if (points.length >= maxVertices) return;
      commit([...points, roundPoint(point)]);
    };
  });

  useEffect(() => {
    if (!map || !editable) return;
    const listener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
      const latLng = event.latLng;
      if (latLng) appendRef.current({ lat: latLng.lat(), lng: latLng.lng() });
    });
    return () => listener.remove();
  }, [map, editable]);

  const closed = points.length >= 3;
  const path = closed ? [...points, points[0]!] : points;

  return (
    <>
      {closed ? (
        <Polygon
          paths={points}
          clickable={false}
          strokeColor={MAP_COLORS.accentStroke}
          strokeOpacity={0.9}
          strokeWeight={2}
          fillColor={MAP_COLORS.accentFill}
          fillOpacity={0.12}
        />
      ) : points.length === 2 ? (
        <Polyline path={path} strokeColor={MAP_COLORS.accentStroke} strokeOpacity={0.9} strokeWeight={2} />
      ) : null}

      {points.map((point, index) => (
        <AdvancedMarker
          key={`${index}-${point.lat}-${point.lng}`}
          position={point}
          draggable={editable}
          title={t("map.vertexTitle", { index: index + 1 })}
          onDragEnd={(event) => {
            const latLng = event.latLng;
            if (!latLng) return;
            const next = [...points];
            next[index] = roundPoint({ lat: latLng.lat(), lng: latLng.lng() });
            commit(next);
          }}
        >
          <span className="block size-3 rounded-full border-2 border-white bg-teal-600 shadow-md" aria-hidden />
        </AdvancedMarker>
      ))}

      {editable ? (
        <MapControl position={ControlPosition.TOP_RIGHT}>
          <div className="m-2 flex max-w-56 flex-col gap-1.5 rounded-lg bg-background/95 p-2 text-xs shadow-lg ring-1 ring-foreground/10 backdrop-blur">
            <p className="text-muted-foreground">
              {points.length >= maxVertices
                ? t("map.drawLimitReached", { max: maxVertices })
                : closed
                  ? t("map.drawVertices", { count: points.length })
                  : t("map.drawHint")}
            </p>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={points.length === 0}
                onClick={() => commit(points.slice(0, -1))}
              >
                <Undo2 />
                {t("map.undoPoint")}
              </Button>
              <Button type="button" variant="ghost" size="xs" disabled={points.length === 0} onClick={() => commit([])}>
                <Eraser />
                {t("map.clearArea")}
              </Button>
            </div>
          </div>
        </MapControl>
      ) : null}
    </>
  );
}
