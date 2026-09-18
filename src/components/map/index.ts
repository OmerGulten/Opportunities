/**
 * Google Maps building blocks.
 *
 * Every component degrades without `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`:
 * `MapCanvas` then renders `MapPlaceholder`, which states the same area in text.
 * User-facing strings live under `scans.map.*` because the scan flow is the only
 * consumer today; move them to `common` when a second feature adopts these.
 */

export { BusinessMarkers } from "./business-markers";
export type { BusinessMarkerItem, BusinessMarkersProps } from "./business-markers";
export { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, MAP_COLORS, MAPS_MAP_ID, isMapAvailable } from "./config";
export { centroidOf, distanceMeters, formatLatLng, ringOf, roundPoint, toGeoPolygon, viewportRadiusMeters, zoomForRadius } from "./geometry";
export type { LatLngViewport } from "./geometry";
export { LocationSearch } from "./location-search";
export type { LocationSearchProps, LocationSelection } from "./location-search";
export { MapCanvas, useMapCamera } from "./map-canvas";
export type { MapCameraState, MapCanvasProps } from "./map-canvas";
export { MapPlaceholder } from "./map-placeholder";
export type { MapPlaceholderItem, MapPlaceholderProps } from "./map-placeholder";
export { PolygonDrawer } from "./polygon-drawer";
export type { PolygonDrawerProps } from "./polygon-drawer";
export { RadiusCircle } from "./radius-circle";
export type { RadiusCircleProps } from "./radius-circle";
