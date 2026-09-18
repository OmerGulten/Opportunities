import type { GeoPoint, GeoPolygon, Json } from "@/types/common";
import type { ScanRow } from "@/types/db";

/**
 * Narrowing helpers for the JSON columns on `scans`. The database stores them as
 * `Json`, so the UI validates the shape before drawing anything with it.
 */

export function parseGeoPolygon(value: Json | null | undefined): GeoPolygon | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { type?: unknown; coordinates?: unknown };
  if (candidate.type !== "Polygon" || !Array.isArray(candidate.coordinates)) return null;

  const rings: number[][][] = [];
  for (const ring of candidate.coordinates) {
    if (!Array.isArray(ring)) return null;
    const positions: number[][] = [];
    for (const position of ring) {
      if (!Array.isArray(position)) return null;
      const lng = position[0];
      const lat = position[1];
      if (typeof lng !== "number" || typeof lat !== "number") return null;
      positions.push([lng, lat]);
    }
    rings.push(positions);
  }
  if (rings.length === 0 || (rings[0]?.length ?? 0) < 4) return null;
  return { type: "Polygon", coordinates: rings };
}

export function scanCenter(scan: Pick<ScanRow, "center_lat" | "center_lng">): GeoPoint | null {
  if (typeof scan.center_lat !== "number" || typeof scan.center_lng !== "number") return null;
  return { lat: scan.center_lat, lng: scan.center_lng };
}

/** Cell count recorded by the planner, or null when the plan is not written yet. */
export function coverageCellCount(scan: Pick<ScanRow, "coverage_metadata">): number | null {
  const cells = scan.coverage_metadata?.cells;
  return typeof cells === "number" ? cells : null;
}

/** Machine-readable coverage notes recorded at planning time. */
export function coverageNotes(scan: Pick<ScanRow, "coverage_metadata">): string[] {
  const notes = scan.coverage_metadata?.notes;
  if (!Array.isArray(notes)) return [];
  return notes.filter((note): note is string => typeof note === "string");
}
