import { beforeEach, describe, expect, it } from "vitest";

import { creditKeys, REFERENCE_TYPES } from "@/lib/credits/keys";
import { CreditService, consumedQuantity } from "@/lib/credits/service";
import { createMemoryCreditStore } from "@/lib/credits/store.memory";

/**
 * Unlimited accounts: internal and owner workspaces that are never billed.
 *
 * The point of the flag is that usage stays *observable* while billing stops.
 * A scan on an unlimited account must still leave a complete ledger trail and
 * still report what it used — it simply never moves a balance and never fails
 * for want of credits.
 *
 * This mirrors public.credit_apply_scoped, which short-circuits before ever
 * reaching credit_apply. The paying path is left untouched, and the tests below
 * assert both sides of that split.
 */

const FREE = "ws-internal";
const PAID = "ws-customer";
const SCAN = "scan-1";

function setup() {
  const store = createMemoryCreditStore({ [PAID]: 10 }, { unlimitedWorkspaceIds: [FREE] });
  return { store, service: new CreditService(store) };
}

function ops(service: CreditService, workspaceId: string) {
  return {
    reserve: (amount: number) =>
      service.reserve({
        workspaceId,
        amount,
        referenceType: REFERENCE_TYPES.scan,
        referenceId: SCAN,
        idempotencyKey: creditKeys.scanReserve(SCAN),
      }),
    consume: (businessId: string, amount: number) =>
      service.consume({
        workspaceId,
        amount,
        referenceType: REFERENCE_TYPES.scan,
        referenceId: SCAN,
        idempotencyKey: creditKeys.scanBusiness(SCAN, businessId),
      }),
    release: () =>
      service.releaseReservation({
        workspaceId,
        referenceType: REFERENCE_TYPES.scan,
        referenceId: SCAN,
        idempotencyKey: creditKeys.scanRelease(SCAN),
      }),
  };
}

describe("an unlimited account", () => {
  let service: CreditService;
  let free: ReturnType<typeof ops>;

  beforeEach(() => {
    service = setup().service;
    free = ops(service, FREE);
  });

  it("reports itself as unlimited", async () => {
    expect(await service.getBalance(FREE)).toMatchObject({ unlimited: true });
  });

  it("runs a whole scan without moving the balance", async () => {
    await free.reserve(600);
    for (let i = 0; i < 20; i++) await free.consume(`business-${i}`, 3);
    await free.release();

    const balance = await service.getBalance(FREE);
    expect(balance.available).toBe(0);
    expect(balance.reserved).toBe(0);
    expect(balance.unlimited).toBe(true);
  });

  it("reserves far beyond any balance without failing", async () => {
    // A paid account with 0 credits could not do this.
    await expect(free.reserve(10_000_000)).resolves.toBeDefined();
  });

  it("still records every operation in the ledger", async () => {
    await free.reserve(60);
    await free.consume("business-a", 3);
    await free.consume("business-b", 3);

    const ledger = await service.getLedger(FREE, { limit: 50 });
    const types = ledger.map((entry) => entry.type);
    expect(types).toContain("reservation");
    expect(types.filter((type) => type === "consumption")).toHaveLength(2);
    for (const entry of ledger) {
      expect(entry.amount).toBe(0);
      expect(entry.metadata.unlimited).toBe(true);
    }
  });

  it("still reports the credits a scan would have cost", async () => {
    await free.reserve(60);
    await free.consume("business-a", 3);
    await free.consume("business-b", 4);

    const usage = await service.getUsage(FREE, { from: "1970-01-01T00:00:00.000Z", to: "2999-01-01T00:00:00.000Z" });
    // Nothing was billed, but what the work would have cost is still visible.
    expect(usage.consumed).toBe(7);

    const consumption = (await service.getLedger(FREE, { limit: 50 })).filter((entry) => entry.type === "consumption");
    expect(consumption.map(consumedQuantity)).toEqual([4, 3]);
  });

  it("is still idempotent on a replayed step", async () => {
    const first = await free.consume("business-a", 3);
    const replay = await free.consume("business-a", 3);

    expect(replay.id).toBe(first.id);
    const consumption = (await service.getLedger(FREE, { limit: 50 })).filter((entry) => entry.type === "consumption");
    expect(consumption).toHaveLength(1);
  });

  it("has nothing to refund, because nothing was ever held", async () => {
    await free.reserve(60);
    await expect(free.release()).resolves.toEqual({ refunded: 0, applied: false });
  });
});

describe("a normal account is unaffected", () => {
  let service: CreditService;
  let paid: ReturnType<typeof ops>;

  beforeEach(() => {
    service = setup().service;
    paid = ops(service, PAID);
  });

  it("is not marked unlimited", async () => {
    expect(await service.getBalance(PAID)).toMatchObject({ unlimited: false, available: 10 });
  });

  it("still moves its balance and still refuses what it cannot afford", async () => {
    await paid.reserve(9);
    expect(await service.getBalance(PAID)).toMatchObject({ available: 1, reserved: 9 });

    await expect(
      service.reserve({
        workspaceId: PAID,
        amount: 500,
        referenceType: REFERENCE_TYPES.scan,
        referenceId: "scan-2",
        idempotencyKey: creditKeys.scanReserve("scan-2"),
      }),
    ).rejects.toMatchObject({ code: "insufficient_credits" });
  });

  it("writes real signed amounts, not the unlimited placeholder", async () => {
    await paid.reserve(9);
    const entry = (await service.getLedger(PAID, { limit: 10 }))[0];
    expect(entry.amount).toBe(-9);
    expect(entry.metadata.unlimited).toBeUndefined();
  });
});
