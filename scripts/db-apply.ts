/**
 * Applies a SQL file to the configured Postgres over a direct connection.
 *
 *   npm run db:apply -- supabase/migrations/20260918010000_unlimited_credits.sql
 *   npm run db:apply -- supabase/seed.sql
 *   npm run db:apply -- --all        # every migration in order, then the seed
 *
 * This exists because applying schema normally needs either Docker (for the
 * local stack) or an interactive `supabase login`. With a hosted project you
 * already have the connection string, and this uses it directly.
 *
 * Each file is sent as a single statement batch so the server does its own
 * parsing — dollar-quoted function bodies (`$$ ... $$`) survive intact, which
 * naive splitting on semicolons would destroy. Each file runs in a transaction,
 * so a failure leaves nothing half-applied.
 *
 * Connection: POSTGRES_URL_NON_POOLING is preferred. DDL must not go through
 * the pooler, which rejects some session-level statements.
 */
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { loadEnvConfig } from "@next/env";
import { Client } from "pg";

loadEnvConfig(process.cwd(), true, { info: () => undefined, error: () => undefined });

function connectionString(): string {
  const direct = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!direct) {
    console.error(
      "\n  No connection string.\n" +
        "  Set POSTGRES_URL_NON_POOLING (preferred), POSTGRES_URL or DATABASE_URL.\n" +
        "  Supabase dashboard > Project settings > Database > Connection string > URI.\n",
    );
    process.exit(1);
  }

  // `sslmode` in the URL wins over the client's ssl option, and recent pg treats
  // `require` as `verify-full`. Supabase's chain is not in Node's trust store, so
  // that fails. Drop the parameter and let the explicit ssl option below decide.
  try {
    const url = new URL(direct);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("ssl");
    return url.toString();
  } catch {
    return direct;
  }
}

/**
 * TLS for the admin connection.
 *
 * The connection is always encrypted. Certificate verification is off by
 * default because Supabase's chain is not in Node's default trust store and
 * this is an operator tool run by the project owner against their own database.
 * Set PGSSLROOTCERT to a CA file to verify properly.
 */
function sslOptions(): { rejectUnauthorized: boolean; ca?: string } {
  const caPath = process.env.PGSSLROOTCERT;
  if (caPath) return { rejectUnauthorized: true, ca: readFileSync(caPath, "utf8") };
  return { rejectUnauthorized: false };
}

function filesToApply(argv: string[]): string[] {
  if (argv.includes("--all")) {
    const dir = join(process.cwd(), "supabase", "migrations");
    const migrations = readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .map((file) => join(dir, file));
    return [...migrations, join(process.cwd(), "supabase", "seed.sql")];
  }
  const files = argv.filter((arg) => !arg.startsWith("--"));
  if (files.length === 0) {
    console.error("\n  Pass a .sql file, or --all for every migration then the seed.\n");
    process.exit(1);
  }
  return files.map((file) => (file.startsWith("/") || /^[A-Za-z]:/.test(file) ? file : join(process.cwd(), file)));
}

async function main(): Promise<void> {
  const files = filesToApply(process.argv.slice(2));
  const client = new Client({
    connectionString: connectionString(),
    ssl: sslOptions(),
    statement_timeout: 120_000,
  });

  await client.connect();
  const { rows } = await client.query<{ db: string; version: string }>(
    "select current_database() as db, split_part(version(), ' on ', 1) as version",
  );
  console.log(`\nConnected to ${rows[0]?.db} (${rows[0]?.version})`);

  let applied = 0;
  try {
    for (const file of files) {
      const label = relative(process.cwd(), file).replace(/\\/g, "/");
      let sql: string;
      try {
        sql = readFileSync(file, "utf8");
      } catch {
        console.error(`  [skip] ${label} — not found`);
        continue;
      }

      process.stdout.write(`  applying ${label} … `);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("commit");
        applied += 1;
        console.log("ok");
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        const message = err instanceof Error ? err.message : String(err);
        console.log("FAILED");
        console.error(`\n  ${label} was rolled back:\n  ${message}\n`);
        process.exitCode = 1;
        return;
      }
    }
    console.log(`\n${applied} file(s) applied.\n`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(`\n  Failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
