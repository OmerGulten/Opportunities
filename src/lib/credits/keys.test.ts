import { describe, expect, it } from "vitest";

import { creditKeys, formatGrantPeriod, REFERENCE_TYPES } from "./keys";

describe("creditKeys", () => {
  it("produces stable, distinct keys per operation", () => {
    expect(creditKeys.scanReserve("s1")).toBe("scan:s1:reserve");
    expect(creditKeys.scanBusiness("s1", "b1")).toBe("scan:s1:business:b1");
    expect(creditKeys.scanRelease("s1")).toBe("scan:s1:release");
    expect(creditKeys.aiMessage("g1")).toBe("message:g1");
    expect(creditKeys.report("r1")).toBe("report:r1");
    expect(creditKeys.benchmark("b1", "s1")).toBe("benchmark:b1:s1");
    expect(creditKeys.purchase("p1")).toBe("purchase:p1");
    expect(creditKeys.adminAdjustment("a1")).toBe("admin:a1");
  });

  it("matches the monthly grant key written by create_workspace_with_defaults", () => {
    const ws = "11111111-1111-4111-8111-111111111111";
    expect(creditKeys.monthlyGrant(ws, formatGrantPeriod(new Date("2026-09-18T23:30:00.000Z")))).toBe(`grant:${ws}:2026-09`);
    expect(formatGrantPeriod(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01");
    expect(formatGrantPeriod(new Date("2025-12-31T23:59:59.000Z"))).toBe("2025-12");
  });

  it("exposes the reference type vocabulary", () => {
    expect(REFERENCE_TYPES).toEqual({ scan: "scan", message: "message", report: "report", plan: "plan", purchase: "purchase", admin: "admin" });
  });
});
