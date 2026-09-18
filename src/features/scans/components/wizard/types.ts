import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";

import type { createScanSchema, CreateScanInput } from "@/features/scans/schemas";

/**
 * Wizard form typing. The form holds the schema's *input* shape (defaults are
 * still optional there) and `handleSubmit` hands over the parsed output, so the
 * payload posted to `/api/scans` is exactly what the server would accept.
 */
export type ScanFormValues = z.input<typeof createScanSchema>;
export type ScanFormApi = UseFormReturn<ScanFormValues, unknown, CreateScanInput>;

export interface CategoryOption {
  id: string;
  key: string;
  /** Already localized for the request locale. */
  name: string;
  icon: string | null;
}

export interface ServiceOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
}

export interface ScanLimits {
  maxBusinesses: number;
  minRadiusM: number;
  maxRadiusM: number;
  maxPolygonAreaKm2: number;
  defaultCellRadiusM: number;
}
