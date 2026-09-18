import {
  area as turfArea,
  bbox as turfBbox,
  booleanPointInPolygon,
  centroid as turfCentroid,
  lineString as turfLineString,
  point as turfPoint,
  pointToLineDistance,
  polygon as turfPolygon,
} from "@turf/turf";
import { z } from "zod";

import { ValidationError } from "@/lib/errors";
import type { GeoPoint, GeoPolygon } from "@/types/common";

/**
 * Geometry helpers shared by coverage planning, polygon filtering and the demo
 * provider. Pure functions; no I/O. Distances are metres, angles degrees.
 */

/** Mean Earth radius used by the spherical formulas (matches turf's default). */
export const EARTH_RADIUS_M = 6371008.8;

/** Maximum number of distinct polygon vertices accepted from the wizard. */
export const MAX_POLYGON_VERTICES = 200;

export interface GeoBBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance between two points in metres. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point reached from `origin` travelling `distanceM` along `bearingDeg` (0 = north, 90 = east). */
export function destinationPoint(origin: GeoPoint, bearingDeg: number, distanceM: number): GeoPoint {
  const delta = distanceM / EARTH_RADIUS_M;
  const theta = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const sinLat2 = Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(theta);
  const lat2 = Math.asin(Math.max(-1, Math.min(1, sinLat2)));
  const y = Math.sin(theta) * Math.sin(delta) * Math.cos(lat1);
  const x = Math.cos(delta) - Math.sin(lat1) * sinLat2;
  const lng2 = lng1 + Math.atan2(y, x);
  return { lat: toDeg(lat2), lng: normalizeLng(toDeg(lng2)) };
}

function normalizeLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * Local equirectangular offset: `eastM`/`northM` metres from `origin`.
 * Accurate to well under 1% at city scale (<= 50 km); used for grid generation.
 */
export function offsetPoint(origin: GeoPoint, eastM: number, northM: number): GeoPoint {
  const dLat = northM / EARTH_RADIUS_M;
  const dLng = eastM / (EARTH_RADIUS_M * Math.cos(toRad(origin.lat)));
  return { lat: origin.lat + toDeg(dLat), lng: normalizeLng(origin.lng + toDeg(dLng)) };
}

/** Inverse of `offsetPoint`: metres east/north of `origin` for `point`. */
export function localOffsetMeters(origin: GeoPoint, point: GeoPoint): { eastM: number; northM: number } {
  const northM = toRad(point.lat - origin.lat) * EARTH_RADIUS_M;
  const eastM = toRad(point.lng - origin.lng) * EARTH_RADIUS_M * Math.cos(toRad(origin.lat));
  return { eastM, northM };
}

/** Bounding box of a circle (spherical). */
export function bboxOfCircle(center: GeoPoint, radiusM: number): GeoBBox {
  const north = destinationPoint(center, 0, radiusM);
  const south = destinationPoint(center, 180, radiusM);
  const east = destinationPoint(center, 90, radiusM);
  const west = destinationPoint(center, 270, radiusM);
  return { minLat: south.lat, maxLat: north.lat, minLng: west.lng, maxLng: east.lng };
}

function toTurfPolygon(polygon: GeoPolygon) {
  return turfPolygon(polygon.coordinates);
}

function outerRing(polygon: GeoPolygon): number[][] {
  return polygon.coordinates[0] ?? [];
}

/** True when the point lies inside (or on the boundary of) the polygon. */
export function isPointInPolygon(point: GeoPoint, polygon: GeoPolygon): boolean {
  return booleanPointInPolygon(turfPoint([point.lng, point.lat]), toTurfPolygon(polygon), { ignoreBoundary: false });
}

/** Geodesic area in square kilometres. */
export function polygonAreaKm2(polygon: GeoPolygon): number {
  return turfArea(toTurfPolygon(polygon)) / 1_000_000;
}

export function polygonBbox(polygon: GeoPolygon): GeoBBox {
  const [minLng, minLat, maxLng, maxLat] = turfBbox(toTurfPolygon(polygon));
  return { minLat, minLng, maxLat, maxLng };
}

export function polygonCentroid(polygon: GeoPolygon): GeoPoint {
  const c = turfCentroid(toTurfPolygon(polygon));
  const [lng, lat] = c.geometry.coordinates;
  return { lat, lng };
}

/** Shortest distance from a point to the polygon's outer boundary, in metres. */
export function distanceToPolygonBoundaryMeters(point: GeoPoint, polygon: GeoPolygon): number {
  const boundary = turfLineString(outerRing(polygon));
  return pointToLineDistance(turfPoint([point.lng, point.lat]), boundary, { units: "meters" });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const finiteNumber = z.number().refine((n) => Number.isFinite(n), { message: "must be a finite number" });
const positionSchema = z.array(finiteNumber).min(2).max(3);
const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(positionSchema)).min(1),
});

/**
 * Validates an untrusted GeoJSON Polygon (outer ring only in the MVP; holes are
 * dropped). The ring is auto-closed when the last position differs from the
 * first. Throws `ValidationError` for anything else that is off.
 */
export function validatePolygon(geojson: unknown): GeoPolygon {
  const parsed = polygonSchema.safeParse(geojson);
  if (!parsed.success) {
    throw new ValidationError("Invalid polygon geometry", {
      details: { issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    });
  }
  const ring = parsed.data.coordinates[0]!.map(([lng, lat]) => [lng!, lat!]);

  for (const [lng, lat] of ring) {
    if (lng! < -180 || lng! > 180 || lat! < -90 || lat! > 90) {
      throw new ValidationError("Polygon coordinates out of range", { details: { lng, lat } });
    }
  }

  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  const closed = first[0] === last[0] && first[1] === last[1];
  if (!closed) ring.push([first[0]!, first[1]!]);

  const distinctVertices = ring.length - 1;
  if (ring.length < 4) {
    throw new ValidationError("Polygon needs at least three distinct vertices", { details: { vertices: distinctVertices } });
  }
  if (distinctVertices > MAX_POLYGON_VERTICES) {
    throw new ValidationError("Polygon has too many vertices", { details: { vertices: distinctVertices, max: MAX_POLYGON_VERTICES } });
  }

  const polygon: GeoPolygon = { type: "Polygon", coordinates: [ring] };
  const areaKm2 = polygonAreaKm2(polygon);
  if (!(areaKm2 > 0)) {
    throw new ValidationError("Polygon has no area", { details: { vertices: distinctVertices } });
  }
  return polygon;
}
