import { ValidationError } from "@/lib/errors";
import type { CreditLedgerType } from "@/types/common";
import type { CreditLedgerRow, CreditReservationRow } from "@/types/db";

import type {
  CreditBalance,
  CreditGrantInput,
  CreditMetadata,
  CreditOperationInput,
  CreditReleaseInput,
  CreditReleaseResult,
  CreditStore,
  CreditUsage,
  CreditUsageRange,
  LedgerListOptions,
} from "./types";

/**
 * Credit operations over a `CreditStore`. Validates inputs, fixes the ledger
 * type per operation and derives balances / usage from the immutable ledger.
 *
 * The ledger `amount` column is the signed effect on the *available* balance, so
 * a consumption served from a reservation is recorded as `0`. To keep usage
 * reporting exact, every operation stores the requested unsigned amount as
 * `metadata.quantity`.
 */

export const QUANTITY_METADATA_KEY = "quantity";

const LEDGER_TYPES: readonly CreditLedgerType[] = [
  "monthly_grant",
  "purchase",
  "reservation",
  "consumption",
  "refund",
  "admin_adjustment",
  "expiration",
];

const MAX_LEDGER_LIMIT = 200;
const DEFAULT_LEDGER_LIMIT = 50;
/** Longer ranges are reported sparsely (only days with consumption). */
const MAX_FILLED_DAYS = 366;
const DAY_MS = 86_400_000;

export class CreditService {
  constructor(private readonly store: CreditStore) {}

  /** Move `amount` from available to reserved for a reference (typically a scan). */
  reserve(input: CreditOperationInput): Promise<CreditLedgerRow> {
    return this.applyOperation("reservation", input);
  }

  /**
   * Consume credits. Served from the reference's reservation when its remaining
   * covers the amount; otherwise taken from the available balance.
   */
  consume(input: CreditOperationInput): Promise<CreditLedgerRow> {
    return this.applyOperation("consumption", input);
  }

  /** Return reserved credits to available. Cannot exceed the reservation remaining. */
  refund(input: CreditOperationInput): Promise<CreditLedgerRow> {
    return this.applyOperation("refund", input);
  }

  /** Add credits (plan grant, purchase or positive admin adjustment). */
  async grant(input: CreditGrantInput): Promise<CreditLedgerRow> {
    if (input.type !== "monthly_grant" && input.type !== "purchase" && input.type !== "admin_adjustment") {
      throw new ValidationError("Unsupported grant type", { details: { field: "type", value: input.type } });
    }
    // `direction` decides the sign of admin adjustments in credit_apply; never let a
    // caller turn a grant into a debit by accident.
    const metadata: CreditMetadata =
      input.type === "admin_adjustment" ? { ...(input.metadata ?? {}), direction: "credit" } : { ...(input.metadata ?? {}) };
    return this.applyOperation(input.type, { ...input, metadata });
  }

  /** Negative admin adjustment. Clamped to the available balance (never fails for a short balance). */
  debit(input: CreditOperationInput): Promise<CreditLedgerRow> {
    return this.applyOperation("admin_adjustment", { ...input, metadata: { ...(input.metadata ?? {}), direction: "debit" } });
  }

  /** Remove unused credits at period end. Clamped to the available balance. */
  expire(input: CreditOperationInput): Promise<CreditLedgerRow> {
    return this.applyOperation("expiration", input);
  }

  /**
   * Refund whatever remains of a reference's reservation. Idempotent: a replay with
   * the same key reports the amount refunded the first time and changes nothing.
   */
  async releaseReservation(input: CreditReleaseInput): Promise<CreditReleaseResult> {
    assertNonEmptyString(input.workspaceId, "workspaceId");
    assertNonEmptyString(input.referenceType, "referenceType");
    assertNonEmptyString(input.referenceId, "referenceId");
    assertNonEmptyString(input.idempotencyKey, "idempotencyKey");

    const previous = await this.store.getLedgerEntry(input.idempotencyKey);
    // Replay: the ledger already applied this release exactly once.
    if (previous) return { refunded: Math.max(0, previous.amount), applied: false };

    const reservation = await this.store.getReservation(input.referenceType, input.referenceId);
    if (!reservation) return { refunded: 0, applied: false };
    const remaining = reservationRemaining(reservation);
    if (remaining <= 0) return { refunded: 0, applied: false };

    const row = await this.store.apply({
      workspaceId: input.workspaceId,
      type: "refund",
      amount: remaining,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: input.idempotencyKey,
      metadata: { ...(input.metadata ?? {}), [QUANTITY_METADATA_KEY]: remaining, reason: "release" },
      actorId: input.actorId ?? null,
    });
    return { refunded: Math.max(0, row.amount), applied: true };
  }

  async getBalance(workspaceId: string): Promise<CreditBalance> {
    assertNonEmptyString(workspaceId, "workspaceId");
    const account = await this.store.getAccount(workspaceId);
    if (!account) return { available: 0, reserved: 0, lifetimeGranted: 0, lifetimeConsumed: 0, unlimited: false };
    return {
      available: account.balance,
      reserved: account.reserved,
      lifetimeGranted: account.lifetime_granted,
      lifetimeConsumed: account.lifetime_consumed,
      unlimited: account.unlimited === true,
    };
  }

  async getReservation(referenceType: string, referenceId: string): Promise<CreditReservationRow | null> {
    assertNonEmptyString(referenceType, "referenceType");
    assertNonEmptyString(referenceId, "referenceId");
    return this.store.getReservation(referenceType, referenceId);
  }

  /** Aggregate ledger activity in `[from, to)`. Days are UTC calendar days. */
  async getUsage(workspaceId: string, range: CreditUsageRange): Promise<CreditUsage> {
    assertNonEmptyString(workspaceId, "workspaceId");
    const fromMs = parseInstant(range.from, "from");
    const toMs = parseInstant(range.to, "to");
    if (fromMs >= toMs) throw new ValidationError("from must be before to", { details: { from: range.from, to: range.to } });

    const rows = await this.store.listLedgerRange(workspaceId, new Date(fromMs).toISOString(), new Date(toMs).toISOString());

    let consumed = 0;
    let granted = 0;
    let refunded = 0;
    const consumedByDay = new Map<string, number>();
    const byReferenceType: Record<string, number> = {};

    for (const row of rows) {
      switch (row.type) {
        case "consumption": {
          const quantity = consumedQuantity(row);
          consumed += quantity;
          const day = utcDay(row.created_at);
          consumedByDay.set(day, (consumedByDay.get(day) ?? 0) + quantity);
          const ref = row.reference_type ?? "unknown";
          byReferenceType[ref] = (byReferenceType[ref] ?? 0) + quantity;
          break;
        }
        case "monthly_grant":
        case "purchase":
          granted += Math.max(0, row.amount);
          break;
        case "admin_adjustment":
          if (row.amount > 0) granted += row.amount;
          break;
        case "refund":
          refunded += Math.max(0, row.amount);
          break;
        default:
          break;
      }
    }

    return { consumed, granted, refunded, byDay: buildByDay(consumedByDay, fromMs, toMs), byReferenceType };
  }

  /** Newest first. `limit` is clamped to 1..200. */
  async getLedger(workspaceId: string, opts: LedgerListOptions = {}): Promise<CreditLedgerRow[]> {
    assertNonEmptyString(workspaceId, "workspaceId");
    if (opts.limit !== undefined && (typeof opts.limit !== "number" || !Number.isFinite(opts.limit))) {
      throw new ValidationError("limit must be a number", { details: { field: "limit", value: opts.limit } });
    }
    const limit = opts.limit === undefined ? DEFAULT_LEDGER_LIMIT : Math.min(MAX_LEDGER_LIMIT, Math.max(1, Math.floor(opts.limit)));
    if (opts.before !== undefined) parseInstant(opts.before, "before");
    if (opts.types) {
      for (const type of opts.types) {
        if (!LEDGER_TYPES.includes(type)) throw new ValidationError("Unknown ledger type", { details: { field: "types", value: type } });
      }
    }
    return this.store.listLedger(workspaceId, { limit, before: opts.before, types: opts.types });
  }

  private async applyOperation(type: CreditLedgerType, input: CreditOperationInput): Promise<CreditLedgerRow> {
    assertNonEmptyString(input.workspaceId, "workspaceId");
    assertNonEmptyString(input.referenceType, "referenceType");
    assertNonEmptyString(input.referenceId, "referenceId");
    assertNonEmptyString(input.idempotencyKey, "idempotencyKey");
    assertPositiveInteger(input.amount, "amount");
    return this.store.apply({
      workspaceId: input.workspaceId,
      type,
      amount: input.amount,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      idempotencyKey: input.idempotencyKey,
      metadata: { ...(input.metadata ?? {}), [QUANTITY_METADATA_KEY]: input.amount },
      actorId: input.actorId ?? null,
    });
  }
}

/** Credits still held by a reservation (reserved - consumed - refunded). */
export function reservationRemaining(reservation: CreditReservationRow): number {
  return reservation.reserved_amount - reservation.consumed_amount - reservation.refunded_amount;
}

/**
 * Consumed quantity of a consumption row. Prefers the recorded `metadata.quantity`
 * (exact even when served from a reservation); falls back to the signed amount for
 * rows written without it.
 */
export function consumedQuantity(row: CreditLedgerRow): number {
  const recorded = row.metadata[QUANTITY_METADATA_KEY];
  if (typeof recorded === "number" && Number.isInteger(recorded) && recorded >= 0) return recorded;
  return Math.abs(row.amount);
}

function buildByDay(consumedByDay: Map<string, number>, fromMs: number, toMs: number): CreditUsage["byDay"] {
  const from = new Date(fromMs);
  const startOfFromDay = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const spanDays = Math.ceil((toMs - startOfFromDay) / DAY_MS);
  if (spanDays > MAX_FILLED_DAYS) {
    return [...consumedByDay.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, value]) => ({ date, consumed: value }));
  }
  const out: CreditUsage["byDay"] = [];
  for (let t = startOfFromDay; t < toMs; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    out.push({ date, consumed: consumedByDay.get(date) ?? 0 });
  }
  return out;
}

function utcDay(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? iso.slice(0, 10) : new Date(ms).toISOString().slice(0, 10);
}

function parseInstant(value: string, field: string): number {
  const ms = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(ms)) throw new ValidationError(`${field} must be an ISO-8601 date-time`, { details: { field, value } });
  return ms;
}

function assertPositiveInteger(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ValidationError(`${field} must be a positive integer`, { details: { field, value } });
  }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, { details: { field } });
  }
}
