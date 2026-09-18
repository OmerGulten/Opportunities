import { describe, expect, it } from "vitest";

import { ScanInvalidTransitionError } from "@/lib/errors";
import { ACTIVE_SCAN_STATUSES, TERMINAL_SCAN_STATUSES, type ScanStatus } from "@/types/common";

import { assertScanTransition, canTransition, finalStatusFor, isActiveScanStatus, isCancellable, isTerminalScanStatus, scanProgressPercent } from "./scan-state";

const ALL: ScanStatus[] = [...ACTIVE_SCAN_STATUSES, ...TERMINAL_SCAN_STATUSES];

describe("scan lifecycle transitions", () => {
  it("walks the happy path", () => {
    expect(canTransition("created", "queued")).toBe(true);
    expect(canTransition("queued", "discovering")).toBe(true);
    expect(canTransition("discovering", "deduplicating")).toBe(true);
    expect(canTransition("deduplicating", "auditing")).toBe(true);
    expect(canTransition("auditing", "scoring")).toBe(true);
    expect(canTransition("scoring", "completed")).toBe(true);
  });

  it("never leaves a terminal status", () => {
    for (const terminal of TERMINAL_SCAN_STATUSES) {
      for (const target of ALL) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it("allows cancelling any active scan and no finished one", () => {
    for (const status of ACTIVE_SCAN_STATUSES) expect(isCancellable(status)).toBe(true);
    for (const status of TERMINAL_SCAN_STATUSES) expect(isCancellable(status)).toBe(false);
  });

  it("rejects going backwards", () => {
    expect(canTransition("scoring", "discovering")).toBe(false);
    expect(canTransition("auditing", "queued")).toBe(false);
    expect(canTransition("discovering", "created")).toBe(false);
  });

  it("throws a typed error on an invalid transition", () => {
    expect(() => assertScanTransition("completed", "auditing")).toThrow(ScanInvalidTransitionError);
    expect(() => assertScanTransition("created", "queued")).not.toThrow();
  });

  it("classifies active and terminal statuses exhaustively", () => {
    for (const status of ALL) {
      expect(isActiveScanStatus(status)).toBe(!isTerminalScanStatus(status));
    }
  });
});

describe("finalStatusFor", () => {
  it("fails when discovery itself failed", () => {
    expect(finalStatusFor({ discovered: 0, failed: 3, scored: 0 }, true)).toBe("failed");
  });

  it("completes an empty area without calling it a failure", () => {
    // Finding nothing is a valid answer, not an error.
    expect(finalStatusFor({ discovered: 0, failed: 0, scored: 0 }, false)).toBe("completed");
  });

  it("completes when everything scored", () => {
    expect(finalStatusFor({ discovered: 10, failed: 0, scored: 10 }, false)).toBe("completed");
  });

  it("reports a partial result when some businesses failed", () => {
    expect(finalStatusFor({ discovered: 10, failed: 2, scored: 8 }, false)).toBe("partially_completed");
  });

  it("fails when every business failed", () => {
    expect(finalStatusFor({ discovered: 10, failed: 10, scored: 0 }, false)).toBe("failed");
  });
});

describe("scanProgressPercent", () => {
  const base = { discovered_count: 0, audited_count: 0, scored_count: 0, failed_count: 0 };

  it("reports 100 for any finished scan", () => {
    for (const status of TERMINAL_SCAN_STATUSES) {
      expect(scanProgressPercent({ ...base, status })).toBe(100);
    }
  });

  it("advances through the early phases", () => {
    expect(scanProgressPercent({ ...base, status: "created" })).toBe(0);
    expect(scanProgressPercent({ ...base, status: "queued" })).toBeLessThan(scanProgressPercent({ ...base, status: "discovering" }));
    expect(scanProgressPercent({ ...base, status: "discovering" })).toBeLessThan(scanProgressPercent({ ...base, status: "deduplicating" }));
  });

  it("tracks audit and scoring progress without ever claiming completion", () => {
    const half = scanProgressPercent({ status: "auditing", discovered_count: 10, audited_count: 5, scored_count: 3, failed_count: 0 });
    const most = scanProgressPercent({ status: "scoring", discovered_count: 10, audited_count: 10, scored_count: 9, failed_count: 0 });
    expect(half).toBeGreaterThan(25);
    expect(most).toBeGreaterThan(half);
    expect(most).toBeLessThanOrEqual(98);
  });

  it("counts failed businesses as processed so a scan cannot stall below 100", () => {
    const withFailures = scanProgressPercent({ status: "scoring", discovered_count: 10, audited_count: 10, scored_count: 6, failed_count: 4 });
    const withoutFailures = scanProgressPercent({ status: "scoring", discovered_count: 10, audited_count: 10, scored_count: 6, failed_count: 0 });
    expect(withFailures).toBeGreaterThan(withoutFailures);
  });
});
