import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatMoney, isDue } from "./format";

describe("pipeline presentation helpers", () => {
  describe("isDue", () => {
    const now = Date.parse("2026-09-18T12:00:00.000Z");

    it("treats a past reminder as due", () => {
      expect(isDue("2026-09-18T11:59:59.000Z", now)).toBe(true);
    });

    it("treats the exact moment as due", () => {
      expect(isDue("2026-09-18T12:00:00.000Z", now)).toBe(true);
    });

    it("treats a future reminder as not due", () => {
      expect(isDue("2026-09-18T12:00:01.000Z", now)).toBe(false);
    });

    it("is false when no reminder is set, which is not the same as overdue", () => {
      expect(isDue(null, now)).toBe(false);
      expect(isDue(undefined, now)).toBe(false);
    });

    it("is false for an unparseable value rather than throwing", () => {
      expect(isDue("not-a-date", now)).toBe(false);
    });
  });

  describe("formatDate", () => {
    it("returns null for missing or invalid input so callers can say 'none'", () => {
      expect(formatDate(null, "tr")).toBeNull();
      expect(formatDate(undefined, "en")).toBeNull();
      expect(formatDate("nonsense", "tr")).toBeNull();
    });

    it("formats the same instant differently per locale", () => {
      const tr = formatDate("2026-09-18T12:00:00.000Z", "tr");
      const en = formatDate("2026-09-18T12:00:00.000Z", "en");
      expect(tr).toBeTruthy();
      expect(en).toBeTruthy();
      expect(tr).not.toEqual(en);
    });

    it("includes a time component only in formatDateTime", () => {
      const date = formatDate("2026-09-18T12:00:00.000Z", "en") ?? "";
      const dateTime = formatDateTime("2026-09-18T12:00:00.000Z", "en") ?? "";
      expect(dateTime.length).toBeGreaterThan(date.length);
    });
  });

  describe("formatMoney", () => {
    it("returns null when there is no amount, so the UI can say so explicitly", () => {
      expect(formatMoney(null, "TRY", "tr")).toBeNull();
      expect(formatMoney(undefined, "TRY", "tr")).toBeNull();
    });

    it("formats zero rather than treating it as missing", () => {
      expect(formatMoney(0, "TRY", "tr")).toContain("0");
    });

    it("renders the requested currency", () => {
      expect(formatMoney(1500, "EUR", "en")).toContain("€");
    });
  });
});
