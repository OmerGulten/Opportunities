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

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { slugify } from "../src/lib/utils/slug";

interface Options {
  email: string;
  workspaceName: string;
  displayName: string | null;
  withPassword: boolean;
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
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
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local or export it.");
  if (!serviceRole) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
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

  // Reuse the same bootstrap the onboarding wizard uses: plan grant, default
  // pipeline stages and enabled services all come with it.
  const { data: plan } = await client.from("plans").select("id, key, monthly_credits").eq("is_default", true).maybeSingle<{ id: string; key: string; monthly_credits: number }>();

  let slug = slugify(name);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? slug : `${slug}-${randomBytes(2).toString("hex")}`;
    const { data: workspace, error } = await client
      .from("workspaces")
      .insert({ name, slug: candidate, owner_id: userId, plan_id: plan?.id ?? null })
      .select("id, name")
      .single<{ id: string; name: string }>();
    if (!error && workspace) {
      await seedWorkspace(client, workspace.id, userId);
      return { id: workspace.id, created: true, name: workspace.name };
    }
    if (error && error.code !== "23505") throw error;
    slug = slugify(name);
  }
  throw new Error("Could not find a free workspace slug");
}

async function seedWorkspace(client: SupabaseClient, workspaceId: string, userId: string): Promise<void> {
  await client.from("workspace_members").insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
  await client.from("credit_accounts").insert({ workspace_id: workspaceId }).select("id").maybeSingle();

  await client.from("pipeline_stages").insert([
    { workspace_id: workspaceId, key: "new", name: "New", color: "slate", sort_order: 10, is_default: true },
    { workspace_id: workspaceId, key: "contacted", name: "Contacted", color: "blue", sort_order: 20 },
    { workspace_id: workspaceId, key: "replied", name: "Replied", color: "violet", sort_order: 30 },
    { workspace_id: workspaceId, key: "meeting", name: "Meeting", color: "amber", sort_order: 40 },
    { workspace_id: workspaceId, key: "proposal", name: "Proposal", color: "orange", sort_order: 50 },
    { workspace_id: workspaceId, key: "won", name: "Won", color: "emerald", sort_order: 60, is_won: true },
    { workspace_id: workspaceId, key: "lost", name: "Lost", color: "rose", sort_order: 70, is_lost: true },
  ]);

  const { data: services } = await client.from("services").select("id, sort_order").eq("active", true).returns<Array<{ id: string; sort_order: number }>>();
  if (services && services.length > 0) {
    await client.from("workspace_services").insert(
      services.map((service) => ({ workspace_id: workspaceId, service_id: service.id, enabled: true, priority: service.sort_order })),
    );
  }
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
