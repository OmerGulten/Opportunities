import { describe, expect, it } from "vitest";

import { activeFilterCount, parseListSearchParams } from "./search-params";

const SERVICE_ID = "6f0f2b3a-1d5f-4c3a-9d6b-1f2e3a4b5c6d";

describe("parseListSearchParams", () => {
  it("falls back to the schema defaults when nothing is in the URL", () => {
    const filters = parseListSearchParams({});
    expect(filters.sort).toBe("score_desc");
    expect(filters.limit).toBe(25);
    expect(filters.offset).toBe(0);
    expect(filters.website).toBe("any");
    expect(filters.instagram).toBe("any");
    expect(filters.pipeline).toBe("any");
    expect(filters.gaps).toEqual([]);
    expect(filters.includeIgnored).toBe(false);
  });

  it("drops empty values so a cleared uuid filter does not fail validation", () => {
    const filters = parseListSearchParams({ serviceId: "", city: "   ", q: "" });
    expect(filters.serviceId).toBeUndefined();
    expect(filters.city).toBeUndefined();
    expect(filters.q).toBeUndefined();
  });

  it("accepts gaps as a comma separated value or as repeated params", () => {
    expect(parseListSearchParams({ gaps: "no_website,low_reviews" }).gaps).toEqual(["no_website", "low_reviews"]);
    expect(parseListSearchParams({ gaps: ["no_website", "no_https"] }).gaps).toEqual(["no_website", "no_https"]);
  });

  it("coerces numeric and boolean filters", () => {
    const filters = parseListSearchParams({
      minScore: "40",
      maxScore: "90",
      minServiceScore: "60",
      serviceId: SERVICE_ID,
      includeIgnored: "true",
      limit: "50",
      offset: "50",
    });
    expect(filters.minScore).toBe(40);
    expect(filters.maxScore).toBe(90);
    expect(filters.minServiceScore).toBe(60);
    expect(filters.serviceId).toBe(SERVICE_ID);
    expect(filters.includeIgnored).toBe(true);
    expect(filters.limit).toBe(50);
    expect(filters.offset).toBe(50);
  });

  it("returns the defaults instead of throwing on an unparsable URL", () => {
    const filters = parseListSearchParams({ sort: "not-a-sort", website: "nonsense" });
    expect(filters.sort).toBe("score_desc");
    expect(filters.website).toBe("any");
  });
});

describe("activeFilterCount", () => {
  it("does not count sorting or pagination", () => {
    expect(activeFilterCount(parseListSearchParams({ sort: "name_asc", limit: "100", offset: "25" }))).toBe(0);
  });

  it("counts each applied filter, including every selected gap", () => {
    const filters = parseListSearchParams({
      q: "kuafor",
      website: "not_found",
      gaps: "no_website,low_reviews",
      includeIgnored: "true",
    });
    expect(activeFilterCount(filters)).toBe(5);
  });
});
