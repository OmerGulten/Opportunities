import type { Json } from "@/types/common";

/**
 * Converts an arbitrary runtime value into a JSON-safe `Json` value for
 * persistence (jsonb columns) and for `ScoreReason.signalValue`.
 * Non-finite numbers, functions, symbols and unserialisable objects become `null`.
 */
export function toJsonValue(value: unknown): Json | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object") {
    try {
      const serialized = JSON.stringify(value);
      return serialized === undefined ? null : (JSON.parse(serialized) as Json);
    } catch {
      return null;
    }
  }
  return null;
}

/** Like `toJsonValue` but drops entries that cannot be represented. */
export function toJsonArray(values: readonly unknown[]): Json[] {
  const out: Json[] = [];
  for (const value of values) {
    const json = toJsonValue(value);
    if (json !== null) out.push(json);
  }
  return out;
}
