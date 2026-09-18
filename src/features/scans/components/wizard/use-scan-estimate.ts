"use client";

import { useEffect, useRef, useState } from "react";

import { createScanSchema, type CreateScanInput } from "@/features/scans/schemas";
import type { ScanEstimate } from "@/features/scans/service";

import type { EstimateStatus } from "../credit-estimate-panel";

interface EstimateResult {
  key: string;
  estimate: ScanEstimate | null;
  errorCode: string | null;
}

export interface ScanEstimateState {
  estimate: ScanEstimate | null;
  status: EstimateStatus;
  errorCode: string | null;
}

const DEBOUNCE_MS = 450;

/**
 * Keeps the coverage/credit estimate in step with the form.
 *
 * The request is debounced and re-issued whenever the area, the categories, the
 * depth or the benchmark option change — the inputs `estimateScan` actually
 * prices. While a refresh is in flight the previous figures stay on screen,
 * marked as refreshing, instead of collapsing to a skeleton.
 *
 * `values` is typed `unknown` because it arrives from a partly-filled form:
 * the hook validates it with `createScanSchema` and simply does not price an
 * incomplete draft, so a narrower type would only add a cast at the call site.
 */
export function useScanEstimate(values: unknown, enabled: boolean): ScanEstimateState {
  const parsed = createScanSchema.safeParse(values);
  const payload = parsed.success ? parsed.data : null;
  const key = enabled && payload ? estimateKey(payload) : "";

  const [result, setResult] = useState<EstimateResult>({ key: "", estimate: null, errorCode: null });

  const payloadRef = useRef<CreateScanInput | null>(payload);
  useEffect(() => {
    payloadRef.current = payload;
  });

  useEffect(() => {
    if (key === "") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        const body = payloadRef.current;
        if (!body) return;
        try {
          const response = await fetch("/api/scans/estimate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          const data = (await response.json()) as { data?: ScanEstimate; error?: { code?: string } };
          if (!response.ok) {
            setResult({ key, estimate: null, errorCode: data.error?.code ?? "internal_error" });
            return;
          }
          setResult({ key, estimate: data.data ?? null, errorCode: null });
        } catch {
          if (!controller.signal.aborted) setResult({ key, estimate: null, errorCode: "internal_error" });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  if (key === "") return { estimate: null, status: "idle", errorCode: null };
  if (result.key !== key) return { estimate: result.estimate, status: "loading", errorCode: null };
  if (result.errorCode) return { estimate: null, status: "error", errorCode: result.errorCode };
  return { estimate: result.estimate, status: result.estimate ? "ready" : "idle", errorCode: null };
}

/**
 * Identity of a priced scan. `serviceIds` and `name` are deliberately absent:
 * the estimate does not depend on them, so picking another service must not
 * trigger a new provider-independent round trip.
 */
function estimateKey(payload: CreateScanInput): string {
  return JSON.stringify({
    locationMethod: payload.locationMethod,
    center: payload.center ?? null,
    radiusM: payload.radiusM ?? null,
    polygon: payload.polygon ?? null,
    categoryIds: [...payload.categoryIds].sort(),
    auditDepth: payload.auditDepth,
    maxBusinesses: payload.maxBusinesses,
    includeBenchmark: payload.filters.includeBenchmark,
  });
}
