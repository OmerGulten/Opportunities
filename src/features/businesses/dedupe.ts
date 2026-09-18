import { createHash } from "node:crypto";

import type { PlaceSummary } from "@/types/places";

/**
 * Deduplication of discovery results. Two passes:
 *  1. exact `(provider, providerPlaceId)`;
 *  2. canonical fingerprint (normalised name + address prefix + ~100 m grid),
 *     which catches the same venue listed twice or returned by different queries.
 * Pure; unit-tested. The workflow's dedupe step and the businesses table both
 * rely on `canonicalFingerprint` being stable across releases.
 */

const TR_FOLD: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  Ç: "c",
  Ğ: "g",
  İ: "i",
  I: "i",
  Ö: "o",
  Ş: "s",
  Ü: "u",
};

/** Lowercases with Turkish-aware transliteration and strips remaining diacritics. */
export function foldTurkish(input: string): string {
  return input
    .split("")
    .map((ch) => TR_FOLD[ch] ?? ch)
    .join("")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
}

/** Legal-form tokens stripped from the end of a company name. */
const LEGAL_SUFFIX_TOKENS = new Set(["ltd", "sti", "as", "tic", "san", "ve", "ltdsti", "limited", "sirketi", "anonim", "kollektif", "koll"]);

/**
 * Normalises a business name for matching: folded lowercase, punctuation
 * removed, whitespace collapsed, legal suffixes ("Ltd. Şti.", "A.Ş.", "San. Tic.")
 * stripped from the tail. `&` becomes a space so "Kahve & Kitap" == "Kahve Kitap".
 */
export function normalizeBusinessName(name: string): string {
  const folded = foldTurkish(name)
    // "A.Ş." / "A.S." -> "as" before punctuation removal splits it into "a s".
    .replace(/\ba\.\s*s\.?(?=\s|$)/g, " as ")
    .replace(/\bltd\.?\s*sti\.?/g, " ltd sti ")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = folded.split(" ").filter(Boolean);
  // Strip legal-form tokens from the tail only, so "As Kuaför" keeps its name.
  while (tokens.length > 1 && LEGAL_SUFFIX_TOKENS.has(tokens[tokens.length - 1]!)) tokens.pop();
  return tokens.join(" ");
}

const ADDRESS_ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\b(caddesi|cadde|cad|cd)\b/g, "cd"],
  [/\b(sokagi|sokak|sok|sk)\b/g, "sk"],
  [/\b(mahallesi|mahalle|mah|mh)\b/g, "mh"],
  [/\b(bulvari|bulvar|blv|bul)\b/g, "blv"],
  [/\b(apartmani|apartman|apt|ap)\b/g, "apt"],
  [/\b(numara|no)\b/g, "no"],
];

/**
 * Normalises a formatted address: folded lowercase, punctuation removed, common
 * Turkish street abbreviations unified ("Caddesi" == "Cad." == "Cd."), spaces
 * collapsed. Postal codes and the country are kept; they are cheap disambiguators.
 */
export function normalizeAddress(address: string): string {
  let out = foldTurkish(address)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pattern, replacement] of ADDRESS_ABBREVIATIONS) out = out.replace(pattern, replacement);
  return out.replace(/\s+/g, " ").trim();
}

export interface FingerprintInput {
  name: string;
  address: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
}

/** Stable fingerprint material; exported so tests and migrations can reason about it. */
export function fingerprintMaterial(input: FingerprintInput): string {
  const name = normalizeBusinessName(input.name);
  const address = input.address ? normalizeAddress(input.address).slice(0, 40) : "";
  const coords = typeof input.lat === "number" && typeof input.lng === "number" && Number.isFinite(input.lat) && Number.isFinite(input.lng) ? `${input.lat.toFixed(3)},${input.lng.toFixed(3)}` : "";
  return `${name}|${address}|${coords}`;
}

/** sha1 hex of `normalizedName|normalizedAddress[0..40]|lat.toFixed(3),lng.toFixed(3)`. */
export function canonicalFingerprint(input: FingerprintInput): string {
  return createHash("sha1").update(fingerprintMaterial(input), "utf8").digest("hex");
}

export function fingerprintOfPlace(place: PlaceSummary): string {
  return canonicalFingerprint({ name: place.displayName, address: place.formattedAddress, lat: place.location?.lat, lng: place.location?.lng });
}

export interface DedupeResult {
  unique: PlaceSummary[];
  duplicatesRemoved: number;
  byPlaceId: number;
  byFingerprint: number;
}

/** Keeps the first occurrence (discovery order) of each place. */
export function dedupePlaces(places: PlaceSummary[]): DedupeResult {
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const unique: PlaceSummary[] = [];
  let byPlaceId = 0;
  let byFingerprint = 0;

  for (const place of places) {
    const idKey = `${place.provider}:${place.providerPlaceId}`;
    if (seenIds.has(idKey)) {
      byPlaceId += 1;
      continue;
    }
    const fp = fingerprintOfPlace(place);
    if (seenFingerprints.has(fp)) {
      byFingerprint += 1;
      seenIds.add(idKey);
      continue;
    }
    seenIds.add(idKey);
    seenFingerprints.add(fp);
    unique.push(place);
  }

  return { unique, duplicatesRemoved: byPlaceId + byFingerprint, byPlaceId, byFingerprint };
}
