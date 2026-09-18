import { describe, expect, it } from "vitest";

import { ConflictError, InsufficientCreditsError, ValidationError } from "@/lib/errors";

import { creditKeys, REFERENCE_TYPES } from "./keys";
import { CreditService, QUANTITY_METADATA_KEY } from "./service";
import { createMemoryCreditStore } from "./store.memory";

const WS = "11111111-1111-4111-8111-111111111111";
const SCAN = "scan-1";

function setup(balance = 100, now?: () => Date) {
  const store = createMemoryCreditStore({ [WS]: balance }, now ? { now } : {});
  return { store, service: new CreditService(store) };
}

const scanRef = { referenceType: REFERENCE_TYPES.scan, referenceId: SCAN };

function reserveInput(amount: number, key = creditKeys.scanReserve(SCAN)) {
  return { workspaceId: WS, amount, ...scanRef, idempotencyKey: key };
}

function consumeInput(amount: number, businessId: string) {
  return { workspaceId: WS, amount, ...scanRef, idempotencyKey: creditKeys.scanBusiness(SCAN, businessId) };
}

describe("CreditService.reserve", () => {
  it("moves credits from available to reserved and records the reservation", async () => {
    const { service, store } = setup(100);
    const row = await service.reserve(reserveInput(30));

    expect(row.type).toBe("reservation");
    expect(row.amount).toBe(-30);
    expect(row.balance_after).toBe(70);
    expect(row.reserved_after).toBe(30);
    expect(row.metadata[QUANTITY_METADATA_KEY]).toBe(30);
    await expect(service.getBalance(WS)).resolves.toEqual({ available: 70, reserved: 30, lifetimeGranted: 100, lifetimeConsumed: 0 });

    const reservation = await store.getReservation(scanRef.referenceType, scanRef.referenceId);
    expect(reservation).toMatchObject({ reserved_amount: 30, consumed_amount: 0, refunded_amount: 0, status: "active" });
  });

  it("throws InsufficientCreditsError with required/available details and leaves the balance untouched", async () => {
    const { service } = setup(100);
    const err = await service.reserve(reserveInput(150)).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect((err as InsufficientCreditsError).details).toMatchObject({ required: 150, available: 100 });
    expect((err as InsufficientCreditsError).status).toBe(402);
    await expect(service.getBalance(WS)).resolves.toMatchObject({ available: 100, reserved: 0 });
  });
});

describe("CreditService.consume", () => {
  it("consumes from the reservation without touching available", async () => {
    const { service, store } = setup(100);
    await service.reserve(reserveInput(30));
    const row = await service.consume(consumeInput(10, "b1"));

    expect(row.type).toBe("consumption");
    expect(row.amount).toBe(0);
    expect(row.balance_after).toBe(70);
    expect(row.reserved_after).toBe(20);
    await expect(service.getBalance(WS)).resolves.toEqual({ available: 70, reserved: 20, lifetimeGranted: 100, lifetimeConsumed: 10 });
    expect(await store.getReservation(scanRef.referenceType, scanRef.referenceId)).toMatchObject({ consumed_amount: 10, status: "active" });
  });

  it("falls back to the available balance when the reservation remaining is too small", async () => {
    const { service } = setup(100);
    await service.reserve(reserveInput(30));
    await service.consume(consumeInput(25, "b1"));
    const row = await service.consume(consumeInput(10, "b2"));

    expect(row.amount).toBe(-10);
    expect(row.balance_after).toBe(60);
    expect(row.reserved_after).toBe(5);
    await expect(service.getBalance(WS)).resolves.toMatchObject({ available: 60, reserved: 5, lifetimeConsumed: 35 });
  });

  it("throws InsufficientCreditsError when neither reservation nor available covers the amount", async () => {
    const { service } = setup(5);
    const err = await service.consume(consumeInput(10, "b1")).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect((err as InsufficientCreditsError).details).toMatchObject({ required: 10, available: 5 });
  });
});

describe("CreditService.refund", () => {
  it("returns reserved credits to available and settles the reservation", async () => {
    const { service, store } = setup(100);
    await service.reserve(reserveInput(30));
    await service.consume(consumeInput(10, "b1"));
    const row = await service.refund({ workspaceId: WS, amount: 20, ...scanRef, idempotencyKey: "refund-1" });

    expect(row.type).toBe("refund");
    expect(row.amount).toBe(20);
    expect(row.balance_after).toBe(90);
    expect(row.reserved_after).toBe(0);
    expect(await store.getReservation(scanRef.referenceType, scanRef.referenceId)).toMatchObject({ refunded_amount: 20, status: "settled" });
  });

  it("throws ConflictError when the refund exceeds the reservation remaining", async () => {
    const { service } = setup(100);
    await service.reserve(reserveInput(30));
    await service.consume(consumeInput(10, "b1"));
    const err = await service.refund({ workspaceId: WS, amount: 25, ...scanRef, idempotencyKey: "refund-1" }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).details).toMatchObject({ remaining: 20, requested: 25 });
    await expect(service.getBalance(WS)).resolves.toMatchObject({ available: 70, reserved: 20 });
  });

  it("adds to available without touching reserved when no reservation exists (SQL behaviour)", async () => {
    const { service } = setup(100);
    const row = await service.refund({ workspaceId: WS, amount: 5, referenceType: "message", referenceId: "g1", idempotencyKey: "refund-orphan" });
    expect(row.amount).toBe(5);
    expect(row.balance_after).toBe(105);
    expect(row.reserved_after).toBe(0);
  });
});

describe("CreditService.releaseReservation", () => {
  it("refunds the remaining reservation and is idempotent for the same key", async () => {
    const { service, store } = setup(100);
    await service.reserve(reserveInput(30));
    await service.consume(consumeInput(12, "b1"));

    const release = { workspaceId: WS, ...scanRef, idempotencyKey: creditKeys.scanRelease(SCAN) };
    await expect(service.releaseReservation(release)).resolves.toEqual({ refunded: 18 });
    await expect(service.getBalance(WS)).resolves.toMatchObject({ available: 88, reserved: 0 });
    expect(await store.getReservation(scanRef.referenceType, scanRef.referenceId)).toMatchObject({ refunded_amount: 18, status: "settled" });

    const ledgerBefore = store.snapshot().ledger.length;
    await expect(service.releaseReservation(release)).resolves.toEqual({ refunded: 18 });
    expect(store.snapshot().ledger.length).toBe(ledgerBefore);
    await expect(service.getBalance(WS)).resolves.toMatchObject({ available: 88, reserved: 0 });
  });

  it("returns 0 and writes nothing when there is nothing to release", async () => {
    const { service, store } = setup(100);
    await expect(service.releaseReservation({ workspaceId: WS, ...scanRef, idempotencyKey: "rel-none" })).resolves.toEqual({ refunded: 0 });

    await service.reserve(reserveInput(10));
    await service.consume(consumeInput(10, "b1"));
    const before = store.snapshot().ledger.length;
    await expect(service.releaseReservation({ workspaceId: WS, ...scanRef, idempotencyKey: "rel-full" })).resolves.toEqual({ refunded: 0 });
    expect(store.snapshot().ledger.length).toBe(before);
  });
});

describe("idempotency", () => {
  it("replays the same key with the original row and applies the effect once", async () => {
    const { service, store } = setup(100);
    const first = await service.reserve(reserveInput(30));
    const replay = await service.reserve(reserveInput(30));

    expect(replay.id).toBe(first.id);
    expect(replay).toEqual(first);
    expect(store.snapshot().ledger).toHaveLength(1);
    await expect(service.getBalance(WS)).resolves.toMatchObject({ available: 70, reserved: 30 });

    const consumed = await service.consume(consumeInput(10, "b1"));
    const consumedAgain = await service.consume(consumeInput(10, "b1"));
    expect(consumedAgain.id).toBe(consumed.id);
    await expect(service.getBalance(WS)).resolves.toMatchObject({ available: 70, reserved: 20, lifetimeConsumed: 10 });
  });
});

describe("grant / debit / expire", () => {
  it("grant adds to available and lifetime granted", async () => {
    const { service } = setup(0);
    const row = await service.grant({
      workspaceId: WS,
      amount: 50,
      type: "monthly_grant",
      referenceType: REFERENCE_TYPES.plan,
      referenceId: "starter",
      idempotencyKey: creditKeys.monthlyGrant(WS, "2026-09"),
    });
    expect(row.type).toBe("monthly_grant");
    expect(row.amount).toBe(50);
    await expect(service.getBalance(WS)).resolves.toEqual({ available: 50, reserved: 0, lifetimeGranted: 50, lifetimeConsumed: 0 });
  });

  it("admin grant forces direction=credit even when the caller passes debit", async () => {
    const { service } = setup(10);
    const row = await service.grant({
      workspaceId: WS,
      amount: 5,
      type: "admin_adjustment",
      referenceType: REFERENCE_TYPES.admin,
      referenceId: "adj-1",
      idempotencyKey: creditKeys.adminAdjustment("adj-1"),
      metadata: { direction: "debit", note: "goodwill" },
    });
    expect(row.metadata).toMatchObject({ direction: "credit", note: "goodwill" });
    expect(row.amount).toBe(5);
    expect(row.balance_after).toBe(15);
  });

  it("debit is an admin adjustment clamped to the available balance", async () => {
    const { service } = setup(10);
    const row = await service.debit({ workspaceId: WS, amount: 25, referenceType: REFERENCE_TYPES.admin, referenceId: "adj-2", idempotencyKey: creditKeys.adminAdjustment("adj-2") });
    expect(row.type).toBe("admin_adjustment");
    expect(row.metadata.direction).toBe("debit");
    expect(row.amount).toBe(-10);
    expect(row.balance_after).toBe(0);
    await expect(service.getBalance(WS)).resolves.toMatchObject({ available: 0, lifetimeGranted: 10 });
  });

  it("expire clamps to available and never touches reserved", async () => {
    const { service } = setup(40);
    await service.reserve(reserveInput(30));
    const row = await service.expire({ workspaceId: WS, amount: 25, referenceType: REFERENCE_TYPES.plan, referenceId: "2026-08", idempotencyKey: "expire-2026-08" });
    expect(row.type).toBe("expiration");
    expect(row.amount).toBe(-10);
    expect(row.balance_after).toBe(0);
    expect(row.reserved_after).toBe(30);
  });

  it("rejects unsupported grant types", async () => {
    const { service } = setup(0);
    await expect(
      service.grant({
        workspaceId: WS,
        amount: 5,
        type: "refund" as unknown as "purchase",
        referenceType: REFERENCE_TYPES.purchase,
        referenceId: "p1",
        idempotencyKey: "k",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("validation", () => {
  it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects amount %p", async (amount) => {
    const { service } = setup(100);
    await expect(service.reserve(reserveInput(amount))).rejects.toBeInstanceOf(ValidationError);
    await expect(service.consume({ ...consumeInput(1, "b"), amount })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.refund({ ...reserveInput(1, "r"), amount })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects missing identifiers", async () => {
    const { service } = setup(100);
    await expect(service.reserve(reserveInput(1, ""))).rejects.toBeInstanceOf(ValidationError);
    await expect(service.reserve({ ...reserveInput(1), workspaceId: " " })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.releaseReservation({ workspaceId: WS, referenceType: "", referenceId: SCAN, idempotencyKey: "k" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns a zero balance for an unknown workspace", async () => {
    const { service } = setup(100);
    await expect(service.getBalance("other")).resolves.toEqual({ available: 0, reserved: 0, lifetimeGranted: 0, lifetimeConsumed: 0 });
  });
});

describe("CreditService.getUsage", () => {
  function clock(start: string) {
    let current = new Date(start);
    return { now: () => current, set: (iso: string) => (current = new Date(iso)) };
  }

  it("aggregates consumption, grants and refunds in the half-open range with UTC days", async () => {
    const c = clock("2026-09-01T10:00:00.000Z");
    const { service } = setup(100, c.now);

    await service.grant({ workspaceId: WS, amount: 50, type: "monthly_grant", referenceType: REFERENCE_TYPES.plan, referenceId: "starter", idempotencyKey: "g1" });
    await service.reserve(reserveInput(20));
    await service.consume(consumeInput(5, "b1"));
    await service.consume(consumeInput(3, "b2"));

    c.set("2026-09-02T09:00:00.000Z");
    await service.consume({ workspaceId: WS, amount: 4, referenceType: REFERENCE_TYPES.message, referenceId: "gen-1", idempotencyKey: creditKeys.aiMessage("gen-1") });
    await service.releaseReservation({ workspaceId: WS, ...scanRef, idempotencyKey: creditKeys.scanRelease(SCAN) });

    c.set("2026-09-03T23:59:59.000Z");
    await service.grant({ workspaceId: WS, amount: 10, type: "purchase", referenceType: REFERENCE_TYPES.purchase, referenceId: "pay-1", idempotencyKey: creditKeys.purchase("pay-1") });

    c.set("2026-09-05T00:00:00.000Z");
    await service.consume({ workspaceId: WS, amount: 2, referenceType: REFERENCE_TYPES.report, referenceId: "r1", idempotencyKey: creditKeys.report("r1") });

    const usage = await service.getUsage(WS, { from: "2026-09-01T00:00:00.000Z", to: "2026-09-04T00:00:00.000Z" });

    expect(usage.consumed).toBe(12);
    expect(usage.granted).toBe(60);
    expect(usage.refunded).toBe(12);
    expect(usage.byDay).toEqual([
      { date: "2026-09-01", consumed: 8 },
      { date: "2026-09-02", consumed: 4 },
      { date: "2026-09-03", consumed: 0 },
    ]);
    expect(usage.byReferenceType).toEqual({ scan: 8, message: 4 });
  });

  it("does not count debits or expirations as grants and reports sparse days for very long ranges", async () => {
    const c = clock("2025-03-10T12:00:00.000Z");
    const { service } = setup(100, c.now);
    await service.debit({ workspaceId: WS, amount: 10, referenceType: REFERENCE_TYPES.admin, referenceId: "a", idempotencyKey: "d1" });
    await service.expire({ workspaceId: WS, amount: 10, referenceType: REFERENCE_TYPES.plan, referenceId: "p", idempotencyKey: "e1" });
    await service.consume({ workspaceId: WS, amount: 7, referenceType: REFERENCE_TYPES.message, referenceId: "m", idempotencyKey: "c1" });

    const usage = await service.getUsage(WS, { from: "2020-01-01T00:00:00.000Z", to: "2027-01-01T00:00:00.000Z" });
    expect(usage.granted).toBe(0);
    expect(usage.consumed).toBe(7);
    expect(usage.byDay).toEqual([{ date: "2025-03-10", consumed: 7 }]);
  });

  it("validates the range", async () => {
    const { service } = setup(100);
    await expect(service.getUsage(WS, { from: "2026-09-02T00:00:00Z", to: "2026-09-01T00:00:00Z" })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.getUsage(WS, { from: "not-a-date", to: "2026-09-01T00:00:00Z" })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("CreditService.getLedger", () => {
  it("lists newest first with type filter, cursor and clamped limit", async () => {
    const { service } = setup(100);
    await service.reserve(reserveInput(30));
    await service.consume(consumeInput(10, "b1"));
    await service.consume(consumeInput(5, "b2"));
    await service.refund({ workspaceId: WS, amount: 15, ...scanRef, idempotencyKey: "rf" });

    const all = await service.getLedger(WS);
    expect(all.map((r) => r.type)).toEqual(["refund", "consumption", "consumption", "reservation"]);

    const consumption = await service.getLedger(WS, { types: ["consumption"], limit: 500 });
    expect(consumption).toHaveLength(2);

    const before = await service.getLedger(WS, { before: all[1].created_at });
    expect(before.map((r) => r.id)).toEqual([all[2].id, all[3].id]);

    const one = await service.getLedger(WS, { limit: 0.5 });
    expect(one).toHaveLength(1);

    await expect(service.getLedger(WS, { types: ["bogus" as unknown as "refund"] })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.getLedger(WS, { before: "yesterday" })).rejects.toBeInstanceOf(ValidationError);
  });
});
