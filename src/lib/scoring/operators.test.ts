import { describe, expect, it } from "vitest";

import type { Json } from "@/types/common";
import type { RuleOperator } from "@/types/scoring";

import { coerceBoolean, coerceNumber, evaluateOperator, isRuleOperator, looseEquals, RULE_OPERATORS } from "./operators";

describe("coerceNumber", () => {
  it("accepts finite numbers and numeric strings", () => {
    expect(coerceNumber(4.5)).toBe(4.5);
    expect(coerceNumber(0)).toBe(0);
    expect(coerceNumber("12")).toBe(12);
    expect(coerceNumber(" 3.25 ")).toBe(3.25);
    expect(coerceNumber("-7")).toBe(-7);
  });

  it("rejects everything else", () => {
    expect(coerceNumber("")).toBeNull();
    expect(coerceNumber("   ")).toBeNull();
    expect(coerceNumber("abc")).toBeNull();
    expect(coerceNumber(Number.NaN)).toBeNull();
    expect(coerceNumber(Number.POSITIVE_INFINITY)).toBeNull();
    expect(coerceNumber(true)).toBeNull();
    expect(coerceNumber(null)).toBeNull();
    expect(coerceNumber(undefined)).toBeNull();
    expect(coerceNumber({ value: 1 })).toBeNull();
    expect(coerceNumber([1])).toBeNull();
  });
});

describe("coerceBoolean", () => {
  it("accepts booleans, true/false strings and 1/0", () => {
    expect(coerceBoolean(true)).toBe(true);
    expect(coerceBoolean(false)).toBe(false);
    expect(coerceBoolean("true")).toBe(true);
    expect(coerceBoolean(" TRUE ")).toBe(true);
    expect(coerceBoolean("false")).toBe(false);
    expect(coerceBoolean(1)).toBe(true);
    expect(coerceBoolean(0)).toBe(false);
    expect(coerceBoolean("1")).toBe(true);
    expect(coerceBoolean("0")).toBe(false);
  });

  it("rejects everything else", () => {
    expect(coerceBoolean("yes")).toBeNull();
    expect(coerceBoolean("")).toBeNull();
    expect(coerceBoolean(2)).toBeNull();
    expect(coerceBoolean(null)).toBeNull();
    expect(coerceBoolean(undefined)).toBeNull();
    expect(coerceBoolean({})).toBeNull();
  });
});

describe("looseEquals", () => {
  it("compares numbers with numeric strings", () => {
    expect(looseEquals(4, "4")).toBe(true);
    expect(looseEquals("4.0", 4)).toBe(true);
    expect(looseEquals(4, "5")).toBe(false);
    expect(looseEquals(4, "abc")).toBe(false);
  });

  it("compares booleans with their string and numeric forms", () => {
    expect(looseEquals(true, "true")).toBe(true);
    expect(looseEquals("false", false)).toBe(true);
    expect(looseEquals(true, 1)).toBe(true);
    expect(looseEquals(false, "yes")).toBe(false);
  });

  it("compares strings exactly", () => {
    expect(looseEquals("weak", "weak")).toBe(true);
    expect(looseEquals("Weak", "weak")).toBe(false);
  });

  it("treats null as equal only to null", () => {
    expect(looseEquals(null, null)).toBe(true);
    expect(looseEquals(undefined, null)).toBe(true);
    expect(looseEquals(null, "x")).toBe(false);
    expect(looseEquals(0, null)).toBe(false);
  });

  it("compares objects structurally regardless of key order", () => {
    expect(looseEquals({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 })).toBe(true);
    expect(looseEquals({ a: 1 }, { a: 2 })).toBe(false);
    expect(looseEquals([1, 2], [1, 2])).toBe(true);
    expect(looseEquals({ a: 1 }, "x")).toBe(false);
  });
});

describe("evaluateOperator", () => {
  it("eq / neq", () => {
    expect(evaluateOperator("eq", "weak", "weak")).toBe(true);
    expect(evaluateOperator("eq", "strong", "weak")).toBe(false);
    expect(evaluateOperator("eq", 4, "4")).toBe(true);
    expect(evaluateOperator("eq", true, "true")).toBe(true);
    expect(evaluateOperator("eq", null, null)).toBe(true);
    expect(evaluateOperator("eq", { a: 1 }, { a: 1 })).toBe(true);

    expect(evaluateOperator("neq", "found", "not_found")).toBe(true);
    expect(evaluateOperator("neq", 5, "5")).toBe(false);
    // An unknown value cannot be asserted to differ.
    expect(evaluateOperator("neq", null, "x")).toBe(false);
  });

  it("lt / lte / gt / gte are numeric with coercion", () => {
    expect(evaluateOperator("lt", 3.9, 4.0)).toBe(true);
    expect(evaluateOperator("lt", 4.0, 4.0)).toBe(false);
    expect(evaluateOperator("lte", 4.0, 4.0)).toBe(true);
    expect(evaluateOperator("gt", "51", 50)).toBe(true);
    expect(evaluateOperator("gt", 50, "50")).toBe(false);
    expect(evaluateOperator("gte", 50, "50")).toBe(true);
    expect(evaluateOperator("gte", 49.99, 50)).toBe(false);
    expect(evaluateOperator("lt", "2", "10")).toBe(true);
  });

  it("numeric comparisons with non-numeric input are false", () => {
    expect(evaluateOperator("lt", "abc", 5)).toBe(false);
    expect(evaluateOperator("lt", true, 5)).toBe(false);
    expect(evaluateOperator("lt", null, 5)).toBe(false);
    expect(evaluateOperator("gt", 5, null)).toBe(false);
    expect(evaluateOperator("gte", 5, "many")).toBe(false);
    expect(evaluateOperator("lte", { value: 1 }, 5)).toBe(false);
    expect(evaluateOperator("lt", 5, [1, 2])).toBe(false);
  });

  it("in / not_in", () => {
    const noWebsite = ["not_found", "invalid", "unreachable"];
    expect(evaluateOperator("in", "invalid", noWebsite)).toBe(true);
    expect(evaluateOperator("in", "found", noWebsite)).toBe(false);
    expect(evaluateOperator("in", 5, ["5", "6"])).toBe(true);
    expect(evaluateOperator("in", "x", "x")).toBe(false);
    expect(evaluateOperator("in", null, noWebsite)).toBe(false);
    expect(evaluateOperator("in", null, [null])).toBe(true);

    expect(evaluateOperator("not_in", "found", noWebsite)).toBe(true);
    expect(evaluateOperator("not_in", "not_found", noWebsite)).toBe(false);
    expect(evaluateOperator("not_in", null, noWebsite)).toBe(false);
    expect(evaluateOperator("not_in", "found", "not_found")).toBe(false);
  });

  it("between is inclusive and tolerant of bound order", () => {
    expect(evaluateOperator("between", 4.1, [3.0, 4.2])).toBe(true);
    expect(evaluateOperator("between", 3.0, [3.0, 4.2])).toBe(true);
    expect(evaluateOperator("between", 4.2, [3.0, 4.2])).toBe(true);
    expect(evaluateOperator("between", 4.3, [3.0, 4.2])).toBe(false);
    expect(evaluateOperator("between", 2.9, [3.0, 4.2])).toBe(false);
    expect(evaluateOperator("between", 60, [89, 50])).toBe(true);
    expect(evaluateOperator("between", "60", ["50", "89"])).toBe(true);
  });

  it("between with bad bounds is false", () => {
    expect(evaluateOperator("between", 60, [50])).toBe(false);
    expect(evaluateOperator("between", 60, [50, 89, 100])).toBe(false);
    expect(evaluateOperator("between", 60, 50)).toBe(false);
    expect(evaluateOperator("between", 60, ["a", 89])).toBe(false);
    expect(evaluateOperator("between", "abc", [50, 89])).toBe(false);
    expect(evaluateOperator("between", null, [50, 89])).toBe(false);
  });

  it("exists / not_exists look at value presence", () => {
    expect(evaluateOperator("exists", "https://example.test", null)).toBe(true);
    expect(evaluateOperator("exists", 0, null)).toBe(true);
    expect(evaluateOperator("exists", "", null)).toBe(true);
    expect(evaluateOperator("exists", false, null)).toBe(true);
    expect(evaluateOperator("exists", null, null)).toBe(false);

    expect(evaluateOperator("not_exists", null, null)).toBe(true);
    expect(evaluateOperator("not_exists", 0, null)).toBe(false);
    expect(evaluateOperator("not_exists", "x", null)).toBe(false);
  });

  it("is_true / is_false coerce booleans", () => {
    expect(evaluateOperator("is_true", true, null)).toBe(true);
    expect(evaluateOperator("is_true", "true", null)).toBe(true);
    expect(evaluateOperator("is_true", 1, null)).toBe(true);
    expect(evaluateOperator("is_true", false, null)).toBe(false);
    expect(evaluateOperator("is_true", "yes", null)).toBe(false);
    expect(evaluateOperator("is_true", null, null)).toBe(false);

    expect(evaluateOperator("is_false", false, null)).toBe(true);
    expect(evaluateOperator("is_false", "false", null)).toBe(true);
    expect(evaluateOperator("is_false", 0, null)).toBe(true);
    expect(evaluateOperator("is_false", true, null)).toBe(false);
    expect(evaluateOperator("is_false", null, null)).toBe(false);
    expect(evaluateOperator("is_false", "no", null)).toBe(false);
  });

  it("unknown operators never match", () => {
    expect(evaluateOperator("regex" as RuleOperator, "x", "x")).toBe(false);
    expect(isRuleOperator("regex")).toBe(false);
    expect(isRuleOperator("between")).toBe(true);
    expect(RULE_OPERATORS).toHaveLength(13);
  });

  it("never throws on hostile input", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    for (const operator of RULE_OPERATORS) {
      expect(() => evaluateOperator(operator, circular, { a: 1 })).not.toThrow();
      expect(() => evaluateOperator(operator, "x", undefined as unknown as null)).not.toThrow();
    }
    // A self-referencing object is not valid Json; the cast is the point of the test.
    expect(evaluateOperator("eq", circular, circular as unknown as Json)).toBe(false);
  });
});
