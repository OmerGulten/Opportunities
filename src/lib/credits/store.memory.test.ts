import { describe, expect, it } from "vitest";

import { ValidationError } from "@/lib/errors";

import { createMemoryCreditStore } from "./store.memory";

const WS = "ws-a";

describe("createMemoryCreditStore", () => {
  it("seeds accounts without ledger rows and rejects invalid seeds", async () => {
    const store = createMemoryCreditStore({ [WS]: 40, "ws-b": 0 });
    expect(await store.getAccount(WS)).toMatchObject({ balance: 40, reserved: 0, lifetime_granted: 40, lifetime_consumed: 0 });
    expect(await store.getAccount("ws-b")).toMatchObject({ balance: 0 });
    expect(await store.getAccount("ws-c")).toBeNull();
    expect(store.snapshot().ledger).toHaveLength(0);

    expect(() => createMemoryCreditStore({ [WS]: -1 })).toThrow(ValidationError);
    expect(() => createMemoryCreditStore({ [WS]: 1.5 })).toThrow(ValidationError);
  });

  it("creates the account on first use and accepts a zero amount like the SQL function", async () => {
    const store = createMemoryCreditStore();
    const row = await store.apply({ workspaceId: "fresh", type: "purchase", amount: 0, referenceType: "purchase", referenceId: "p", idempotencyKey: "k0" });
    expect(row.amount).toBe(0);
    expect(row.balance_after).toBe(0);
    expect(await store.getAccount("fresh")).toMatchObject({ balance: 0, lifetime_granted: 0 });

    await expect(store.apply({ workspaceId: "fresh", type: "purchase", amount: -1, referenceType: "purchase", referenceId: "p", idempotencyKey: "k1" })).rejects.toBeInstanceOf(ValidationError);
    await expect(store.apply({ workspaceId: "fresh", type: "purchase", amount: 2.5, referenceType: "purchase", referenceId: "p", idempotencyKey: "k2" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("upserts reservations per (reference_type, reference_id) and reactivates settled ones", async () => {
    const store = createMemoryCreditStore({ [WS]: 100 });
    const ref = { workspaceId: WS, referenceType: "scan", referenceId: "s1" };
    await store.apply({ ...ref, type: "reservation", amount: 30, idempotencyKey: "r1" });
    await store.apply({ ...ref, type: "reservation", amount: 20, idempotencyKey: "r2" });
    expect(await store.getReservation("scan", "s1")).toMatchObject({ reserved_amount: 50, status: "active" });
    expect(await store.getAccount(WS)).toMatchObject({ balance: 50, reserved: 50 });

    await store.apply({ ...ref, type: "refund", amount: 50, idempotencyKey: "rf" });
    expect(await store.getReservation("scan", "s1")).toMatchObject({ refunded_amount: 50, status: "settled" });

    await store.apply({ ...ref, type: "reservation", amount: 5, idempotencyKey: "r3" });
    expect(await store.getReservation("scan", "s1")).toMatchObject({ reserved_amount: 55, status: "active" });
    expect(await store.getAccount(WS)).toMatchObject({ balance: 95, reserved: 5 });
  });

  it("keeps reservations of different references apart", async () => {
    const store = createMemoryCreditStore({ [WS]: 100 });
    await store.apply({ workspaceId: WS, type: "reservation", amount: 10, referenceType: "scan", referenceId: "a:b", idempotencyKey: "x1" });
    await store.apply({ workspaceId: WS, type: "reservation", amount: 20, referenceType: "scan:a", referenceId: "b", idempotencyKey: "x2" });
    expect(await store.getReservation("scan", "a:b")).toMatchObject({ reserved_amount: 10 });
    expect(await store.getReservation("scan:a", "b")).toMatchObject({ reserved_amount: 20 });
  });

  it("returns copies so callers cannot mutate internal state", async () => {
    const store = createMemoryCreditStore({ [WS]: 10 });
    const row = await store.apply({ workspaceId: WS, type: "purchase", amount: 5, referenceType: "purchase", referenceId: "p", idempotencyKey: "k", metadata: { a: 1 } });
    row.metadata.a = 99;
    row.balance_after = -1;
    const stored = await store.getLedgerEntry("k");
    expect(stored?.metadata.a).toBe(1);
    expect(stored?.balance_after).toBe(15);

    const account = await store.getAccount(WS);
    if (account) account.balance = 0;
    expect(await store.getAccount(WS)).toMatchObject({ balance: 15 });
  });

  it("lists the ledger newest first with filters and half-open ranges", async () => {
    let t = Date.parse("2026-09-01T00:00:00.000Z");
    const store = createMemoryCreditStore({ [WS]: 100, other: 100 }, { now: () => new Date((t += 60_000)) });
    const base = { workspaceId: WS, referenceType: "scan", referenceId: "s" };
    await store.apply({ ...base, type: "reservation", amount: 10, idempotencyKey: "1" });
    await store.apply({ ...base, type: "consumption", amount: 4, idempotencyKey: "2" });
    await store.apply({ ...base, type: "consumption", amount: 6, idempotencyKey: "3" });
    await store.apply({ workspaceId: "other", type: "consumption", amount: 1, referenceType: "message", referenceId: "m", idempotencyKey: "4" });

    const all = await store.listLedger(WS);
    expect(all.map((r) => r.idempotency_key)).toEqual(["3", "2", "1"]);
    expect(await store.listLedger(WS, { limit: 2 })).toHaveLength(2);
    expect((await store.listLedger(WS, { types: ["reservation"] })).map((r) => r.idempotency_key)).toEqual(["1"]);
    expect((await store.listLedger(WS, { before: all[0].created_at })).map((r) => r.idempotency_key)).toEqual(["2", "1"]);

    const range = await store.listLedgerRange(WS, all[2].created_at, all[0].created_at);
    expect(range.map((r) => r.idempotency_key)).toEqual(["1", "2"]);
    expect(await store.getLedgerEntry("missing")).toBeNull();
  });
});
