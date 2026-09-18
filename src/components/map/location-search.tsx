"use client";

import { Crosshair, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { GoogleAttribution } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/lib/i18n/client";
import type { GeoPoint } from "@/types/common";
import type { LocationSuggestion } from "@/types/places";

import { viewportRadiusMeters } from "./geometry";

export interface LocationSelection {
  /** Provider label, or null when the user typed coordinates. */
  label: string | null;
  center: GeoPoint;
  /** Suggested radius from the provider viewport, when it gave one. */
  radiusHintM: number | null;
}

export interface LocationSearchProps {
  onSelect: (selection: LocationSelection) => void;
  initialQuery?: string;
  /** Disables the search box; manual coordinates stay available. */
  searchDisabled?: boolean;
}

type SearchState = "idle" | "loading" | "done" | "error";

/**
 * Place search for the wizard. It calls `/api/places/locations`, which returns
 * an empty list when the configured provider offers no location search — in
 * that case (and whenever search fails) the manual coordinate entry below is
 * the complete fallback, so the step never becomes a dead end.
 */
export function LocationSearch({ onSelect, initialQuery = "", searchDisabled = false }: LocationSearchProps) {
  const t = useT("scans");
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<LocationSuggestion[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualError, setManualError] = useState(false);

  const trimmed = query.trim();
  const canSearch = !searchDisabled && trimmed.length >= 2;

  useEffect(() => {
    if (searchDisabled || trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/places/locations?q=${encodeURIComponent(trimmed)}`, {
            signal: controller.signal,
            headers: { accept: "application/json" },
          });
          if (!response.ok) {
            setState("error");
            return;
          }
          const payload = (await response.json()) as { data?: LocationSuggestion[] };
          setResults(Array.isArray(payload.data) ? payload.data : []);
          setState("done");
        } catch {
          if (!controller.signal.aborted) setState("error");
        }
      })();
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, searchDisabled]);

  function handleQueryChange(next: string) {
    setQuery(next);
    setResults([]);
    setState(next.trim().length >= 2 && !searchDisabled ? "loading" : "idle");
  }

  function applyManual() {
    const lat = Number(manualLat.replace(",", "."));
    const lng = Number(manualLng.replace(",", "."));
    const valid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    setManualError(!valid);
    if (!valid) return;
    onSelect({ label: null, center: { lat, lng }, radiusHintM: null });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel htmlFor="location-search">{t("wizard.location.searchLabel")}</FieldLabel>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="location-search"
            value={query}
            disabled={searchDisabled}
            autoComplete="off"
            placeholder={t("wizard.location.searchPlaceholder")}
            onChange={(event) => handleQueryChange(event.target.value)}
            className="pl-8"
          />
          {state === "loading" && canSearch ? (
            <Spinner className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          ) : null}
        </div>
        <FieldDescription>{t("wizard.location.searchHint")}</FieldDescription>
      </Field>

      {canSearch && state === "done" && results.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <ul className="flex flex-col overflow-hidden rounded-lg ring-1 ring-foreground/10">
            {results.map((suggestion, index) => (
              <li key={suggestion.providerPlaceId ?? `${suggestion.label}-${index}`}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 border-b border-border/60 bg-card px-3 py-2 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  onClick={() =>
                    onSelect({
                      label: suggestion.label,
                      center: suggestion.location,
                      radiusHintM: suggestion.viewport ? viewportRadiusMeters(suggestion.viewport) : null,
                    })
                  }
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{suggestion.label}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {suggestion.location.lat.toFixed(4)}, {suggestion.location.lng.toFixed(4)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <GoogleAttribution />
        </div>
      ) : null}

      {canSearch && state === "done" && results.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("wizard.location.searchEmpty")}</p>
      ) : null}
      {state === "error" ? <p className="text-xs text-muted-foreground">{t("wizard.location.searchFailed")}</p> : null}

      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
        <p className="text-xs font-medium text-muted-foreground">{t("wizard.location.manualTitle")}</p>
        <div className="flex flex-wrap items-end gap-2">
          <Field className="w-32">
            <FieldLabel htmlFor="manual-lat" className="text-xs">
              {t("wizard.location.latitude")}
            </FieldLabel>
            <Input
              id="manual-lat"
              inputMode="decimal"
              placeholder="41.0082"
              value={manualLat}
              aria-invalid={manualError}
              onChange={(event) => setManualLat(event.target.value)}
            />
          </Field>
          <Field className="w-32">
            <FieldLabel htmlFor="manual-lng" className="text-xs">
              {t("wizard.location.longitude")}
            </FieldLabel>
            <Input
              id="manual-lng"
              inputMode="decimal"
              placeholder="28.9784"
              value={manualLng}
              aria-invalid={manualError}
              onChange={(event) => setManualLng(event.target.value)}
            />
          </Field>
          <Button type="button" variant="outline" onClick={applyManual}>
            <Crosshair />
            {t("wizard.location.useCoordinates")}
          </Button>
        </div>
        {manualError ? <p className="text-xs text-destructive">{t("wizard.location.coordinatesInvalid")}</p> : null}
      </div>
    </div>
  );
}
