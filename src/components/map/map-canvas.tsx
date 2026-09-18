"use client";

import { APIProvider, ColorScheme, Map, useMap, type MapCameraChangedEvent, type MapMouseEvent } from "@vis.gl/react-google-maps";
import { cn } from "cn";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { GeoPoint } from "@/types/common";

import { DEFAULT_MAP_ZOOM, MAPS_BROWSER_KEY, MAPS_MAP_ID } from "./config";
import { MapPlaceholder, type MapPlaceholderItem } from "./map-placeholder";

export interface MapCameraState {
  center: GeoPoint;
  zoom: number;
}

/**
 * Current camera, published to map children (marker clustering needs the zoom).
 * It is updated from the map's own `camerachanged` event, never from an effect.
 */
const MapCameraContext = createContext<MapCameraState | null>(null);

export function useMapCamera(): MapCameraState | null {
  return useContext(MapCameraContext);
}

export interface MapCanvasProps {
  center: GeoPoint;
  zoom?: number;
  children?: ReactNode;
  /** Fires with the clicked coordinates; omit to make the map non-clickable. */
  onClick?: (point: GeoPoint) => void;
  className?: string;
  /** Text description of the area, used when no Maps browser key is configured. */
  placeholderItems?: MapPlaceholderItem[];
  placeholderDescription?: ReactNode;
  placeholderChildren?: ReactNode;
  /** Accessible name of the map region. */
  label?: string;
  /** `false` renders a static, non-interactive map (overview panels). */
  interactive?: boolean;
}

/**
 * Google Maps wrapper. Everything map-related in the app goes through here so
 * the missing-key path exists in exactly one place.
 */
export function MapCanvas({
  center,
  zoom = DEFAULT_MAP_ZOOM,
  children,
  onClick,
  className,
  placeholderItems,
  placeholderDescription,
  placeholderChildren,
  label,
  interactive = true,
}: MapCanvasProps) {
  const [camera, setCamera] = useState<MapCameraState>({ center, zoom });
  const { resolvedTheme } = useTheme();

  if (!MAPS_BROWSER_KEY) {
    return (
      <MapPlaceholder items={placeholderItems} description={placeholderDescription} className={className}>
        {placeholderChildren}
      </MapPlaceholder>
    );
  }

  return (
    <div className={cn("relative h-72 w-full overflow-hidden rounded-xl ring-1 ring-foreground/10", className)}>
      <APIProvider apiKey={MAPS_BROWSER_KEY}>
        <Map
          mapId={MAPS_MAP_ID}
          defaultCenter={center}
          defaultZoom={zoom}
          colorScheme={resolvedTheme === "dark" ? ColorScheme.DARK : ColorScheme.LIGHT}
          gestureHandling={interactive ? "greedy" : "none"}
          disableDefaultUI
          zoomControl={interactive}
          clickableIcons={false}
          keyboardShortcuts={interactive}
          className="size-full"
          aria-label={label}
          onCameraChanged={(event: MapCameraChangedEvent) => setCamera({ center: event.detail.center, zoom: event.detail.zoom })}
          onClick={
            onClick
              ? (event: MapMouseEvent) => {
                  const latLng = event.detail.latLng;
                  if (latLng) onClick({ lat: latLng.lat, lng: latLng.lng });
                }
              : undefined
          }
        >
          <CameraSync lat={center.lat} lng={center.lng} zoom={zoom} />
          <MapCameraContext.Provider value={camera}>{children}</MapCameraContext.Provider>
        </Map>
      </APIProvider>
    </div>
  );
}

/**
 * Follows the `center`/`zoom` props imperatively. The map stays uncontrolled, so
 * panning and zooming by hand is never fought by a re-render; only an actual
 * prop change (a searched place, a redrawn area) moves the camera.
 */
function CameraSync({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    if (map) map.panTo({ lat, lng });
  }, [map, lat, lng]);

  useEffect(() => {
    if (map) map.setZoom(zoom);
  }, [map, zoom]);

  return null;
}
