import { ConflictError, InsufficientCreditsError, ValidationError } from "@/lib/errors";
import type { CreditAccountRow, CreditLedgerRow, CreditReservationRow } from "@/types/db";

import type { CreditApplyInput, CreditStore, LedgerListOptions } from "./types";

/**
 * In-memory mirror of `public.credit_apply` (supabase/migrations/*_init.sql).
 * Used by unit tests and by local runs without a database. Every branch below
 * corresponds to a branch of the SQL function; keep them in lock-step.
 */

export interface MemoryCreditStoreOptions {
  /** Clock override for deterministic timestamps in tests. */
  now?: () => Date;
  /** Workspace ids whose account is never billed (mirrors credit_accounts.unlimited). */
  unlimitedWorkspaceIds?: readonly string[];
}

export interface MemoryCreditStoreSnapshot {
  accounts: CreditAccountRow[];
  ledger: CreditLedgerRow[];
  reservations: CreditReservationRow[];
}

export interface MemoryCreditStore extends CreditStore {
  /** Copies of the current state, for assertions. */
  snapshot(): MemoryCreditStoreSnapshot;
}

/**
 * @param seed opening available balance per workspace id. Seeded credits are
 *   written straight to the account (also counted in `lifetime_granted`) without a
 *   ledger row, like an account created out-of-band.
 */
export function createMemoryCreditStore(seed: Record<string, number> = {}, options: MemoryCreditStoreOptions = {}): MemoryCreditStore {
  const now = options.now ?? (() => new Date());
  const accounts = new Map<string, CreditAccountRow>();
  const ledger: CreditLedgerRow[] = [];
  const ledgerByKey = new Map<string, CreditLedgerRow>();
  const reservations = new Map<string, CreditReservationRow>();
  let sequence = 0;
  let lastTickMs = 0;

  // Strictly increasing timestamps so `before` cursors and ranges are exact.
  const tick = (): string => {
    lastTickMs = Math.max(now().getTime(), lastTickMs + 1);
    return new Date(lastTickMs).toISOString();
  };
  const nextId = (prefix: string): string => {
    sequence += 1;
    return `${prefix}_${String(sequence).padStart(6, "0")}`;
  };

  const getOrCreateAccount = (workspaceId: string): CreditAccountRow => {
    const existing = accounts.get(workspaceId);
    if (existing) return existing;
    const ts = tick();
    const account: CreditAccountRow = {
      id: nextId("acc"),
      workspace_id: workspaceId,
      balance: 0,
      reserved: 0,
      unlimited: false,
      lifetime_granted: 0,
      lifetime_consumed: 0,
      created_at: ts,
      updated_at: ts,
    };
    accounts.set(workspaceId, account);
    return account;
  };

  for (const workspaceId of options.unlimitedWorkspaceIds ?? []) {
    getOrCreateAccount(workspaceId).unlimited = true;
  }

  for (const [workspaceId, balance] of Object.entries(seed)) {
    if (!Number.isInteger(balance) || balance < 0) {
      throw new ValidationError(`Seed balance for ${workspaceId} must be a non-negative integer`, { details: { workspaceId, balance } });
    }
    const account = getOrCreateAccount(workspaceId);
    account.balance = balance;
    account.lifetime_granted = balance;
  }

  // Mirrors the unique (reference_type, reference_id) constraint.
  const reservationKey = (referenceType: string, referenceId: string) => JSON.stringify([referenceType, referenceId]);

  const apply = async (input: CreditApplyInput): Promise<CreditLedgerRow> => {
    if (!Number.isInteger(input.amount) || input.amount < 0) {
      throw new ValidationError("invalid_amount", { details: { amount: input.amount } });
    }

    // Idempotent replay
    const replay = ledgerByKey.get(input.idempotencyKey);
    if (replay) return clone(replay);

    const metadata = { ...(input.metadata ?? {}) };
    const negative = metadata.direction === "debit";
    const account = getOrCreateAccount(input.workspaceId);

    // Mirrors public.credit_apply_scoped: an unlimited account records the
    // operation but never moves a balance and never fails for want of credits.
    if (account.unlimited) {
      const unlimitedTs = tick();
      if (input.type === "consumption") account.lifetime_consumed += input.amount;
      else if (input.type === "monthly_grant" || input.type === "purchase") account.lifetime_granted += input.amount;
      account.updated_at = unlimitedTs;

      const entry: CreditLedgerRow = {
        id: nextId("led"),
        workspace_id: input.workspaceId,
        account_id: account.id,
        type: input.type,
        amount: 0,
        balance_after: account.balance,
        reserved_after: account.reserved,
        reference_type: input.referenceType,
        reference_id: input.referenceId,
        idempotency_key: input.idempotencyKey,
        metadata: { ...metadata, unlimited: true },
        created_by: input.actorId ?? null,
        created_at: unlimitedTs,
      };
      // Oldest-first, like the billed path: listLedger walks the array backwards
      // to produce newest-first, and `before` cursors depend on that order.
      ledger.push(entry);
      ledgerByKey.set(input.idempotencyKey, entry);
      return clone(entry);
    }

    let available = account.balance;
    let reserved = account.reserved;
    let amount = input.amount;
    let signed: number;
    const resKey = reservationKey(input.referenceType, input.referenceId);
    const ts = tick();

    switch (input.type) {
      case "monthly_grant":
      case "purchase":
      case "admin_adjustment": {
        if (input.type === "admin_adjustment" && negative) {
          // clamp to zero rather than fail; record the actual amount removed
          if (available < amount) amount = available;
          signed = -amount;
          available -= amount;
          break;
        }
        signed = amount;
        available += amount;
        account.lifetime_granted += amount;
        break;
      }

      case "reservation": {
        if (available < amount) throw new InsufficientCreditsError(amount, available);
        signed = -amount;
        available -= amount;
        reserved += amount;
        const existing = reservations.get(resKey);
        if (existing) {
          existing.reserved_amount += amount;
          existing.status = "active";
          existing.updated_at = ts;
        } else {
          reservations.set(resKey, {
            id: nextId("res"),
            workspace_id: input.workspaceId,
            account_id: account.id,
            reference_type: input.referenceType,
            reference_id: input.referenceId,
            reserved_amount: amount,
            consumed_amount: 0,
            refunded_amount: 0,
            status: "active",
            expires_at: null,
            created_at: ts,
            updated_at: ts,
          });
        }
        break;
      }

      case "consumption": {
        const res = reservations.get(resKey);
        if (res && remainingOf(res) >= amount) {
          // consume from reservation: available unchanged, reserved decreases
          signed = 0;
          reserved -= amount;
          res.consumed_amount += amount;
          res.updated_at = ts;
        } else {
          // direct consumption from available balance
          if (available < amount) throw new InsufficientCreditsError(amount, available);
          signed = -amount;
          available -= amount;
        }
        account.lifetime_consumed += amount;
        break;
      }

      case "refund": {
        const res = reservations.get(resKey);
        if (res) {
          const remaining = remainingOf(res);
          if (amount > remaining) {
            throw new ConflictError("refund_exceeds_reservation", { details: { remaining, requested: amount } });
          }
          reserved -= amount;
          res.refunded_amount += amount;
          if (remainingOf(res) <= 0) res.status = "settled";
          res.updated_at = ts;
        }
        signed = amount;
        available += amount;
        break;
      }

      case "expiration": {
        if (available < amount) amount = available;
        signed = -amount;
        available -= amount;
        break;
      }
    }

    account.balance = available;
    account.reserved = reserved;
    account.updated_at = ts;

    const row: CreditLedgerRow = {
      id: nextId("led"),
      workspace_id: input.workspaceId,
      account_id: account.id,
      type: input.type,
      amount: signed,
      balance_after: available,
      reserved_after: reserved,
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      idempotency_key: input.idempotencyKey,
      metadata,
      created_by: input.actorId ?? null,
      created_at: ts,
    };
    ledger.push(row);
    ledgerByKey.set(row.idempotency_key, row);
    return clone(row);
  };

  return {
    apply,
    async getAccount(workspaceId) {
      const account = accounts.get(workspaceId);
      return account ? { ...account } : null;
    },
    async getReservation(referenceType, referenceId) {
      const res = reservations.get(reservationKey(referenceType, referenceId));
      return res ? { ...res } : null;
    },
    async getLedgerEntry(idempotencyKey) {
      const row = ledgerByKey.get(idempotencyKey);
      return row ? clone(row) : null;
    },
    async listLedger(workspaceId, opts: LedgerListOptions = {}) {
      const limit = opts.limit ?? 50;
      const types = opts.types && opts.types.length > 0 ? new Set(opts.types) : null;
      const out: CreditLedgerRow[] = [];
      for (let i = ledger.length - 1; i >= 0 && out.length < limit; i -= 1) {
        const row = ledger[i];
        if (row.workspace_id !== workspaceId) continue;
        if (types && !types.has(row.type)) continue;
        if (opts.before && !(row.created_at < opts.before)) continue;
        out.push(clone(row));
      }
      return out;
    },
    async listLedgerRange(workspaceId, from, to) {
      return ledger.filter((row) => row.workspace_id === workspaceId && row.created_at >= from && row.created_at < to).map(clone);
    },
    snapshot() {
      return {
        accounts: [...accounts.values()].map((a) => ({ ...a })),
        ledger: ledger.map(clone),
        reservations: [...reservations.values()].map((r) => ({ ...r })),
      };
    },
  };
}

function remainingOf(res: CreditReservationRow): number {
  return res.reserved_amount - res.consumed_amount - res.refunded_amount;
}

function clone(row: CreditLedgerRow): CreditLedgerRow {
  return { ...row, metadata: { ...row.metadata } };
}
