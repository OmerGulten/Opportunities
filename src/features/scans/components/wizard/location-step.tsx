"use client";

import { cn } from "cn";
import { Crosshair, PencilRuler, Search } from "lucide-react";

import {
  DEFAULT_MAP_CENTER,
  LocationSearch,
  MapCanvas,
  PolygonDrawer,
  RadiusCircle,
  centroidOf,
  formatLatLng,
  ringOf,
  zoomForRadius,
  type LocationSelection,
  type MapPlaceholderItem,
} from "@/components/map";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useFormatters, useT } from "@/lib/i18n/client";
import type { GeoPoint, GeoPolygon, LocationMethod } from "@/types/common";

import type { ScanFormApi, ScanLimits } from "./types";

const METHODS: Array<{ id: LocationMethod; icon: typeof Search }> = [
  { id: "place", icon: Search },
  { id: "radius", icon: Crosshair },
  { id: "polygon", icon: PencilRuler },
];

export interface LocationStepProps {
  form: ScanFormApi;
  limits: ScanLimits;
  /** Localized message for the area error, resolved by the wizard. */
  errorMessage: string | null;
}

/**
 * Step 1 — where to scan. All three methods write into the same form fields, so
 * the map is only an editor for `center`/`radiusM`/`polygon`, never a source of
 * truth of its own.
 */
export function LocationStep({ form, limits, errorMessage }: LocationStepProps) {
  const t = useT("scans");
  const tc = useT("common");
  const { number } = useFormatters();

  const method = form.watch("locationMethod");
  const center = form.watch("center") ?? null;
  const radiusM = form.watch("radiusM") ?? limits.minRadiusM;
  const polygonValue = form.watch("polygon") ?? null;
  const placeLabel = form.watch("placeLabel") ?? null;

  const units = { km: tc("units.km"), m: tc("units.m") };
  const polygon: GeoPolygon | null = polygonValue;
  const vertices = ringOf(polygon);
  const cameraCenter = center ?? centroidOf(vertices) ?? DEFAULT_MAP_CENTER;
  const isPolygon = method === "polygon";

  function selectMethod(next: LocationMethod) {
    if (next === method) return;
    form.setValue("locationMethod", next, { shouldValidate: false });
    if (next === "polygon") {
      form.setValue("placeLabel", null);
    } else {
      const fallbackCenter = center ?? centroidOf(ringOf(polygon));
      form.setValue("polygon", null);
      if (fallbackCenter) form.setValue("center", fallbackCenter);
      if (!form.getValues("radiusM")) form.setValue("radiusM", defaultRadius(limits));
      if (next === "radius") form.setValue("placeLabel", null);
    }
    void form.trigger(["center", "radiusM", "polygon"]);
  }

  function applyCenter(point: GeoPoint, label: string | null, radiusHintM: number | null) {
    form.setValue("center", point, { shouldValidate: true });
    form.setValue("placeLabel", label);
    const hinted = radiusHintM === null ? null : clampRadius(radiusHintM, limits);
    if (hinted !== null) form.setValue("radiusM", hinted, { shouldValidate: true });
    else if (!form.getValues("radiusM")) form.setValue("radiusM", defaultRadius(limits), { shouldValidate: true });
    void form.trigger(["center", "radiusM"]);
  }

  function handleSelection(selection: LocationSelection) {
    if (isPolygon) form.setValue("locationMethod", "place");
    applyCenter(selection.center, selection.label, selection.radiusHintM);
  }

  function handleRadius(next: number) {
    form.setValue("radiusM", clampRadius(next, limits), { shouldValidate: true });
  }

  function handlePolygon(next: GeoPolygon | null) {
    form.setValue("polygon", next === null ? null : toFormPolygon(next), { shouldValidate: true });
  }

  const placeholderItems: MapPlaceholderItem[] = [
    { key: "method", label: t("wizard.location.method"), value: t(`wizard.location.methods.${method}.label`) },
    ...(isPolygon
      ? [
          { key: "vertices", label: t("wizard.location.vertices"), value: number(vertices.length) },
          ...vertices.slice(0, 8).map((point, index) => ({
            key: `vertex-${index}`,
            label: t("map.vertexTitle", { index: index + 1 }),
            value: formatLatLng(point),
          })),
        ]
      : [
          { key: "center", label: t("wizard.location.center"), value: center ? formatLatLng(center) : t("wizard.location.noCenter") },
          { key: "radius", label: t("wizard.location.radius"), value: formatRadius(radiusM, number, units) },
          ...(placeLabel ? [{ key: "place", label: t("wizard.location.place"), value: placeLabel }] : []),
        ]),
  ];

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("wizard.location.method")}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {METHODS.map(({ id, icon: Icon }) => {
            const active = id === method;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectMethod(id)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "border-primary/40 bg-primary/5" : "border-border hover:bg-muted/50",
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                  {t(`wizard.location.methods.${id}.label`)}
                </span>
                <span className="text-xs text-muted-foreground">{t(`wizard.location.methods.${id}.description`)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {!isPolygon ? <LocationSearch onSelect={handleSelection} initialQuery={placeLabel ?? ""} /> : null}

      <MapCanvas
        center={cameraCenter}
        zoom={isPolygon ? 12 : zoomForRadius(radiusM)}
        onClick={isPolygon ? undefined : (point) => applyCenter(point, null, null)}
        className="h-80"
        label={t("wizard.location.mapLabel")}
        placeholderItems={placeholderItems}
        placeholderDescription={isPolygon ? t("wizard.location.polygonUnavailable") : undefined}
      >
        {isPolygon ? (
          <PolygonDrawer value={polygon} onChange={handlePolygon} />
        ) : center ? (
          <RadiusCircle
            center={center}
            radiusM={radiusM}
            editable
            minRadiusM={limits.minRadiusM}
            maxRadiusM={limits.maxRadiusM}
            onCenterChange={(next) => applyCenter(next, null, null)}
            onRadiusChange={handleRadius}
          />
        ) : null}
      </MapCanvas>

      {isPolygon ? (
        <p className="text-xs text-muted-foreground">
          {vertices.length === 0
            ? t("wizard.location.polygonHint")
            : t("wizard.location.polygonVertices", { count: vertices.length })}
        </p>
      ) : (
        <Field>
          <FieldLabel htmlFor="scan-radius">{t("wizard.location.radius")}</FieldLabel>
          <div className="flex items-center gap-3">
            <Slider
              value={[radiusM]}
              min={limits.minRadiusM}
              max={limits.maxRadiusM}
              step={100}
              className="flex-1"
              aria-label={t("wizard.location.radius")}
              onValueChange={(value) => handleRadius(Array.isArray(value) ? (value[0] ?? radiusM) : value)}
            />
            <Input
              id="scan-radius"
              type="number"
              inputMode="numeric"
              className="w-28"
              min={limits.minRadiusM}
              max={limits.maxRadiusM}
              step={100}
              value={String(radiusM)}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) handleRadius(next);
              }}
            />
          </div>
          <FieldDescription>
            {t("wizard.location.radiusHint", {
              min: formatRadius(limits.minRadiusM, number, units),
              max: formatRadius(limits.maxRadiusM, number, units),
            })}
          </FieldDescription>
        </Field>
      )}

      <FieldError>{errorMessage}</FieldError>
    </div>
  );
}

function defaultRadius(limits: ScanLimits): number {
  return clampRadius(2000, limits);
}

function clampRadius(value: number, limits: ScanLimits): number {
  return Math.round(Math.min(limits.maxRadiusM, Math.max(limits.minRadiusM, value)));
}

function formatRadius(
  radiusM: number,
  number: (value: number, options?: Intl.NumberFormatOptions) => string,
  units: { km: string; m: string },
): string {
  return radiusM >= 1000 ? `${number(radiusM / 1000, { maximumFractionDigits: 1 })} ${units.km}` : `${number(radiusM)} ${units.m}`;
}

/** The form field types positions as tuples; the drawer emits plain arrays. */
function toFormPolygon(polygon: GeoPolygon): { type: "Polygon"; coordinates: [number, number][][] } {
  const ring = polygon.coordinates[0] ?? [];
  const positions: [number, number][] = ring.map((position) => [position[0] ?? 0, position[1] ?? 0]);
  return { type: "Polygon", coordinates: [positions] };
}
