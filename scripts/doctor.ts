/**
 * Checks that this environment is actually ready to run the app.
 *
 *   npm run doctor
 *
 * Read-only: it creates nothing and changes nothing. It answers the questions
 * that otherwise surface as confusing failures later — is the environment file
 * being seen at all, is the schema applied, can the service role reach auth,
 * and which providers are live versus demo.
 *
 * No secret values are printed, only whether each one is present.
 */
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// A plain tsx script gets none of Next.js's env loading.
loadEnvConfig(process.cwd(), true, { info: () => undefined, error: () => undefined });

type Status = "ok" | "warn" | "fail";

const MARK: Record<Status, string> = { ok: "  ok  ", " warn": " warn ", warn: " warn ", fail: " FAIL " } as Record<Status, string>;

let failures = 0;
let warnings = 0;

function line(status: Status, label: string, detail = ""): void {
  if (status === "fail") failures += 1;
  if (status === "warn") warnings += 1;
  console.log(`  [${MARK[status]}] ${label.padEnd(32)} ${detail}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/** Tables the app cannot run without, and the column each migration adds last. */
const CORE_TABLES = [
  "profiles",
  "workspaces",
  "workspace_members",
  "credit_accounts",
  "credit_ledger",
  "categories",
  "services",
  "service_rules",
  "plans",
  "credit_pricing_rules",
  "scans",
  "businesses",
  "opportunities",
  "message_templates",
];

const SEEDED_TABLES = ["categories", "services", "service_rules", "plans", "credit_pricing_rules", "message_templates"];

async function checkDatabase(client: SupabaseClient): Promise<void> {
  section("Schema");
  let missing = 0;
  const counts = new Map<string, number>();

  for (const table of CORE_TABLES) {
    // NOT `head: true`: PostgREST answers a HEAD request with 204 and no error
    // even for a table that does not exist, so a head probe passes for
    // everything and is useless as an existence check. A real select returns
    // PGRST205 when the table is missing.
    const { error, count } = await client.from(table).select("*", { count: "exact" }).limit(1);
    if (error) {
      missing += 1;
      const absent = error.code === "PGRST205" || error.code === "42P01" || /does not exist|schema cache/i.test(error.message);
      line("fail", table, absent ? "table does not exist" : error.message);
    } else {
      counts.set(table, count ?? 0);
    }
  }

  if (missing === 0) line("ok", "core tables", `all ${CORE_TABLES.length} present`);
  else line("fail", "migrations", "apply supabase/migrations in filename order");

  // Added by the second migration; only meaningful once the base schema exists.
  if (missing === 0) {
    const { error: unlimitedError } = await client.from("credit_accounts").select("unlimited").limit(1);
    if (unlimitedError) line("fail", "unlimited credits migration", "20260918010000_unlimited_credits.sql not applied");
    else line("ok", "unlimited credits migration", "applied");
  }

  if (missing === 0) {
    section("Reference data");
    let empty = 0;
    for (const table of SEEDED_TABLES) {
      const count = counts.get(table) ?? 0;
      if (count === 0) {
        empty += 1;
        line("warn", table, "empty");
      } else {
        line("ok", table, `${count} rows`);
      }
    }
    if (empty > 0) line("warn", "seed", "run supabase/seed.sql; scans cannot score without services and rules");
  }
}

async function checkAuth(client: SupabaseClient): Promise<void> {
  section("Auth");
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    line("fail", "service role can reach auth", error.message);
    return;
  }
  line("ok", "service role can reach auth", data.users.length > 0 ? "users exist" : "no users yet");
}

function checkProviders(): void {
  section("Providers");
  const demoForced = process.env.DEMO_MODE === "true";
  const entry = (label: string, value: string | undefined, what: string) => {
    if (demoForced) line("warn", label, `demo (DEMO_MODE=true)`);
    else if (value) line("ok", label, what);
    else line("warn", label, `not set — using demo ${what}`);
  };
  entry("Google Places", process.env.GOOGLE_PLACES_API_KEY, "real business discovery");
  entry("OpenAI", process.env.OPENAI_API_KEY, "AI drafting");
  entry("PageSpeed", process.env.GOOGLE_PAGESPEED_API_KEY, "measured performance");
  if (process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY) line("ok", "Google Maps (browser)", "maps render");
  else line("warn", "Google Maps (browser)", "not set — map falls back to a placeholder");
}

async function main(): Promise<void> {
  console.log(`\nOpportunityOS doctor — ${process.cwd()}`);

  section("Environment");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (url) line("ok", "NEXT_PUBLIC_SUPABASE_URL", new URL(url).host);
  else line("fail", "NEXT_PUBLIC_SUPABASE_URL", "not set — checked .env.local and .env");
  if (publishable) line("ok", "publishable / anon key", "set");
  else line("fail", "publishable / anon key", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set");
  if (serviceRole) line("ok", "service role key", "set");
  else line("warn", "service role key", "not set — workflows, admin and this script's writes need it");
  line(process.env.NEXT_PUBLIC_APP_URL ? "ok" : "warn", "NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL ?? "defaults to http://localhost:3000");

  if (url && serviceRole) {
    const client = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
    try {
      await checkDatabase(client);
      await checkAuth(client);
    } catch (err) {
      line("fail", "database", err instanceof Error ? err.message : String(err));
    }
  } else {
    section("Schema");
    line("warn", "skipped", "needs the URL and the service role key");
  }

  checkProviders();

  console.log(
    failures > 0
      ? `\n${failures} blocking problem(s)${warnings > 0 ? `, ${warnings} warning(s)` : ""}. Fix the failures above before running the app.\n`
      : warnings > 0
        ? `\nReady, with ${warnings} warning(s) — the app runs, using demo data where a provider is missing.\n`
        : "\nEverything checks out.\n",
  );
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((err: unknown) => {
  console.error(`\n  doctor failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
