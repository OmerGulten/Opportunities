import { describe, expect, it } from "vitest";

import { DEFAULT_ANALYTICS_PRESET, isDateInput, optionalId, resolveAnalyticsRange, toDateInput } from "./range";

/**
 * The analytics range comes from the URL, so it is parsed from values anyone
 * can edit: the resolver must always produce a usable window instead of
 * throwing, and the server and the filter bar must agree on what that window is.
 */

const NOW = new Date("2026-09-18T09:30:00.000Z");

describe("resolveAnalyticsRange", () => {
  it("covers today plus the previous days for a preset", () => {
    const range = resolveAnalyticsRange({ preset: "d7" }, NOW);

    expect(range.preset).toBe("d7");
    expect(range.fromDate).toBe("2026-09-12");
    expect(range.toDate).toBe("2026-09-18");
    expect(range.fromIso).toBe("2026-09-12T00:00:00.000Z");
    // The end of the range is inclusive, so entries from today still count.
    expect(range.toIso).toBe("2026-09-18T23:59:59.999Z");
  });

  it("falls back to the default window when the preset is unknown", () => {
    const range = resolveAnalyticsRange({ preset: "yesterday" }, NOW);

    expect(range.preset).toBe(DEFAULT_ANALYTICS_PRESET);
    expect(range.fromDate).toBe("2026-08-20");
    expect(range.toDate).toBe("2026-09-18");
  });

  it("uses the typed dates for a custom range", () => {
    const range = resolveAnalyticsRange({ preset: "custom", from: "2026-01-01", to: "2026-01-31" }, NOW);

    expect(range.preset).toBe("custom");
    expect(range.fromIso).toBe("2026-01-01T00:00:00.000Z");
    expect(range.toIso).toBe("2026-01-31T23:59:59.999Z");
  });

  it("falls back when a custom range is incomplete, malformed or inverted", () => {
    const missing = resolveAnalyticsRange({ preset: "custom", from: "2026-01-01" }, NOW);
    const malformed = resolveAnalyticsRange({ preset: "custom", from: "01/01/2026", to: "2026-01-31" }, NOW);
    const inverted = resolveAnalyticsRange({ preset: "custom", from: "2026-02-01", to: "2026-01-01" }, NOW);

    for (const range of [missing, malformed, inverted]) {
      expect(range.preset).toBe(DEFAULT_ANALYTICS_PRESET);
      expect(range.toDate).toBe("2026-09-18");
    }
  });

  it("resolves a single day when from and to are equal", () => {
    const range = resolveAnalyticsRange({ preset: "custom", from: "2026-03-02", to: "2026-03-02" }, NOW);

    expect(range.fromIso).toBe("2026-03-02T00:00:00.000Z");
    expect(range.toIso).toBe("2026-03-02T23:59:59.999Z");
  });
});

describe("isDateInput", () => {
  it("accepts yyyy-mm-dd and rejects anything else", () => {
    expect(isDateInput("2026-09-18")).toBe(true);
    expect(isDateInput("2026-9-18")).toBe(false);
    expect(isDateInput("2026-13-40")).toBe(false);
    expect(isDateInput(null)).toBe(false);
    expect(isDateInput(undefined)).toBe(false);
  });
});

describe("toDateInput", () => {
  it("formats in UTC so the server and the browser agree", () => {
    expect(toDateInput(new Date("2026-09-18T23:45:00.000Z"))).toBe("2026-09-18");
  });
});

describe("optionalId", () => {
  it("keeps uuid-shaped values and drops everything else", () => {
    expect(optionalId("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe("3f2504e0-4f89-11d3-9a0c-0305e82c3301");
    expect(optionalId(["3f2504e0-4f89-11d3-9a0c-0305e82c3301", "other"])).toBe("3f2504e0-4f89-11d3-9a0c-0305e82c3301");
    expect(optionalId("' or 1=1 --")).toBeUndefined();
    expect(optionalId("")).toBeUndefined();
    expect(optionalId(undefined)).toBeUndefined();
  });
});
