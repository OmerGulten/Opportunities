import type { Json } from "@/types/common";
import type { RuleOperator } from "@/types/scoring";
import type { SignalValue } from "@/types/signals";

/**
 * Rule operator semantics (referenced from supabase/seed.sql).
 *
 * Every helper here is total: bad input never throws, it evaluates to `false`
 * (or `null` for coercions). Rules are admin-editable, so the engine must
 * survive any combination of operator, rule value and signal value.
 */

export const RULE_OPERATORS: readonly RuleOperator[] = [
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "in",
  "not_in",
  "exists",
  "not_exists",
  "between",
  "is_true",
  "is_false",
] as const;

export function isRuleOperator(value: unknown): value is RuleOperator {
  return typeof value === "string" && (RULE_OPERATORS as readonly string[]).includes(value);
}

/** Numbers and numeric strings ("4.5", " 12 ") become a finite number; anything else is `null`. */
export function coerceNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** true/false, "true"/"false" (any case), 1/0 and "1"/"0" become a boolean; anything else is `null`. */
export function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return null;
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/** Deterministic JSON with sorted object keys so structurally equal objects compare equal. */
function stableStringify(value: unknown): string | null {
  try {
    const serialized = JSON.stringify(value, (_key, current: unknown) => {
      if (current !== null && typeof current === "object" && !Array.isArray(current)) {
        const record = current as Record<string, unknown>;
        return Object.keys(record)
          .sort()
          .reduce<Record<string, unknown>>((acc, key) => {
            acc[key] = record[key];
            return acc;
          }, {});
      }
      return current;
    });
    return serialized === undefined ? null : serialized;
  } catch {
    return null;
  }
}

/**
 * Equality after coercion: numbers match numeric strings, booleans match
 * "true"/"false"/1/0, strings match exactly, objects match structurally.
 * `null` only equals `null`.
 */
export function looseEquals(a: unknown, b: unknown): boolean {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull || bNull) return aNull && bNull;

  if (isPrimitive(a) && isPrimitive(b)) {
    if (typeof a === "boolean" || typeof b === "boolean") {
      const left = coerceBoolean(a);
      const right = coerceBoolean(b);
      return left !== null && left === right;
    }
    if (typeof a === "number" || typeof b === "number") {
      const left = coerceNumber(a);
      const right = coerceNumber(b);
      return left !== null && left === right;
    }
    return a === b;
  }

  if (typeof a === "object" && typeof b === "object") {
    const left = stableStringify(a);
    const right = stableStringify(b);
    return left !== null && left === right;
  }

  return false;
}

function compareNumeric(signalValue: unknown, ruleValue: unknown, predicate: (a: number, b: number) => boolean): boolean {
  const left = coerceNumber(signalValue);
  const right = coerceNumber(ruleValue);
  if (left === null || right === null) return false;
  return predicate(left, right);
}

/**
 * Evaluates a single rule operator against a signal value.
 *
 * `exists` / `not_exists` only look at the value here; the engine additionally
 * gates them on the signal's observation status (see engine.ts).
 */
export function evaluateOperator(operator: RuleOperator, signalValue: SignalValue, ruleValue: Json | null): boolean {
  try {
    const hasValue = signalValue !== null && signalValue !== undefined;
    switch (operator) {
      case "eq":
        return looseEquals(signalValue, ruleValue);
      case "neq":
        // An unknown value cannot be asserted to differ from anything.
        return hasValue && !looseEquals(signalValue, ruleValue);
      case "lt":
        return compareNumeric(signalValue, ruleValue, (a, b) => a < b);
      case "lte":
        return compareNumeric(signalValue, ruleValue, (a, b) => a <= b);
      case "gt":
        return compareNumeric(signalValue, ruleValue, (a, b) => a > b);
      case "gte":
        return compareNumeric(signalValue, ruleValue, (a, b) => a >= b);
      case "in":
        return Array.isArray(ruleValue) && ruleValue.some((candidate) => looseEquals(signalValue, candidate));
      case "not_in":
        return Array.isArray(ruleValue) && hasValue && !ruleValue.some((candidate) => looseEquals(signalValue, candidate));
      case "between": {
        if (!Array.isArray(ruleValue) || ruleValue.length !== 2) return false;
        const value = coerceNumber(signalValue);
        const first = coerceNumber(ruleValue[0]);
        const second = coerceNumber(ruleValue[1]);
        if (value === null || first === null || second === null) return false;
        // Bounds are inclusive and accepted in either order.
        return value >= Math.min(first, second) && value <= Math.max(first, second);
      }
      case "exists":
        return hasValue;
      case "not_exists":
        return !hasValue;
      case "is_true":
        return coerceBoolean(signalValue) === true;
      case "is_false":
        return coerceBoolean(signalValue) === false;
      default:
        // Unknown operator (possible after a manual DB edit): a rule that can never match.
        return false;
    }
  } catch {
    return false;
  }
}
