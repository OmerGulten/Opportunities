import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1]!;
    if (process.env[key] !== undefined) continue;
    process.env[key] = match[2]!.trim().replace(/^["']|["']$/g, "");
  }
}

/**
 * Credit ledger under concurrency, against a real Postgres.
 *
 * The ledger is the application's accounting system, so the properties that
 * matter are arithmetic ones that must hold no matter how requests interleave:
 * an idempotency key moves credits once, a balance cannot be spent twice, and
 * a refund cannot be claimed twice. Sequential tests cannot observe any of that.
 *
 * Everything runs through credit_apply_scoped with the service-role client,
 * which is the same path the application uses.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const live = Boolean(url && serviceKey);
const suite = live ? describe : describe.skip;

let admin: SupabaseClient;
let userId: string;
let workspaceId: string;

async function apply(type: string, amount: number, key: string, reference = "probe") {
  return admin.rpc("credit_apply_scoped", {
    p_workspace: workspaceId,
    p_type: type,
    p_amount: amount,
    p_reference_type: "scan",
    p_reference_id: reference,
    p_idempotency_key: key,
    p_metadata: {},
    p_actor: userId,
  });
}

async function account() {
  const { data } = await admin
    .from("credit_accounts")
    .select("balance, reserved, lifetime_consumed")
    .eq("workspace_id", workspaceId)
    .single<{ balance: number; reserved: number; lifetime_consumed: number }>();
  return data!;
}

beforeAll(async () => {
  if (!live) return;
  admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const nonce = Math.random().toString(36).slice(2, 10);
  const created = await admin.auth.admin.createUser({ email: `credtest-${nonce}@example.com`, password: `Pw-${nonce}-aZ9!`, email_confirm: true });
  if (created.error) throw created.error;
  userId = created.data.user!.id;
  for (let i = 0; i < 20 && !(await admin.from("profiles").select("id").eq("id", userId).maybeSingle()).data; i += 1) {
    await new Promise((r) => setTimeout(r, 150));
  }
  const ws = await admin.from("workspaces").insert({ name: `cred-${nonce}`, slug: `cred-${nonce}`, owner_id: userId }).select("id").single<{ id: string }>();
  if (ws.error) throw ws.error;
  workspaceId = ws.data.id;
  await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
  await admin.from("credit_accounts").insert({ workspace_id: workspaceId, balance: 0, reserved: 0 });
  const grant = await apply("monthly_grant", 100, `grant-${nonce}`);
  if (grant.error) throw grant.error;
}, 120_000);

afterAll(async () => {
  if (!live || !admin) return;
  await admin.from("workspaces").delete().eq("id", workspaceId);
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
}, 120_000);

suite("credit ledger under concurrency", () => {
  it("an idempotency key moves credits exactly once under parallel replay", async () => {
    const before = await account();
    const key = `dup-${Math.random().toString(36).slice(2)}`;

    // Twenty simultaneous attempts at the same logical operation: a retried
    // request, a duplicated workflow step, an impatient user.
    const results = await Promise.all(Array.from({ length: 20 }, () => apply("consumption", 5, key)));
    const accepted = results.filter((r) => !r.error).length;
    expect(accepted).toBeGreaterThan(0);

    const after = await account();
    expect(before.balance - after.balance).toBe(5);

    const { count } = await admin.from("credit_ledger").select("*", { count: "exact", head: false }).eq("idempotency_key", key).limit(50);
    expect(count).toBe(1);
  }, 60_000);

  it("parallel spending never drives the balance negative", async () => {
    const before = await account();
    // Far more concurrent spend than the balance can cover.
    const attempts = Array.from({ length: 40 }, (_, i) => apply("consumption", 10, `race-${Date.now()}-${i}`));
    await Promise.all(attempts);

    const after = await account();
    expect(after.balance).toBeGreaterThanOrEqual(0);
    expect(after.balance).toBeLessThanOrEqual(before.balance);
  }, 60_000);

  it("the account totals reconcile with the ledger", async () => {
    const { data: rows } = await admin
      .from("credit_ledger")
      .select("amount")
      .eq("workspace_id", workspaceId)
      .returns<Array<{ amount: number }>>();
    const sum = (rows ?? []).reduce((total, row) => total + row.amount, 0);
    const current = await account();
    // Every movement is a ledger row, so the balance is their sum by construction.
    expect(current.balance).toBe(sum);
  }, 60_000);

  it("the ledger is append-only even for the service role", async () => {
    const { data: row } = await admin.from("credit_ledger").select("id").eq("workspace_id", workspaceId).limit(1).single<{ id: string }>();
    const update = await admin.from("credit_ledger").update({ amount: 999_999 }).eq("id", row!.id);
    expect(update.error).not.toBeNull();
    const del = await admin.from("credit_ledger").delete().eq("id", row!.id);
    expect(del.error).not.toBeNull();
  }, 60_000);
});
