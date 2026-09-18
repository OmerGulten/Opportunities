import { beforeEach, describe, expect, it } from "vitest";

import { creditKeys, REFERENCE_TYPES } from "@/lib/credits/keys";
import { buildPricingTable, estimateBusinessCount, estimateScanCredits, perBusinessCost } from "@/lib/credits/pricing";
import { CreditService, ledgerQuantity } from "@/lib/credits/service";
import { createMemoryCreditStore } from "@/lib/credits/store.memory";
import { InsufficientCreditsError } from "@/lib/errors";
import { buildCoveragePlan } from "@/lib/providers/places/coverage";
import type { CreditPricingRuleRow } from "@/types/db";

/**
 * The billing sequence a scan actually performs, end to end against the
 * in-memory ledger: estimate, reserve, consume per business, release the
 * remainder.
 *
 * The properties under test are the ones a customer would notice if they broke:
 * a scan cannot outspend the balance, a crashed-and-replayed step cannot charge
 * twice, and nothing the scan did not use stays locked up.
 */

const WORKSPACE = "ws-1";
const SCAN = "scan-1";

const PRICING_ROWS = [
  { key: "discovery", cost: 1, unit: "per_business", active: true },
  { key: "basic_audit", cost: 2, unit: "per_business", active: true },
  { key: "deep_audit", cost: 4, unit: "per_business", active: true },
  { key: "ai_message", cost: 1, unit: "per_message", active: true },
  { key: "report", cost: 1, unit: "per_report", active: true },
  { key: "competitor_benchmark", cost: 3, unit: "per_business", active: true },
].map((row, index) => ({ ...row, id: `rule-${index}`, name: row.key })) as CreditPricingRuleRow[];

const pricing = buildPricingTable(PRICING_ROWS);

function scanCredits(service: CreditService) {
  return {
    reserve: (amount: number) =>
      service.reserve({
        workspaceId: WORKSPACE,
        amount,
        referenceType: REFERENCE_TYPES.scan,
        referenceId: SCAN,
        idempotencyKey: creditKeys.scanReserve(SCAN),
      }),
    consume: (businessId: string, amount: number) =>
      service.consume({
        workspaceId: WORKSPACE,
        amount,
        referenceType: REFERENCE_TYPES.scan,
        referenceId: SCAN,
        idempotencyKey: creditKeys.scanBusiness(SCAN, businessId),
      }),
    release: () =>
      service.releaseReservation({
        workspaceId: WORKSPACE,
        referenceType: REFERENCE_TYPES.scan,
        referenceId: SCAN,
        idempotencyKey: creditKeys.scanRelease(SCAN),
      }),
  };
}

describe("estimating a scan before it runs", () => {
  it("prices a Kadıköy-sized radius sweep from its coverage plan", () => {
    const plan = buildCoveragePlan({
      method: "radius",
      center: { lat: 40.9903, lng: 29.029 },
      radiusM: 5000,
      cellRadiusM: 800,
      maxCells: 50,
    });
    expect(plan.cells.length).toBeGreaterThan(1);

    const businesses = estimateBusinessCount({ cells: plan.cells.length, categories: 1, maxBusinesses: 100 });
    const estimate = estimateScanCredits({ estimatedBusinesses: businesses, depth: "basic", includeBenchmark: false }, pricing);

    // Discovery + basic audit, per business.
    expect(estimate.perBusiness).toBe(3);
    expect(estimate.total).toBe(3 * businesses);
    expect(estimate.breakdown.map((line) => line.key)).toEqual(["discovery", "basic_audit"]);
  });

  it("charges more for a deep audit and for the optional benchmark", () => {
    expect(perBusinessCost("discovery", pricing)).toBe(1);
    expect(perBusinessCost("basic", pricing)).toBe(3);
    expect(perBusinessCost("deep", pricing)).toBe(5);

    const withBenchmark = estimateScanCredits({ estimatedBusinesses: 10, depth: "deep", includeBenchmark: true }, pricing);
    expect(withBenchmark.subtotal).toBe(50);
    expect(withBenchmark.benchmark).toBe(30);
    expect(withBenchmark.total).toBe(80);
  });
});

describe("running a scan against the ledger", () => {
  let service: CreditService;
  let credits: ReturnType<typeof scanCredits>;

  beforeEach(() => {
    service = new CreditService(createMemoryCreditStore({ [WORKSPACE]: 100 }));
    credits = scanCredits(service);
  });

  it("reserves up front, consumes per business and refunds the remainder", async () => {
    // Estimated 20 businesses at 3 credits each.
    await credits.reserve(60);
    expect(await service.getBalance(WORKSPACE)).toMatchObject({ available: 40, reserved: 60 });

    // Only 12 were actually found and scored.
    for (let i = 0; i < 12; i++) await credits.consume(`business-${i}`, 3);

    const afterWork = await service.getBalance(WORKSPACE);
    // Consumption comes out of the reservation, so available is untouched.
    expect(afterWork.available).toBe(40);
    expect(afterWork.reserved).toBe(60 - 36);

    const release = await credits.release();
    expect(release.refunded).toBe(24);

    const final = await service.getBalance(WORKSPACE);
    expect(final.available).toBe(64); // 100 - 36 actually used
    expect(final.reserved).toBe(0);
  });

  it("charges a replayed business step only once", async () => {
    await credits.reserve(60);

    const first = await credits.consume("business-a", 3);
    const replay = await credits.consume("business-a", 3);

    // The same idempotency key returns the original entry, not a second charge.
    expect(replay.id).toBe(first.id);
    expect(await service.getBalance(WORKSPACE)).toMatchObject({ available: 40, reserved: 57 });
  });

  it("refuses to start a scan the balance cannot cover", async () => {
    await expect(credits.reserve(500)).rejects.toBeInstanceOf(InsufficientCreditsError);
    expect(await service.getBalance(WORKSPACE)).toMatchObject({ available: 100, reserved: 0 });
  });

  it("releases the whole reservation when a scan is cancelled before any work", async () => {
    await credits.reserve(60);
    const release = await credits.release();

    expect(release.refunded).toBe(60);
    expect(await service.getBalance(WORKSPACE)).toMatchObject({ available: 100, reserved: 0 });
  });

  it("is safe to release twice, as cancel and finalize both do", async () => {
    await credits.reserve(60);
    await credits.consume("business-a", 3);

    const first = await credits.release();
    const second = await credits.release();

    expect(first).toEqual({ refunded: 57, applied: true });
    // The replay reports the same total but applies nothing, which is why
    // callers must assign this figure rather than add to it.
    expect(second).toEqual({ refunded: 57, applied: false });
    expect(await service.getBalance(WORKSPACE)).toMatchObject({ available: 97, reserved: 0 });
  });

  it("does not move any credits on a repeated release", async () => {
    await credits.reserve(60);
    await credits.consume("business-a", 3);

    await credits.release();
    const afterFirst = await service.getBalance(WORKSPACE);
    await credits.release();
    await credits.release();

    expect(await service.getBalance(WORKSPACE)).toEqual(afterFirst);
    const refunds = (await service.getLedger(WORKSPACE, { limit: 50 })).filter((entry) => entry.type === "refund");
    expect(refunds).toHaveLength(1);
  });

  it("keeps the ledger as a complete, immutable account of the scan", async () => {
    await credits.reserve(60);
    await credits.consume("business-a", 3);
    await credits.consume("business-b", 3);
    await credits.release();

    const ledger = await service.getLedger(WORKSPACE, { limit: 50 });
    const types = ledger.map((entry) => entry.type);
    expect(types).toContain("reservation");
    expect(types.filter((type) => type === "consumption")).toHaveLength(2);
    expect(types).toContain("refund");

    // Every entry records the balance it produced, so the history reconciles.
    const newest = ledger[0];
    expect(newest.balance_after).toBe(94);
    expect(newest.reserved_after).toBe(0);
  });

  it("records a reservation-backed consumption with amount 0 and the real quantity in metadata", async () => {
    await credits.reserve(60);
    await credits.consume("business-a", 3);

    const entry = (await service.getLedger(WORKSPACE, { limit: 10 })).find((row) => row.type === "consumption")!;

    // The credits left the available balance when they were reserved, so this
    // entry moves nothing: its signed amount is 0 and only `reserved` drops.
    expect(entry.amount).toBe(0);
    expect(entry.reserved_after).toBe(57);
    // Anything reporting "credits used" must read the quantity, not the amount,
    // or it will report zero for every scan.
    expect(ledgerQuantity(entry)).toBe(3);
  });

  it("reports what the scan actually used", async () => {
    await credits.reserve(60);
    for (let i = 0; i < 5; i++) await credits.consume(`business-${i}`, 3);
    await credits.release();

    const usage = await service.getUsage(WORKSPACE, { from: "1970-01-01T00:00:00.000Z", to: "2999-01-01T00:00:00.000Z" });
    expect(usage.consumed).toBe(15);
    expect(usage.refunded).toBe(45);
    expect(usage.byReferenceType[REFERENCE_TYPES.scan]).toBe(15);
  });
});
