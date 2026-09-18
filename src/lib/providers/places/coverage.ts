import { ValidationError } from "@/lib/errors";
import {
  bboxOfCircle,
  distanceToPolygonBoundaryMeters,
  haversineMeters,
  isPointInPolygon,
  localOffsetMeters,
  offsetPoint,
  polygonAreaKm2,
  polygonBbox,
  polygonCentroid,
  validatePolygon,
  type GeoBBox,
} from "@/lib/geo";
import type { GeoPoint, GeoPolygon } from "@/types/common";
import type { CoverageCell, CoveragePlan, PlaceSummary } from "@/types/places";

/**
 * Coverage planning: turns the wizard's area into provider search cells.
 * Nearby Search returns at most 20 results per call, so dense areas are split
 * into overlapping hexagonally packed circles of radius `cellRadiusM`.
 */

export interface CoveragePlanInput {
  method: "radius" | "polygon" | "place";
  center?: GeoPoint;
  radiusM?: number;
  polygon?: GeoPolygon;
  cellRadiusM: number;
  maxCells: number;
}

/** Google's Nearby Search radius ceiling. */
export const MAX_CELL_RADIUS_M = 50_000;
/** Sanity ceiling for a single scan area (radius). */
export const MAX_AREA_RADIUS_M = 100_000;
/** Candidate-cell ceiling before clipping; protects against absurd area / cell-size combinations. */
export const MAX_CANDIDATE_CELLS = 60_000;
/** A requested radius up to this multiple of the cell radius is served by a single cell. */
export const SINGLE_CELL_TOLERANCE = 1.15;
/** Centre spacing relative to the cell radius: sqrt(3) is tangent packing; 0.95 adds overlap. */
export const HEX_SPACING_FACTOR = Math.sqrt(3) * 0.95;

/**
 * Machine-readable plan notes (`code` or `code:key=value,key=value`). The UI
 * translates them; this module produces no human-facing text.
 */
export const COVERAGE_NOTES = {
  SINGLE_CELL: "single_cell",
  CLIPPED_TO_MAX_CELLS: "clipped_to_max_cells",
  CELL_RADIUS_CLAMPED: "cell_radius_clamped",
  CELLS_EXTEND_BEYOND_AREA: "cells_extend_beyond_area",
  POLYGON_EDGE_CELLS_INCLUDED: "polygon_edge_cells_included",
} as const;

export type CoverageNoteCode = (typeof COVERAGE_NOTES)[keyof typeof COVERAGE_NOTES];

export function formatCoverageNote(code: CoverageNoteCode, params?: Record<string, number | string>): string {
  if (!params) return code;
  const entries = Object.entries(params);
  if (entries.length === 0) return code;
  return `${code}:${entries.map(([k, v]) => `${k}=${typeof v === "number" ? Math.round(v * 100) / 100 : v}`).join(",")}`;
}

interface Candidate {
  center: GeoPoint;
  /** Distance to the plan's reference point (area centre / polygon centroid), for stable ordering. */
  rankM: number;
  eastM: number;
  northM: number;
}

/**
 * Hexagonal lattice of cell centres in local metres around `origin`, covering
 * the rectangle [eastMin, eastMax] x [northMin, northMax] with one row/column of
 * margin. Rows run east-west; odd rows are shifted by half the spacing.
 */
function hexLattice(origin: GeoPoint, spacingM: number, eastMin: number, eastMax: number, northMin: number, northMax: number): Candidate[] {
  const rowSpacing = (spacingM * Math.sqrt(3)) / 2;
  const rowFrom = Math.floor(northMin / rowSpacing) - 1;
  const rowTo = Math.ceil(northMax / rowSpacing) + 1;
  const colFrom = Math.floor(eastMin / spacingM) - 1;
  const colTo = Math.ceil(eastMax / spacingM) + 1;

  const estimate = (rowTo - rowFrom + 1) * (colTo - colFrom + 1);
  if (estimate > MAX_CANDIDATE_CELLS) {
    throw new ValidationError("Area is too large for the selected cell size", { details: { estimatedCells: estimate, max: MAX_CANDIDATE_CELLS } });
  }

  const out: Candidate[] = [];
  for (let row = rowFrom; row <= rowTo; row++) {
    const shift = row % 2 === 0 ? 0 : spacingM / 2;
    for (let col = colFrom; col <= colTo; col++) {
      const eastM = col * spacingM + shift;
      const northM = row * rowSpacing;
      out.push({ center: offsetPoint(origin, eastM, northM), rankM: Math.hypot(eastM, northM), eastM, northM });
    }
  }
  return out;
}

function sortCandidates(list: Candidate[]): Candidate[] {
  // Distance first, then a stable geometric tiebreak so identical inputs give identical plans.
  return [...list].sort((a, b) => a.rankM - b.rankM || a.northM - b.northM || a.eastM - b.eastM);
}

function toCells(list: Candidate[], radiusM: number): CoverageCell[] {
  return list.map((c, index) => ({ index, center: { lat: round7(c.center.lat), lng: round7(c.center.lng) }, radiusM: Math.round(radiusM) }));
}

function round7(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}

function clip(sorted: Candidate[], maxCells: number, notes: string[]): Candidate[] {
  if (sorted.length <= maxCells) return sorted;
  notes.push(formatCoverageNote(COVERAGE_NOTES.CLIPPED_TO_MAX_CELLS, { requested: sorted.length, kept: maxCells }));
  return sorted.slice(0, maxCells);
}

function validateCommon(input: CoveragePlanInput): { cellRadiusM: number; maxCells: number; notes: string[] } {
  const notes: string[] = [];
  if (!Number.isFinite(input.cellRadiusM) || input.cellRadiusM <= 0) {
    throw new ValidationError("cellRadiusM must be a positive number", { details: { cellRadiusM: input.cellRadiusM } });
  }
  if (!Number.isInteger(input.maxCells) || input.maxCells < 1) {
    throw new ValidationError("maxCells must be a positive integer", { details: { maxCells: input.maxCells } });
  }
  let cellRadiusM = input.cellRadiusM;
  if (cellRadiusM > MAX_CELL_RADIUS_M) {
    notes.push(formatCoverageNote(COVERAGE_NOTES.CELL_RADIUS_CLAMPED, { requested: cellRadiusM, used: MAX_CELL_RADIUS_M }));
    cellRadiusM = MAX_CELL_RADIUS_M;
  }
  return { cellRadiusM, maxCells: input.maxCells, notes };
}

function planRadius(method: "radius" | "place", input: CoveragePlanInput): CoveragePlan {
  const { cellRadiusM, maxCells, notes } = validateCommon(input);
  const center = input.center;
  const radiusM = input.radiusM;
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
    throw new ValidationError("center is required for radius coverage");
  }
  if (typeof radiusM !== "number" || !Number.isFinite(radiusM) || radiusM <= 0 || radiusM > MAX_AREA_RADIUS_M) {
    throw new ValidationError("radiusM must be between 1 and 100000 metres", { details: { radiusM } });
  }

  const bbox: GeoBBox = bboxOfCircle(center, radiusM);
  const areaKm2 = (Math.PI * radiusM * radiusM) / 1_000_000;

  if (radiusM <= cellRadiusM * SINGLE_CELL_TOLERANCE) {
    notes.push(COVERAGE_NOTES.SINGLE_CELL);
    const cellRadius = Math.min(radiusM, MAX_CELL_RADIUS_M);
    return { method, cells: [{ index: 0, center: { lat: round7(center.lat), lng: round7(center.lng) }, radiusM: Math.round(cellRadius) }], bbox, polygon: null, areaKm2, notes };
  }

  const spacingM = cellRadiusM * HEX_SPACING_FACTOR;
  // Every point of the plane is within spacing/sqrt(3) of a lattice centre. Keeping
  // centres up to that margin outside the area guarantees every point inside the
  // area lies within `cellRadiusM` of a kept centre (no edge gaps). Callers filter
  // results back to the requested area with `filterPlacesToRadius`.
  const margin = spacingM / Math.sqrt(3);
  const extent = radiusM + margin;
  const candidates = hexLattice(center, spacingM, -extent, extent, -extent, extent).filter((c) => c.rankM <= radiusM + margin);
  const sorted = sortCandidates(candidates);
  if (sorted.some((c) => c.rankM > radiusM)) notes.push(COVERAGE_NOTES.CELLS_EXTEND_BEYOND_AREA);
  const kept = clip(sorted, maxCells, notes);

  return { method, cells: toCells(kept, cellRadiusM), bbox, polygon: null, areaKm2, notes };
}

function planPolygon(input: CoveragePlanInput): CoveragePlan {
  const { cellRadiusM, maxCells, notes } = validateCommon(input);
  if (!input.polygon) throw new ValidationError("polygon is required for polygon coverage");
  const polygon = validatePolygon(input.polygon);
  const bbox = polygonBbox(polygon);
  const centroid = polygonCentroid(polygon);
  const areaKm2 = polygonAreaKm2(polygon);

  const spacingM = cellRadiusM * HEX_SPACING_FACTOR;
  const sw = localOffsetMeters(centroid, { lat: bbox.minLat, lng: bbox.minLng });
  const ne = localOffsetMeters(centroid, { lat: bbox.maxLat, lng: bbox.maxLng });
  const lattice = hexLattice(centroid, spacingM, sw.eastM - cellRadiusM, ne.eastM + cellRadiusM, sw.northM - cellRadiusM, ne.northM + cellRadiusM);

  let edgeCells = 0;
  const candidates = lattice.filter((c) => {
    if (isPointInPolygon(c.center, polygon)) return true;
    // A centre just outside still covers part of the polygon when the boundary is closer than the radius.
    if (distanceToPolygonBoundaryMeters(c.center, polygon) < cellRadiusM) {
      edgeCells += 1;
      return true;
    }
    return false;
  });
  if (edgeCells > 0) notes.push(formatCoverageNote(COVERAGE_NOTES.POLYGON_EDGE_CELLS_INCLUDED, { count: edgeCells }));

  const sorted = sortCandidates(candidates);
  const kept = clip(sorted, maxCells, notes);
  if (kept.length === 1) notes.push(COVERAGE_NOTES.SINGLE_CELL);

  return { method: "polygon", cells: toCells(kept, cellRadiusM), bbox, polygon, areaKm2, notes };
}

export function buildCoveragePlan(input: CoveragePlanInput): CoveragePlan {
  switch (input.method) {
    case "radius":
    case "place":
      return planRadius(input.method, input);
    case "polygon":
      return planPolygon(input);
    default:
      throw new ValidationError("Unknown coverage method", { details: { method: String(input.method) } });
  }
}

/**
 * Keeps only places whose coordinates fall inside the polygon. Places without
 * coordinates cannot be verified and are counted as outside.
 */
export function filterPlacesToPolygon(places: PlaceSummary[], polygon: GeoPolygon): { inside: PlaceSummary[]; outside: number } {
  const inside: PlaceSummary[] = [];
  let outside = 0;
  for (const place of places) {
    if (place.location && isPointInPolygon(place.location, polygon)) inside.push(place);
    else outside += 1;
  }
  return { inside, outside };
}

/** Radius counterpart of `filterPlacesToPolygon`; cells may extend past the requested radius. */
export function filterPlacesToRadius(places: PlaceSummary[], center: GeoPoint, radiusM: number): { inside: PlaceSummary[]; outside: number } {
  const inside: PlaceSummary[] = [];
  let outside = 0;
  for (const place of places) {
    if (place.location && haversineMeters(center, place.location) <= radiusM) inside.push(place);
    else outside += 1;
  }
  return { inside, outside };
}

/** True when every sample point is within `cellRadiusM` of at least one cell centre. */
export function coversPoints(plan: CoveragePlan, points: GeoPoint[]): boolean {
  return points.every((p) => plan.cells.some((cell) => haversineMeters(cell.center, p) <= cell.radiusM));
}
