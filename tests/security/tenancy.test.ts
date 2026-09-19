import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// vitest does not read .env.local the way `next` does, and these tests are
// worthless without a real database — so load it here rather than silently
// skipping on a machine that is in fact configured. Existing values win, so CI
// secrets are never overwritten by a stray local file.
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
 * Negative security tests executed against a real Postgres through PostgREST,
 * as a real signed-in user — not through the application's service layer.
 *
 * The service layer is not a security boundary: anyone holding a session can
 * talk to PostgREST directly with the publishable key. These tests therefore
 * assert what the *database* permits, which is the only boundary that holds
 * when the API is bypassed.
 *
 * Requires a live Supabase and a service-role key, so it is skipped unless
 * both are present. Run with:
 *   npx vitest run tests/security/tenancy.test.ts
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const live = Boolean(url && anonKey && serviceKey);

const suite = live ? describe : describe.skip;

interface Tenant {
  userId: string;
  email: string;
  password: string;
  workspaceId: string;
  businessId: string;
  scanId: string;
  templateId: string;
}

let admin: SupabaseClient;
/** Signed in as tenant A. Everything an attacker can reach with a session. */
let asA: SupabaseClient;
let A: Tenant;
let B: Tenant;

function creds(tag: string) {
  const nonce = Math.random().toString(36).slice(2, 10);
  return { email: `sectest-${tag}-${nonce}@example.com`, password: `Pw-${nonce}-${Math.random().toString(36).slice(2, 10)}!` };
}

async function makeTenant(tag: string): Promise<Tenant> {
  const { email, password } = creds(tag);
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error("user not created");
  const userId = created.data.user.id;

  // The profiles row arrives via trigger; make sure it exists before we lean on it.
  for (let i = 0; i < 20 && !(await admin.from("profiles").select("id").eq("id", userId).maybeSingle()).data; i += 1) {
    await new Promise((r) => setTimeout(r, 150));
  }

  const ws = await admin
    .from("workspaces")
    .insert({ name: `sec-${tag}-${userId.slice(0, 8)}`, slug: `sec-${tag}-${userId.slice(0, 8)}`, owner_id: userId })
    .select("id")
    .single<{ id: string }>();
  if (ws.error) throw ws.error;
  const workspaceId = ws.data.id;

  const member = await admin.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
  if (member.error) throw member.error;

  const biz = await admin
    .from("businesses")
    .insert({ workspace_id: workspaceId, provider: "demo", provider_place_id: `sec-${tag}-${userId.slice(0, 8)}`, last_seen_at: new Date().toISOString() })
    .select("id")
    .single<{ id: string }>();
  if (biz.error) throw biz.error;

  const scan = await admin
    .from("scans")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: `sec-${tag}`,
      location_method: "radius",
      center_lat: 41,
      center_lng: 29,
      radius_m: 1000,
      estimated_credits: 10,
      reserved_credits: 10,
      consumed_credits: 4,
    })
    .select("id")
    .single<{ id: string }>();
  if (scan.error) throw scan.error;

  const tpl = await admin
    .from("message_templates")
    .insert({ workspace_id: workspaceId, scope: "workspace", name: `sec-${tag}`, channel: "whatsapp", body: "hello" })
    .select("id")
    .single<{ id: string }>();
  if (tpl.error) throw tpl.error;

  return { userId, email, password, workspaceId, businessId: biz.data.id, scanId: scan.data.id, templateId: tpl.data.id };
}

beforeAll(async () => {
  if (!live) return;
  admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  A = await makeTenant("a");
  B = await makeTenant("b");

  asA = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await asA.auth.signInWithPassword({ email: A.email, password: A.password });
  if (signIn.error) throw signIn.error;
}, 120_000);

afterAll(async () => {
  if (!live || !admin) return;
  for (const t of [A, B]) {
    if (!t) continue;
    await admin.from("workspaces").delete().eq("id", t.workspaceId);
    await admin.auth.admin.deleteUser(t.userId).catch(() => undefined);
  }
}, 120_000);

suite("cross-tenant reads are impossible with a session", () => {
  const tables = ["businesses", "scans", "leads", "credit_accounts", "credit_ledger", "message_templates", "business_provider_snapshots"];

  it.each(tables)("%s: tenant A sees none of tenant B's rows", async (table) => {
    const { data, error } = await asA.from(table).select("*").eq("workspace_id", B.workspaceId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("selecting tenant B's business by primary key returns nothing", async () => {
    const { data } = await asA.from("businesses").select("id").eq("id", B.businessId);
    expect(data ?? []).toHaveLength(0);
  });
});

suite("cross-tenant writes are impossible with a session", () => {
  it("cannot update tenant B's business", async () => {
    const { data, error } = await asA.from("businesses").update({ is_ignored: true }).eq("id", B.businessId).select("id");
    expect(error?.code ?? null).not.toBe("PGRST301");
    expect(data ?? []).toHaveLength(0);
    const after = await admin.from("businesses").select("is_ignored").eq("id", B.businessId).single<{ is_ignored: boolean }>();
    expect(after.data?.is_ignored).toBe(false);
  });

  it("cannot insert a scan into tenant B's workspace", async () => {
    const { error } = await asA.from("scans").insert({
      workspace_id: B.workspaceId,
      created_by: A.userId,
      name: "injected",
      location_method: "radius",
      center_lat: 41,
      center_lng: 29,
      radius_m: 1000,
    });
    expect(error).not.toBeNull();
  });

  it("cannot insert a provider snapshot into tenant B's workspace", async () => {
    const { error } = await asA.from("business_provider_snapshots").insert({
      business_id: B.businessId,
      workspace_id: B.workspaceId,
      provider: "demo",
      provider_place_id: "injected",
      display_name: "injected",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(error).not.toBeNull();
  });

  it("cannot delete tenant B's provider snapshots", async () => {
    const { data } = await asA.from("business_provider_snapshots").delete().eq("workspace_id", B.workspaceId).select("id");
    expect(data ?? []).toHaveLength(0);
  });
});

suite("the credit ledger is not client-writable", () => {
  it("cannot insert a ledger row", async () => {
    const { error } = await asA.from("credit_ledger").insert({
      workspace_id: A.workspaceId,
      type: "grant",
      amount: 1_000_000,
      balance_after: 1_000_000,
      reserved_after: 0,
    });
    expect(error).not.toBeNull();
  });

  it("cannot raise its own balance", async () => {
    const { data } = await asA.from("credit_accounts").update({ balance: 999_999 }).eq("workspace_id", A.workspaceId).select("workspace_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot mark its own account unlimited", async () => {
    const { data } = await asA.from("credit_accounts").update({ unlimited: true }).eq("workspace_id", A.workspaceId).select("workspace_id");
    expect(data ?? []).toHaveLength(0);
    const after = await admin.from("credit_accounts").select("unlimited").eq("workspace_id", A.workspaceId).maybeSingle<{ unlimited: boolean }>();
    expect(after.data?.unlimited ?? false).toBe(false);
  });

  it("cannot call set_workspace_unlimited without platform admin", async () => {
    const { error } = await asA.rpc("set_workspace_unlimited", { p_workspace: A.workspaceId, p_unlimited: true });
    expect(error).not.toBeNull();
  });
});

suite("privilege escalation is impossible", () => {
  it("cannot grant itself platform admin", async () => {
    const { error } = await asA.from("profiles").update({ is_platform_admin: true }).eq("id", A.userId).select("id");
    expect(error).not.toBeNull();
    const after = await admin.from("profiles").select("is_platform_admin").eq("id", A.userId).single<{ is_platform_admin: boolean }>();
    expect(after.data?.is_platform_admin).toBe(false);
  });

  it("cannot add itself to tenant B's workspace", async () => {
    const { error } = await asA.from("workspace_members").insert({ workspace_id: B.workspaceId, user_id: A.userId, role: "owner" });
    expect(error).not.toBeNull();
  });

  it("cannot delete tenant B's workspace", async () => {
    const { error } = await asA.rpc("delete_workspace", { p_workspace: B.workspaceId });
    expect(error).not.toBeNull();
    const after = await admin.from("workspaces").select("id").eq("id", B.workspaceId).maybeSingle();
    expect(after.data).not.toBeNull();
  });
});

suite("server-owned scan state is not client-writable", () => {
  /**
   * One column per statement, deliberately.
   *
   * The first version of this test set a credit column and status together.
   * Postgres rejects the whole UPDATE for the column the role lacks privilege
   * on, so status never moved and the test passed while a status-only UPDATE
   * was in fact accepted. Bundling columns hides exactly the gap being tested.
   */
  it.each([
    ["consumed_credits", 0, 4],
    ["reserved_credits", 0, 10],
    ["refunded_credits", 999, 0],
  ])("a member cannot rewrite %s on its own scan", async (column, attempt, expected) => {
    await asA.from("scans").update({ [column]: attempt }).eq("id", A.scanId);
    const after = await admin.from("scans").select(column).eq("id", A.scanId).single<Record<string, number>>();
    expect(after.data?.[column]).toBe(expected);
  });

  it.each(["completed", "queued", "failed", "cancelled", "discovering"])(
    "a member cannot drive its own scan to '%s' by hand",
    async (target) => {
      await asA.from("scans").update({ status: target }).eq("id", A.scanId);
      const after = await admin.from("scans").select("status").eq("id", A.scanId).single<{ status: string }>();
      expect(after.data?.status).toBe("created");
    },
  );

  it.each(["started_at", "cancelled_at", "completed_at"])("a member cannot stamp %s by hand", async (column) => {
    await asA.from("scans").update({ [column]: new Date().toISOString() }).eq("id", A.scanId);
    const after = await admin.from("scans").select(column).eq("id", A.scanId).single<Record<string, string | null>>();
    expect(after.data?.[column]).toBeNull();
  });

  it("cancellation still works, but only through the guarded function", async () => {
    const { error } = await asA.rpc("request_scan_cancellation", { p_scan: A.scanId });
    expect(error).toBeNull();
    const after = await admin.from("scans").select("status").eq("id", A.scanId).single<{ status: string }>();
    expect(after.data?.status).toBe("cancelled");
  });

  it("the cancellation function refuses a scan in another workspace", async () => {
    const { error } = await asA.rpc("request_scan_cancellation", { p_scan: B.scanId });
    expect(error).not.toBeNull();
    const after = await admin.from("scans").select("status").eq("id", B.scanId).single<{ status: string }>();
    expect(after.data?.status).toBe("created");
  });

  it("the cancellation function refuses a terminal scan", async () => {
    // A.scanId is already cancelled by the test above; cancelling again must
    // fail rather than restamp the timestamps.
    const { error } = await asA.rpc("request_scan_cancellation", { p_scan: A.scanId });
    expect(error).not.toBeNull();
  });

  it("a member cannot hijack the workflow run id", async () => {
    await asA.from("scans").update({ workflow_run_id: "attacker-controlled" }).eq("id", A.scanId);
    const after = await admin.from("scans").select("workflow_run_id").eq("id", A.scanId).single<{ workflow_run_id: string | null }>();
    expect(after.data?.workflow_run_id).toBeNull();
  });
});

suite("provider retention cannot be defeated from a session", () => {
  it("a snapshot cannot be given an expiry beyond the retention ceiling", async () => {
    const farFuture = new Date(Date.now() + 365 * 86_400_000).toISOString();
    const { error } = await asA.from("business_provider_snapshots").insert({
      business_id: A.businessId,
      workspace_id: A.workspaceId,
      provider: "demo",
      provider_place_id: "retention-probe",
      display_name: "retention probe",
      expires_at: farFuture,
    });
    expect(error).not.toBeNull();
  });
});

suite("security definer functions check their caller", () => {
  it("increment_template_usage refuses a template in another workspace", async () => {
    const before = await admin.from("message_templates").select("usage_count").eq("id", B.templateId).single<{ usage_count: number }>();
    await asA.rpc("increment_template_usage", { p_template: B.templateId }).then(
      () => undefined,
      () => undefined,
    );
    const after = await admin.from("message_templates").select("usage_count").eq("id", B.templateId).single<{ usage_count: number }>();
    expect(after.data?.usage_count).toBe(before.data?.usage_count);
  });

  it("privileged maintenance functions are not executable by a session", async () => {
    for (const fn of ["credit_apply_scoped", "purge_expired_provider_cache", "rate_limit_hit", "increment_scan_counters", "touch_public_report"]) {
      const { error } = await asA.rpc(fn, {});
      expect(error, `${fn} must not be callable by authenticated`).not.toBeNull();
    }
  });
});

suite("public report tokens are not stored in plaintext", () => {
  it("the plaintext column no longer exists", async () => {
    // Asserted against the live schema, not the migration text: the point is
    // what the database actually holds.
    const { error } = await admin.from("public_reports").select("token").limit(1);
    expect(error).not.toBeNull();
    expect(`${error?.message} ${error?.code}`).toMatch(/token|42703|does not exist/i);
  });

  it("a stored report reveals only a digest and a non-secret prefix", async () => {
    const token = randomBytes(32).toString("base64url");
    const digest = createHash("sha256").update(token, "utf8").digest("hex");
    const ins = await admin
      .from("public_reports")
      .insert({
        workspace_id: A.workspaceId,
        business_id: A.businessId,
        token_hash: digest,
        token_prefix: token.slice(0, 12),
        title: "digest probe",
        locale: "tr",
        content_snapshot: {},
        branding: {},
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select("id, token_hash, token_prefix")
      .single<{ id: string; token_hash: string; token_prefix: string }>();
    expect(ins.error).toBeNull();

    // Everything persisted, serialised: the secret must not appear anywhere.
    const row = await admin.from("public_reports").select("*").eq("id", ins.data!.id).single();
    expect(JSON.stringify(row.data)).not.toContain(token);
    expect(ins.data?.token_hash).toBe(digest);
    expect(token.startsWith(ins.data!.token_prefix)).toBe(true);

    // The digest resolves the row; a different token does not.
    const hit = await admin.from("public_reports").select("id").eq("token_hash", digest).maybeSingle<{ id: string }>();
    expect(hit.data?.id).toBe(ins.data?.id);
    const wrong = createHash("sha256").update(randomBytes(32).toString("base64url"), "utf8").digest("hex");
    const miss = await admin.from("public_reports").select("id").eq("token_hash", wrong).maybeSingle();
    expect(miss.data).toBeNull();

    await admin.from("public_reports").delete().eq("id", ins.data!.id);
  });

  it("the view counter is not callable from a session", async () => {
    const { error } = await asA.rpc("touch_public_report", { p_token_hash: "x".repeat(64) });
    expect(error).not.toBeNull();
  });
});
