import type { GeoPoint, GeoPolygon } from "@/types/common";

/**
 * Tiny browser-safe geometry helpers for the map components.
 *
 * `src/lib/geo` is the authority for anything the server plans or validates, but
 * it pulls in turf; these few formulas keep the client bundle small. Values are
 * only used for display and for seeding the wizard, never for coverage planning.
 */

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface LatLngViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Half the diagonal of a viewport: a sensible starting radius for a searched place. */
export function viewportRadiusMeters(viewport: LatLngViewport): number {
  const northEast: GeoPoint = { lat: viewport.north, lng: viewport.east };
  const southWest: GeoPoint = { lat: viewport.south, lng: viewport.west };
  return Math.round(distanceMeters(northEast, southWest) / 2);
}

/** Open ring (no repeated closing vertex) of a polygon, or an empty list. */
export function ringOf(polygon: GeoPolygon | null | undefined): GeoPoint[] {
  const ring = polygon?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length === 0) return [];
  const points = ring
    .map((position) => {
      const lng = position?.[0];
      const lat = position?.[1];
      return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
    })
    .filter((point): point is GeoPoint => point !== null);
  if (points.length < 2) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return first.lat === last.lat && first.lng === last.lng ? points.slice(0, -1) : points;
}

/**
 * GeoJSON Polygon from an open ring. Coordinates are `[lng, lat]` and the ring
 * is closed by repeating the first position, as the schema requires. Fewer than
 * three distinct vertices cannot describe an area, so `null` is returned.
 */
export function toGeoPolygon(points: GeoPoint[]): GeoPolygon | null {
  if (points.length < 3) return null;
  const ring: number[][] = points.map((point) => [point.lng, point.lat]);
  const first = points[0]!;
  ring.push([first.lng, first.lat]);
  return { type: "Polygon", coordinates: [ring] };
}

/** Arithmetic mean of the vertices. Good enough to centre a camera on a drawn area. */
export function centroidOf(points: GeoPoint[]): GeoPoint | null {
  if (points.length === 0) return null;
  const sum = points.reduce((acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

export function formatLatLng(point: GeoPoint, digits = 5): string {
  return `${point.lat.toFixed(digits)}, ${point.lng.toFixed(digits)}`;
}

/** Rounds to ~1 cm so dragging a marker does not produce 15 decimal places. */
export function roundPoint(point: GeoPoint): GeoPoint {
  return { lat: Math.round(point.lat * 1e7) / 1e7, lng: Math.round(point.lng * 1e7) / 1e7 };
}

/** Zoom level that keeps a circle of this radius in view. */
export function zoomForRadius(radiusM: number): number {
  if (radiusM <= 500) return 15;
  if (radiusM <= 1000) return 14;
  if (radiusM <= 2500) return 13;
  if (radiusM <= 5000) return 12;
  if (radiusM <= 10_000) return 11;
  if (radiusM <= 25_000) return 10;
  return 9;
}
