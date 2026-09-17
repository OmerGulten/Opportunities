/**
 * Shared primitive domain types. Mirrors the Postgres enums in
 * supabase/migrations/*_init.sql. Keep in sync when adding values.
 */

export type Locale = "tr" | "en";
export const LOCALES: readonly Locale[] = ["tr", "en"] as const;
export const DEFAULT_LOCALE: Locale = "tr";

export type WorkspaceRole = "owner" | "admin" | "member";

export type ScanStatus =
  | "created"
  | "queued"
  | "discovering"
  | "deduplicating"
  | "enriching"
  | "auditing"
  | "scoring"
  | "completed"
  | "partially_completed"
  | "failed"
  | "cancelled";

export const ACTIVE_SCAN_STATUSES: readonly ScanStatus[] = [
  "created",
  "queued",
  "discovering",
  "deduplicating",
  "enriching",
  "auditing",
  "scoring",
] as const;

export const TERMINAL_SCAN_STATUSES: readonly ScanStatus[] = [
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
] as const;

export type AuditDepth = "discovery" | "basic" | "deep";
export const AUDIT_DEPTH_ORDER: Record<AuditDepth, number> = {
  discovery: 0,
  basic: 1,
  deep: 2,
};

export type LocationMethod = "place" | "radius" | "polygon";

export type MessageChannel = "whatsapp" | "email" | "instagram_dm";

export type LeadStatus = "open" | "won" | "lost" | "archived";

export type CreditLedgerType =
  | "monthly_grant"
  | "purchase"
  | "reservation"
  | "consumption"
  | "refund"
  | "admin_adjustment"
  | "expiration";

/**
 * Explicit observation statuses. `not_checked` must never be rendered as `not_found`.
 */
export type ObservationStatus =
  | "found"
  | "not_found"
  | "not_checked"
  | "unavailable"
  | "error"
  | "ambiguous";

/** How a fact was obtained. Drives UI labelling ("Heuristic", "Unavailable"). */
export type EvidenceType = "observed" | "derived" | "heuristic" | "unavailable";

export type ConfidenceLevel = "high" | "medium" | "low";
export const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export type Tone = "friendly_professional" | "formal" | "casual" | "concise";
export const TONES: readonly Tone[] = ["friendly_professional", "formal", "casual", "concise"] as const;

export type MessageLength = "short" | "medium" | "long";

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** GeoJSON Polygon (outer ring only in the MVP). Coordinates are [lng, lat]. */
export interface GeoPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
