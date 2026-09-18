import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { AppError, ConflictError, ForbiddenError, InsufficientCreditsError, ValidationError } from "@/lib/errors";
import type { CreditLedgerRow } from "@/types/db";

import { createSupabaseCreditStore, mapCreditRpcError } from "./store.supabase";

interface QueryResult {
  data: unknown;
  error: unknown;
}

/** Minimal chainable fake of the PostgREST builder surface the store uses. */
function fakeClient(options: { rpc?: QueryResult; pages?: QueryResult[]; single?: QueryResult }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let pageIndex = 0;
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "eq", "in", "lt", "gte", "order", "limit", "range"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.maybeSingle = () => Promise.resolve(options.single ?? { data: null, error: null });
  builder.returns = () => {
    const page = options.pages?.[pageIndex] ?? { data: [], error: null };
    pageIndex += 1;
    return Promise.resolve(page);
  };
  const rpc = vi.fn(async () => options.rpc ?? { data: null, error: null });
  const from = vi.fn(() => builder);
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from, calls };
}

const ledgerRow: CreditLedgerRow = {
  id: "led-1",
  workspace_id: "ws",
  account_id: "acc",
  type: "reservation",
  amount: -5,
  balance_after: 95,
  reserved_after: 5,
  reference_type: "scan",
  reference_id: "s1",
  idempotency_key: "scan:s1:reserve",
  metadata: { quantity: 5 },
  created_by: null,
  created_at: "2026-09-18T00:00:00.000Z",
};

describe("createSupabaseCreditStore.apply", () => {
  it("calls credit_apply_scoped with the expected parameters and returns the row", async () => {
    const { client, rpc } = fakeClient({ rpc: { data: ledgerRow, error: null } });
    const store = createSupabaseCreditStore(client);
    const row = await store.apply({ workspaceId: "ws", type: "reservation", amount: 5, referenceType: "scan", referenceId: "s1", idempotencyKey: "scan:s1:reserve" });

    expect(row).toEqual(ledgerRow);
    expect(rpc).toHaveBeenCalledWith("credit_apply_scoped", {
      p_workspace: "ws",
      p_type: "reservation",
      p_amount: 5,
      p_reference_type: "scan",
      p_reference_id: "s1",
      p_idempotency_key: "scan:s1:reserve",
      p_metadata: {},
      p_actor: null,
    });
  });

  it("accepts a one-element array result and rejects an empty one", async () => {
    const ok = createSupabaseCreditStore(fakeClient({ rpc: { data: [ledgerRow], error: null } }).client);
    await expect(ok.apply({ workspaceId: "ws", type: "reservation", amount: 5, referenceType: "scan", referenceId: "s1", idempotencyKey: "k" })).resolves.toEqual(ledgerRow);

    const empty = createSupabaseCreditStore(fakeClient({ rpc: { data: [], error: null } }).client);
    const err = await empty.apply({ workspaceId: "ws", type: "reservation", amount: 5, referenceType: "scan", referenceId: "s1", idempotencyKey: "k" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("internal_error");
  });

  it("maps insufficient_credits to InsufficientCreditsError with parsed amounts", async () => {
    const store = createSupabaseCreditStore(
      fakeClient({ rpc: { data: null, error: { code: "P0001", message: "insufficient_credits", details: "available=3 required=5", hint: null } } }).client,
    );
    const err = await store.apply({ workspaceId: "ws", type: "reservation", amount: 5, referenceType: "scan", referenceId: "s1", idempotencyKey: "k" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect((err as InsufficientCreditsError).details).toMatchObject({ required: 5, available: 3 });
  });

  it("maps refund_exceeds_reservation to ConflictError", async () => {
    const store = createSupabaseCreditStore(
      fakeClient({ rpc: { data: null, error: { code: "P0002", message: "refund_exceeds_reservation", details: "remaining=2 requested=9" } } }).client,
    );
    const err = await store.apply({ workspaceId: "ws", type: "refund", amount: 9, referenceType: "scan", referenceId: "s1", idempotencyKey: "k" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).details).toMatchObject({ reason: "refund_exceeds_reservation", remaining: 2, requested: 9 });
  });
});

describe("mapCreditRpcError", () => {
  it("delegates other errors to toAppError and passes AppErrors through", () => {
    expect(mapCreditRpcError({ code: "42501", message: "permission denied" })).toBeInstanceOf(ForbiddenError);
    expect(mapCreditRpcError({ code: "22P02", message: "invalid input syntax for type uuid" })).toBeInstanceOf(ValidationError);
    expect(mapCreditRpcError({ message: "boom" }).code).toBe("internal_error");
    expect(mapCreditRpcError("weird").code).toBe("internal_error");
    const original = new ConflictError("x");
    expect(mapCreditRpcError(original)).toBe(original);
  });

  it("finds the marker in the message when details are missing", () => {
    const err = mapCreditRpcError({ message: "insufficient_credits: available=1 required=4" });
    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect(err.details).toMatchObject({ required: 4, available: 1 });
  });
});

describe("createSupabaseCreditStore reads", () => {
  it("reads account and reservation rows with maybeSingle", async () => {
    const account = { id: "acc", workspace_id: "ws", balance: 10, reserved: 2, lifetime_granted: 12, lifetime_consumed: 0, created_at: "", updated_at: "" };
    const { client, from, calls } = fakeClient({ single: { data: account, error: null } });
    const store = createSupabaseCreditStore(client);
    expect(await store.getAccount("ws")).toEqual(account);
    expect(from).toHaveBeenCalledWith("credit_accounts");
    expect(calls).toContainEqual({ method: "eq", args: ["workspace_id", "ws"] });

    const missing = createSupabaseCreditStore(fakeClient({ single: { data: null, error: null } }).client);
    expect(await missing.getReservation("scan", "s1")).toBeNull();
    expect(await missing.getLedgerEntry("k")).toBeNull();
  });

  it("applies filters and clamps the limit when listing the ledger", async () => {
    const { client, calls } = fakeClient({ pages: [{ data: [ledgerRow], error: null }] });
    const store = createSupabaseCreditStore(client);
    const rows = await store.listLedger("ws", { limit: 9999, types: ["reservation", "refund"], before: "2026-09-19T00:00:00Z" });

    expect(rows).toEqual([ledgerRow]);
    expect(calls).toContainEqual({ method: "in", args: ["type", ["reservation", "refund"]] });
    expect(calls).toContainEqual({ method: "lt", args: ["created_at", "2026-09-19T00:00:00Z"] });
    expect(calls).toContainEqual({ method: "limit", args: [200] });
  });

  it("pages through ranges until a short page is returned", async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({ ...ledgerRow, id: `led-${i}` }));
    const { client, calls } = fakeClient({ pages: [{ data: fullPage, error: null }, { data: [ledgerRow, ledgerRow], error: null }] });
    const store = createSupabaseCreditStore(client);
    const rows = await store.listLedgerRange("ws", "2026-09-01T00:00:00Z", "2026-10-01T00:00:00Z");

    expect(rows).toHaveLength(1002);
    const ranges = calls.filter((c) => c.method === "range").map((c) => c.args);
    expect(ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(calls).toContainEqual({ method: "gte", args: ["created_at", "2026-09-01T00:00:00Z"] });
    expect(calls).toContainEqual({ method: "lt", args: ["created_at", "2026-10-01T00:00:00Z"] });
  });

  it("wraps read errors", async () => {
    const store = createSupabaseCreditStore(fakeClient({ single: { data: null, error: { code: "42501", message: "denied" } } }).client);
    await expect(store.getAccount("ws")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
