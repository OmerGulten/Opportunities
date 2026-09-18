"use client";

import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { cn } from "cn";
import { useMemo } from "react";

import { useT } from "@/lib/i18n/client";
import type { GeoPoint } from "@/types/common";

import { useMapCamera } from "./map-canvas";

export interface BusinessMarkerItem {
  id: string;
  name: string;
  location: GeoPoint;
}

export interface BusinessMarkersProps {
  items: BusinessMarkerItem[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Above this many markers the grid clustering kicks in. */
  clusterThreshold?: number;
}

interface Cluster {
  key: string;
  center: GeoPoint;
  items: BusinessMarkerItem[];
}

/**
 * Business pins with selection. Dense results are grouped into a zoom-dependent
 * grid rather than drawing hundreds of overlapping pins; clicking a group zooms
 * into it. No external clustering dependency is involved.
 */
export function BusinessMarkers({ items, selectedId = null, onSelect, clusterThreshold = 60 }: BusinessMarkersProps) {
  const t = useT("scans");
  const map = useMap();
  const camera = useMapCamera();
  const zoom = camera?.zoom ?? 12;

  const clusters = useMemo<Cluster[]>(() => {
    if (items.length <= clusterThreshold) {
      return items.map((item) => ({ key: item.id, center: item.location, items: [item] }));
    }
    // One grid cell is roughly one marker's worth of screen space at this zoom.
    const cellSize = 360 / 2 ** (zoom + 3);
    const buckets = new Map<string, BusinessMarkerItem[]>();
    for (const item of items) {
      const key = `${Math.floor(item.location.lat / cellSize)}:${Math.floor(item.location.lng / cellSize)}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(item);
      else buckets.set(key, [item]);
    }
    return [...buckets.entries()].map(([key, bucketItems]) => ({
      key,
      center: {
        lat: bucketItems.reduce((sum, item) => sum + item.location.lat, 0) / bucketItems.length,
        lng: bucketItems.reduce((sum, item) => sum + item.location.lng, 0) / bucketItems.length,
      },
      items: bucketItems,
    }));
  }, [items, clusterThreshold, zoom]);

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.items.length === 1) {
          const item = cluster.items[0]!;
          const selected = item.id === selectedId;
          return (
            <AdvancedMarker
              key={cluster.key}
              position={item.location}
              title={item.name}
              clickable={Boolean(onSelect)}
              onClick={() => onSelect?.(selected ? null : item.id)}
            >
              <span
                className={cn(
                  "block size-3.5 rounded-full border-2 border-white shadow-md transition-transform",
                  selected ? "scale-150 bg-amber-500" : "bg-teal-600",
                )}
                aria-hidden
              />
            </AdvancedMarker>
          );
        }

        return (
          <AdvancedMarker
            key={cluster.key}
            position={cluster.center}
            title={t("map.clusterTitle", { count: cluster.items.length })}
            clickable
            onClick={() => {
              if (!map) return;
              map.panTo(cluster.center);
              map.setZoom(Math.min(20, (map.getZoom() ?? zoom) + 2));
            }}
          >
            <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-teal-600/90 text-[11px] font-semibold text-white tabular-nums shadow-md">
              {cluster.items.length > 99 ? "99+" : cluster.items.length}
            </span>
          </AdvancedMarker>
        );
      })}
    </>
  );
}
