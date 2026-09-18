import { describe, expect, it } from "vitest";

import { randomSuffix, slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with hyphens", () => {
    expect(slugify("Blue Agency")).toBe("blue-agency");
  });

  it("transliterates Turkish characters", () => {
    expect(slugify("Şişli Güzellik Merkezi")).toBe("sisli-guzellik-merkezi");
    expect(slugify("İstanbul Çiçekçi")).toBe("istanbul-cicekci");
    expect(slugify("ĞÖÜışç")).toBe("gouisc");
  });

  it("strips diacritics from latin characters", () => {
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  });

  it("collapses punctuation and repeated separators", () => {
    expect(slugify("A & B  ---  C!!")).toBe("a-b-c");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });

  it("falls back to 'workspace' when nothing remains", () => {
    expect(slugify("!!!")).toBe("workspace");
    expect(slugify("")).toBe("workspace");
    expect(slugify("   ")).toBe("workspace");
  });

  it("caps the slug at 48 characters", () => {
    const slug = slugify("a".repeat(120));
    expect(slug).toHaveLength(48);
  });

  it("is stable for input that is already a slug", () => {
    expect(slugify("already-a-slug-123")).toBe("already-a-slug-123");
  });

  it("keeps digits", () => {
    expect(slugify("Studio 54")).toBe("studio-54");
  });
});

describe("randomSuffix", () => {
  it("returns the requested length", () => {
    expect(randomSuffix()).toHaveLength(4);
    expect(randomSuffix(8)).toHaveLength(8);
  });

  it("only uses url-safe lowercase characters", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(randomSuffix(12)).toMatch(/^[a-z0-9]{12}$/);
    }
  });

  it("produces different values across calls", () => {
    const values = new Set(Array.from({ length: 50 }, () => randomSuffix(8)));
    expect(values.size).toBeGreaterThan(40);
  });
});
