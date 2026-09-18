import { publicEnv } from "@/lib/config/env";
import type { GeoPoint } from "@/types/common";

/**
 * Browser-side Google Maps configuration.
 *
 * The key is optional on purpose: every map in the app degrades to
 * `MapPlaceholder`, which states the area in text, so the scan wizard stays
 * fully usable on an installation without a Maps browser key.
 */

export const MAPS_BROWSER_KEY: string | null = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? null;

/**
 * Advanced markers require a map id. `DEMO_MAP_ID` is Google's public sample id;
 * it renders the default style and logs a console notice, which is the correct
 * behaviour for an installation that has not created a styled map yet.
 */
export const MAPS_MAP_ID: string = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";

export function isMapAvailable(): boolean {
  return typeof MAPS_BROWSER_KEY === "string" && MAPS_BROWSER_KEY.length > 0;
}

/** Fallback camera when nothing has been chosen yet (Istanbul; primary market). */
export const DEFAULT_MAP_CENTER: GeoPoint = { lat: 41.0082, lng: 28.9784 };
export const DEFAULT_MAP_ZOOM = 12;

/**
 * Stroke/fill colours for map geometry. The Maps JS API paints on a canvas and
 * cannot read Tailwind classes, so the accent hues are repeated here as hex.
 */
export const MAP_COLORS = {
  accentStroke: "#0d9488",
  accentFill: "#14b8a6",
  cellStroke: "#0891b2",
  cellFill: "#06b6d4",
  attentionStroke: "#d97706",
} as const;
