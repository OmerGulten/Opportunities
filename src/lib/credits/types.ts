import type { CreditLedgerType, Json } from "@/types/common";
import type { CreditAccountRow, CreditLedgerRow, CreditReservationRow } from "@/types/db";

/**
 * Credit ledger contracts. The ledger is immutable; every mutation is one
 * `apply()` call carrying an idempotency key, executed either by the Postgres
 * function `public.credit_apply` (production) or by the in-memory mirror (tests,
 * local development without Supabase).
 */

export type CreditMetadata = Record<string, Json>;

export interface CreditApplyInput {
  workspaceId: string;
  type: CreditLedgerType;
  /** Unsigned, non-negative integer. The store derives the signed ledger amount. */
  amount: number;
  referenceType: string;
  referenceId: string;
  /** Globally unique. Replaying the same key returns the original ledger row. */
  idempotencyKey: string;
  metadata?: CreditMetadata;
  actorId?: string | null;
}

export interface LedgerListOptions {
  /** Maximum number of rows, newest first. Stores clamp to a sane upper bound. */
  limit?: number;
  /** ISO-8601 cursor: only rows created strictly before this instant. */
  before?: string;
  /** Restrict to these ledger types. */
  types?: CreditLedgerType[];
}

export interface CreditStore {
  /** Atomic ledger mutation with idempotent replay semantics (see `credit_apply`). */
  apply(input: CreditApplyInput): Promise<CreditLedgerRow>;
  getAccount(workspaceId: string): Promise<CreditAccountRow | null>;
  getReservation(referenceType: string, referenceId: string): Promise<CreditReservationRow | null>;
  /** The ledger row previously written under this idempotency key, if any. */
  getLedgerEntry(idempotencyKey: string): Promise<CreditLedgerRow | null>;
  /** Newest first. */
  listLedger(workspaceId: string, opts?: LedgerListOptions): Promise<CreditLedgerRow[]>;
  /** Half-open range `[from, to)` on `created_at`, oldest first. */
  listLedgerRange(workspaceId: string, from: string, to: string): Promise<CreditLedgerRow[]>;
}

// Service-level input / output shapes --------------------------------------

export interface CreditOperationInput {
  workspaceId: string;
  /** Positive integer. */
  amount: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  metadata?: CreditMetadata;
  actorId?: string | null;
}

export type CreditGrantType = Extract<CreditLedgerType, "monthly_grant" | "purchase" | "admin_adjustment">;

export interface CreditGrantInput extends CreditOperationInput {
  type: CreditGrantType;
}

export interface CreditReleaseInput {
  workspaceId: string;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  metadata?: CreditMetadata;
  actorId?: string | null;
}

export interface CreditReleaseResult {
  /**
   * Total credits this release returned to the balance for the reference.
   *
   * On a replay this reports the original release's amount, not a second
   * refund — the ledger applies it exactly once. Callers must therefore *set*
   * a stored "refunded" figure from this value rather than add to it; use
   * `applied` to tell the two cases apart.
   */
  refunded: number;
  /**
   * True when this call actually moved credits. False on a replay, when the
   * reservation was already fully consumed, and when there is no reservation.
   */
  applied: boolean;
}

export interface CreditBalance {
  /** Spendable credits (excludes reserved). */
  available: number;
  reserved: number;
  lifetimeGranted: number;
  lifetimeConsumed: number;
}

export interface CreditUsageRange {
  /** Inclusive ISO-8601 instant. */
  from: string;
  /** Exclusive ISO-8601 instant. */
  to: string;
}

export interface CreditUsageDay {
  /** UTC calendar day, `YYYY-MM-DD`. */
  date: string;
  consumed: number;
}

export interface CreditUsage {
  consumed: number;
  granted: number;
  refunded: number;
  byDay: CreditUsageDay[];
  /** Consumed credits grouped by `reference_type` (e.g. `scan`, `message`). */
  byReferenceType: Record<string, number>;
}
