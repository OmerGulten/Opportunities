/**
 * Creates (or upgrades) a platform administrator with an unlimited workspace.
 *
 * Run it against whichever Supabase your environment points at:
 *
 *   npx tsx scripts/create-admin.ts --email you@example.com
 *   npx tsx scripts/create-admin.ts --email you@example.com --workspace "My Agency"
 *
 * It is idempotent: run it again to re-apply admin rights, re-mark the
 * workspace unlimited, or issue a fresh password link.
 *
 * What it does:
 *   1. creates the auth user (or finds the existing one) with a confirmed email
 *   2. sets profiles.is_platform_admin, unlocking /admin
 *   3. creates a workspace owned by that user, with default stages and services
 *   4. marks the workspace's credit account `unlimited`, so scans and AI drafts
 *      are recorded but never billed
 *
 * Passwords: this script never takes one as an argument (it would land in your
 * shell history and the process list). It generates a strong one, prints it
 * once, and you change it after signing in. Pass --no-password to skip the
 * password entirely and print a one-time magic link instead.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY: creating users and granting platform
 * admin are deliberately not things a user session can do.
 */
import { randomBytes } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { slugify } from "../src/lib/utils/slug";

// A plain tsx script gets none of Next.js's env loading, so read .env.local
// (and the rest of the chain, in the same order the app uses) before anything
// reaches for process.env. Without this the script cannot see the file it tells
// you to edit.
loadEnvConfig(process.cwd(), true, { info: () => undefined, error: () => undefined });

interface Options {
  email: string;
  workspaceName: string;
  displayName: string | null;
  withPassword: boolean;
}

function parseArgs(argv: string[]): Options {
  /**
   * Accepts `--flag value`, `--flag=value`, and `--flag two words` unquoted.
   *
   * PowerShell and npm between them frequently strip the quotes from
   * `-- --workspace "Gulten Agency"`, which would otherwise silently become
   * "Gulten". Everything up to the next flag is taken as the value.
   */
  const get = (flag: string): string | undefined => {
    const inline = argv.find((arg) => arg.startsWith(`${flag}=`));
    if (inline) return inline.slice(flag.length + 1).trim() || undefined;

    const start = argv.indexOf(flag);
    if (start < 0) return undefined;
    const words: string[] = [];
    for (let i = start + 1; i < argv.length && !argv[i].startsWith("--"); i += 1) words.push(argv[i]);
    return words.join(" ").trim() || undefined;
  };
  const email = get("--email") ?? process.env.ADMIN_EMAIL ?? "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    fail("Pass a valid address: --email you@example.com (or set ADMIN_EMAIL)");
  }
  return {
    email: email.toLowerCase(),
    workspaceName: get("--workspace") ?? process.env.ADMIN_WORKSPACE ?? "OpportunityOS",
    displayName: get("--name") ?? process.env.ADMIN_NAME ?? null,
    withPassword: !argv.includes("--no-password"),
  };
}

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

/** Strong, printable, and never taken from the command line. */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
  const bytes = randomBytes(24);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabase has used both names for the same secret across dashboard versions.
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL is not set.\n" +
        `  Checked .env.local, .env.development.local, .env.development and .env in ${process.cwd()}.\n` +
        "  Set it there, or export it for this shell.",
    );
  }
  if (!serviceRole) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY is not set (SUPABASE_SECRET_KEY also accepted).\n" +
        "  Local: run `npm run db:start` and copy the printed service_role key.\n" +
        "  Hosted: Supabase dashboard > Project settings > API > service_role.",
    );
  }
  return createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Finds a user by address without assuming the project is small. */
async function findUserByEmail(client: SupabaseClient, email: string): Promise<{ id: string } | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return { id: match.id };
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(client: SupabaseClient, opts: Options): Promise<{ id: string; created: boolean; password: string | null }> {
  const existing = await findUserByEmail(client, opts.email);
  if (existing) return { id: existing.id, created: false, password: null };

  const password = opts.withPassword ? generatePassword() : generatePassword();
  const { data, error } = await client.auth.admin.createUser({
    email: opts.email,
    password,
    email_confirm: true,
    user_metadata: opts.displayName ? { display_name: opts.displayName } : {},
  });
  if (error || !data.user) throw error ?? new Error("The user could not be created");
  return { id: data.user.id, created: true, password: opts.withPassword ? password : null };
}

/** The profiles row is created by a trigger; give it a moment on a fresh user. */
async function waitForProfile(client: SupabaseClient, userId: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data } = await client.from("profiles").select("id").eq("id", userId).maybeSingle<{ id: string }>();
    if (data) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  // The trigger may be absent on a partially migrated database; insert directly.
  await client.from("profiles").insert({ id: userId }).select("id").maybeSingle();
}

async function ensureWorkspace(client: SupabaseClient, userId: string, name: string): Promise<{ id: string; created: boolean; name: string }> {
  const { data: membership } = await client
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name)")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle<{ workspace_id: string; workspaces: { id: string; name: string } | null }>();
  if (membership?.workspaces) {
    return { id: membership.workspaces.id, created: false, name: membership.workspaces.name };
  }

  // Mirrors public.create_workspace_with_defaults(): that function reads
  // auth.uid(), which a service-role script does not have, so the same rows are
  // written here instead. Keep the two in step when either one changes.
  const { data: plan } = await client.from("plans").select("id, key, monthly_credits").eq("is_default", true).maybeSingle<DefaultPlan>();

  let slug = slugify(name);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? slug : `${slug}-${randomBytes(2).toString("hex")}`;
    const { data: workspace, error } = await client
      .from("workspaces")
      .insert({ name, slug: candidate, owner_id: userId, plan_id: plan?.id ?? null })
      .select("id, name")
      .single<{ id: string; name: string }>();
    if (!error && workspace) {
      await seedWorkspace(client, workspace.id, userId, plan ?? null);
      return { id: workspace.id, created: true, name: workspace.name };
    }
    if (error && error.code !== "23505") throw error;
    slug = slugify(name);
  }
  throw new Error("Could not find a free workspace slug");
}

interface DefaultPlan {
  id: string;
  key: string;
  monthly_credits: number;
}

/** `YYYY-MM`, matching formatGrantPeriod() and the SQL bootstrap's to_char(now(), 'YYYY-MM'). */
function grantPeriod(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Subscription row plus the first period's credit grant.
 *
 * Without this a workspace looks complete but never appears in
 * /api/internal/cron/monthly-grants, which selects on subscriptions.status —
 * so it silently stops receiving its plan credits every month.
 *
 * `last_grant_period_start` is set to now and the grant reuses the cron's
 * idempotency key (`grant:<workspace>:<YYYY-MM>`), so a cron run in the same
 * month is a no-op rather than a second grant.
 */
async function seedSubscription(client: SupabaseClient, workspaceId: string, userId: string, plan: DefaultPlan): Promise<void> {
  const now = new Date();
  const subscription = await client.from("subscriptions").insert({
    workspace_id: workspaceId,
    plan_id: plan.id,
    status: "active",
    provider: "mock",
    last_grant_period_start: now.toISOString(),
  });
  if (subscription.error) throw subscription.error;

  if (plan.monthly_credits <= 0) return;
  const { error } = await client.rpc("credit_apply_scoped", {
    p_workspace: workspaceId,
    p_type: "monthly_grant",
    p_amount: plan.monthly_credits,
    p_reference_type: "plan",
    p_reference_id: plan.key,
    p_idempotency_key: `grant:${workspaceId}:${grantPeriod(now)}`,
    p_metadata: { plan: plan.key },
    p_actor: userId,
  });
  if (error) throw error;
}

/**
 * Default pipeline stages.
 *
 * Every row spells out every column on purpose. PostgREST builds one statement
 * from the union of keys across a batch and sends NULL for any key a row omits,
 * instead of letting the column default apply — so a row without `is_won` fails
 * the NOT NULL constraint as soon as any sibling row mentions it.
 */
const DEFAULT_STAGES = [
  { key: "new", name: "New", color: "slate", sort_order: 10, is_won: false, is_lost: false, is_default: true },
  { key: "contacted", name: "Contacted", color: "blue", sort_order: 20, is_won: false, is_lost: false, is_default: false },
  { key: "replied", name: "Replied", color: "violet", sort_order: 30, is_won: false, is_lost: false, is_default: false },
  { key: "meeting", name: "Meeting", color: "amber", sort_order: 40, is_won: false, is_lost: false, is_default: false },
  { key: "proposal", name: "Proposal", color: "orange", sort_order: 50, is_won: false, is_lost: false, is_default: false },
  { key: "won", name: "Won", color: "emerald", sort_order: 60, is_won: true, is_lost: false, is_default: false },
  { key: "lost", name: "Lost", color: "rose", sort_order: 70, is_won: false, is_lost: true, is_default: false },
] as const;

async function seedWorkspace(client: SupabaseClient, workspaceId: string, userId: string, plan: DefaultPlan | null): Promise<void> {
  // Each step is checked: a silently swallowed failure here leaves a workspace
  // that looks fine until the pipeline turns out to have no stages.
  const member = await client.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
  if (member.error) throw member.error;

  const account = await client.from("credit_accounts").insert({ workspace_id: workspaceId }).select("id").maybeSingle();
  if (account.error && account.error.code !== "23505") throw account.error;

  // After the credit account exists: the grant writes to it.
  if (plan) await seedSubscription(client, workspaceId, userId, plan);

  const stages = await client.from("pipeline_stages").insert(DEFAULT_STAGES.map((stage) => ({ ...stage, workspace_id: workspaceId })));
  if (stages.error) throw stages.error;

  const { data: services, error: servicesError } = await client
    .from("services")
    .select("id, sort_order")
    .eq("active", true)
    .returns<Array<{ id: string; sort_order: number }>>();
  if (servicesError) throw servicesError;
  if (!services || services.length === 0) {
    throw new Error("No active services found. Apply supabase/seed.sql first (npm run db:apply -- supabase/seed.sql).");
  }

  const workspaceServices = await client
    .from("workspace_services")
    .insert(services.map((service) => ({ workspace_id: workspaceId, service_id: service.id, enabled: true, priority: service.sort_order })));
  if (workspaceServices.error) throw workspaceServices.error;
}

/** Repairs a workspace seeded before this script wrote a subscription row. */
async function ensureSubscription(client: SupabaseClient, workspaceId: string, userId: string): Promise<string | null> {
  const { data: existing } = await client
    .from("subscriptions")
    .select("id, plans(key)")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle<{ id: string; plans: { key: string } | null }>();
  if (existing) return existing.plans?.key ?? null;

  const { data: plan } = await client.from("plans").select("id, key, monthly_credits").eq("is_default", true).maybeSingle<DefaultPlan>();
  if (!plan) return null;
  await seedSubscription(client, workspaceId, userId, plan);
  await client.from("workspaces").update({ plan_id: plan.id }).eq("id", workspaceId).is("plan_id", null);
  return plan.key;
}

/** Repairs a workspace created before this script checked its own writes. */
async function ensureStages(client: SupabaseClient, workspaceId: string): Promise<number> {
  const { count } = await client.from("pipeline_stages").select("*", { count: "exact" }).eq("workspace_id", workspaceId).limit(1);
  if ((count ?? 0) > 0) return count ?? 0;
  const { error } = await client.from("pipeline_stages").insert(DEFAULT_STAGES.map((stage) => ({ ...stage, workspace_id: workspaceId })));
  if (error) throw error;
  return DEFAULT_STAGES.length;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const client = adminClient();

  const user = await ensureUser(client, opts);
  await waitForProfile(client, user.id);

  const { error: profileError } = await client
    .from("profiles")
    .update({ is_platform_admin: true, ...(opts.displayName ? { display_name: opts.displayName } : {}) })
    .eq("id", user.id);
  if (profileError) throw profileError;

  const workspace = await ensureWorkspace(client, user.id, opts.workspaceName);
  // Idempotent repair for a workspace seeded before this script checked its writes.
  const stageCount = await ensureStages(client, workspace.id);
  const planKey = await ensureSubscription(client, workspace.id, user.id);

  await client.from("profiles").update({ default_workspace_id: workspace.id }).eq("id", user.id);

  // Never billed: operations are still recorded, the balance just stops mattering.
  const { error: unlimitedError } = await client
    .from("credit_accounts")
    .upsert({ workspace_id: workspace.id, unlimited: true }, { onConflict: "workspace_id" });
  if (unlimitedError) throw unlimitedError;

  let magicLink: string | null = null;
  if (!opts.withPassword || !user.created) {
    const { data, error } = await client.auth.admin.generateLink({ type: "magiclink", email: opts.email });
    if (!error) magicLink = data.properties?.action_link ?? null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log(`
  Platform admin ready.

    Email        ${opts.email}
    Workspace    ${workspace.name} ${workspace.created ? "(created)" : "(existing)"}
    Admin area   ${appUrl}/admin
    Stages       ${stageCount} pipeline stages
    Plan         ${planKey ? `${planKey} (active subscription)` : "none — no default plan in public.plans"}
    Credits      unlimited — scans and AI drafts are recorded but never billed
${user.password ? `\n    Password     ${user.password}\n                 Shown once. Change it after signing in.` : ""}${magicLink ? `\n    Sign-in link ${magicLink}\n                 Single use, expires shortly.` : ""}

  Sign in at ${appUrl}/sign-in
`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n  Failed: ${message}\n`);
  process.exit(1);
});
