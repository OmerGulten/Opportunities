import { describe, expect, it } from "vitest";

import { centroidOf, distanceMeters, formatLatLng, ringOf, roundPoint, toGeoPolygon, viewportRadiusMeters, zoomForRadius } from "./geometry";

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters({ lat: 41, lng: 29 }, { lat: 41, lng: 29 })).toBe(0);
  });

  it("matches a known short distance", () => {
    // One degree of latitude is ~111.2 km anywhere on the sphere.
    const metres = distanceMeters({ lat: 41, lng: 29 }, { lat: 42, lng: 29 });
    expect(metres).toBeGreaterThan(111_000);
    expect(metres).toBeLessThan(111_500);
  });
});

describe("toGeoPolygon", () => {
  it("closes the ring with the first position", () => {
    const polygon = toGeoPolygon([
      { lat: 41, lng: 29 },
      { lat: 41.01, lng: 29 },
      { lat: 41.01, lng: 29.01 },
    ]);
    const ring = polygon?.coordinates[0];
    expect(ring).toHaveLength(4);
    expect(ring?.[0]).toEqual([29, 41]);
    expect(ring?.[3]).toEqual(ring?.[0]);
  });

  it("returns null below three vertices", () => {
    expect(toGeoPolygon([])).toBeNull();
    expect(toGeoPolygon([{ lat: 41, lng: 29 }, { lat: 41.01, lng: 29 }])).toBeNull();
  });
});

describe("ringOf", () => {
  it("drops the closing vertex and round-trips through toGeoPolygon", () => {
    const points = [
      { lat: 41, lng: 29 },
      { lat: 41.01, lng: 29 },
      { lat: 41.01, lng: 29.01 },
    ];
    expect(ringOf(toGeoPolygon(points))).toEqual(points);
  });

  it("is empty for a missing or malformed polygon", () => {
    expect(ringOf(null)).toEqual([]);
    expect(ringOf({ type: "Polygon", coordinates: [] })).toEqual([]);
  });
});

describe("viewportRadiusMeters", () => {
  it("is half the viewport diagonal", () => {
    const radius = viewportRadiusMeters({ north: 41.1, south: 41, east: 29.1, west: 29 });
    const diagonal = distanceMeters({ lat: 41.1, lng: 29.1 }, { lat: 41, lng: 29 });
    expect(radius).toBe(Math.round(diagonal / 2));
  });
});

describe("centroidOf / roundPoint / formatLatLng / zoomForRadius", () => {
  it("averages the vertices", () => {
    expect(centroidOf([{ lat: 0, lng: 0 }, { lat: 2, lng: 4 }])).toEqual({ lat: 1, lng: 2 });
    expect(centroidOf([])).toBeNull();
  });

  it("rounds coordinates to seven decimals", () => {
    expect(roundPoint({ lat: 41.123456789, lng: 28.987654321 })).toEqual({ lat: 41.1234568, lng: 28.9876543 });
  });

  it("formats a point with the requested precision", () => {
    expect(formatLatLng({ lat: 41.0082, lng: 28.9784 }, 2)).toBe("41.01, 28.98");
  });

  it("zooms out as the radius grows", () => {
    expect(zoomForRadius(300)).toBeGreaterThan(zoomForRadius(3000));
    expect(zoomForRadius(3000)).toBeGreaterThan(zoomForRadius(30_000));
  });
});
