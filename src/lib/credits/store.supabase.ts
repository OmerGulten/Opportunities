import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError, ConflictError, InsufficientCreditsError, isAppError, toAppError } from "@/lib/errors";
import type { CreditAccountRow, CreditLedgerRow, CreditReservationRow } from "@/types/db";

import type { CreditApplyInput, CreditStore, LedgerListOptions } from "./types";

/**
 * Supabase-backed store. Mutations go through the `credit_apply` RPC, which is
 * revoked from `authenticated`, so the client passed in must be the service-role
 * client (workflow steps, internal endpoints, admin server code). Reads work with
 * any client; RLS restricts user clients to their own workspaces.
 *
 * No `server-only` import here so the mapping logic stays unit-testable; the
 * server entry point (`./server.ts`) adds it.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** PostgREST caps a single response; ranges page through in chunks of this size. */
const RANGE_PAGE_SIZE = 1000;
/** Guard against unbounded aggregation requests. */
const RANGE_MAX_ROWS = 50_000;

interface RpcErrorShape {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
}

export function createSupabaseCreditStore(client: SupabaseClient): CreditStore {
  return {
    async apply(input: CreditApplyInput): Promise<CreditLedgerRow> {
      const { data, error } = await client.rpc("credit_apply", {
        p_workspace: input.workspaceId,
        p_type: input.type,
        p_amount: input.amount,
        p_reference_type: input.referenceType,
        p_reference_id: input.referenceId,
        p_idempotency_key: input.idempotencyKey,
        p_metadata: input.metadata ?? {},
        p_actor: input.actorId ?? null,
      });
      if (error) throw mapCreditRpcError(error);
      const row = unwrapRow(data);
      if (!row) throw new AppError("internal_error", "credit_apply returned no ledger row", { details: { idempotencyKey: input.idempotencyKey } });
      return row;
    },

    async getAccount(workspaceId: string): Promise<CreditAccountRow | null> {
      const { data, error } = await client.from("credit_accounts").select("*").eq("workspace_id", workspaceId).maybeSingle<CreditAccountRow>();
      if (error) throw toAppError(error);
      return data ?? null;
    },

    async getReservation(referenceType: string, referenceId: string): Promise<CreditReservationRow | null> {
      const { data, error } = await client
        .from("credit_reservations")
        .select("*")
        .eq("reference_type", referenceType)
        .eq("reference_id", referenceId)
        .maybeSingle<CreditReservationRow>();
      if (error) throw toAppError(error);
      return data ?? null;
    },

    async getLedgerEntry(idempotencyKey: string): Promise<CreditLedgerRow | null> {
      const { data, error } = await client.from("credit_ledger").select("*").eq("idempotency_key", idempotencyKey).maybeSingle<CreditLedgerRow>();
      if (error) throw toAppError(error);
      return data ?? null;
    },

    async listLedger(workspaceId: string, opts: LedgerListOptions = {}): Promise<CreditLedgerRow[]> {
      const limit = clampLimit(opts.limit);
      let query = client.from("credit_ledger").select("*").eq("workspace_id", workspaceId);
      if (opts.types && opts.types.length > 0) query = query.in("type", opts.types);
      if (opts.before) query = query.lt("created_at", opts.before);
      const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit).returns<CreditLedgerRow[]>();
      if (error) throw toAppError(error);
      return data ?? [];
    },

    async listLedgerRange(workspaceId: string, from: string, to: string): Promise<CreditLedgerRow[]> {
      const rows: CreditLedgerRow[] = [];
      for (let offset = 0; offset < RANGE_MAX_ROWS; offset += RANGE_PAGE_SIZE) {
        const { data, error } = await client
          .from("credit_ledger")
          .select("*")
          .eq("workspace_id", workspaceId)
          .gte("created_at", from)
          .lt("created_at", to)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + RANGE_PAGE_SIZE - 1)
          .returns<CreditLedgerRow[]>();
        if (error) throw toAppError(error);
        const page = data ?? [];
        rows.push(...page);
        if (page.length < RANGE_PAGE_SIZE) break;
      }
      return rows;
    },
  };
}

/**
 * Translate `credit_apply` failures into typed errors. The function raises
 * `insufficient_credits` (detail `available=%s required=%s`) and
 * `refund_exceeds_reservation` (detail `remaining=%s requested=%s`).
 */
export function mapCreditRpcError(error: unknown): AppError {
  if (isAppError(error)) return error;
  const shape: RpcErrorShape = typeof error === "object" && error !== null ? (error as RpcErrorShape) : {};
  const message = typeof shape.message === "string" ? shape.message : "";
  const details = typeof shape.details === "string" ? shape.details : "";
  const haystack = `${message} ${details}`;

  if (haystack.includes("insufficient_credits")) {
    const m = /available=(\d+)\s+required=(\d+)/.exec(details) ?? /available=(\d+)\s+required=(\d+)/.exec(message);
    const available = m ? Number(m[1]) : 0;
    const required = m ? Number(m[2]) : 0;
    return new InsufficientCreditsError(required, available, { cause: error });
  }
  if (haystack.includes("refund_exceeds_reservation")) {
    const m = /remaining=(\d+)\s+requested=(\d+)/.exec(details) ?? /remaining=(\d+)\s+requested=(\d+)/.exec(message);
    return new ConflictError("Refund exceeds the remaining reservation", {
      cause: error,
      details: { reason: "refund_exceeds_reservation", remaining: m ? Number(m[1]) : undefined, requested: m ? Number(m[2]) : undefined },
    });
  }
  return toAppError(error, "Credit operation failed");
}

/** PostgREST returns a single composite row as an object; be lenient about a one-element array. */
function unwrapRow(data: unknown): CreditLedgerRow | null {
  const candidate = Array.isArray(data) ? data[0] : data;
  if (typeof candidate !== "object" || candidate === null) return null;
  const row = candidate as Partial<CreditLedgerRow>;
  if (typeof row.id !== "string" || typeof row.idempotency_key !== "string") return null;
  return candidate as CreditLedgerRow;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}
