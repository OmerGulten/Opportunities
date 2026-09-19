/**
 * Static consistency check for the Supabase migrations and seed.
 *
 * We cannot execute the SQL in every environment (a live Postgres needs Docker),
 * so this catches the mistakes that would otherwise only surface at deploy time:
 *
 *  1. foreign keys pointing at a table or column that does not exist
 *  2. indexes / policies / triggers on a table that does not exist
 *  3. columns referenced by an index that the table does not have
 *  4. tables created without `enable row level security` (a tenant data leak)
 *  5. seed inserts naming a table or column that does not exist
 *  6. enum values used in SQL that the enum type does not declare
 *
 * It is a heuristic parser, not a Postgres front end: it understands the subset
 * of DDL this project writes. Run with: npx tsx scripts/check-sql.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const SEED_FILE = join(ROOT, "supabase", "seed.sql");

interface TableDef {
  name: string;
  columns: Set<string>;
  file: string;
}

const problems: string[] = [];
const warnings: string[] = [];

function problem(message: string) {
  problems.push(message);
}

/** Strip line comments and string/dollar-quoted literals so they cannot confuse the scanners. */
function stripNoise(sql: string): string {
  let out = sql.replace(/--[^\n]*/g, "");
  // dollar-quoted blocks ($$ ... $$ and $tag$ ... $tag$)
  out = out.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, " '' ");
  return out;
}

/** Split a parenthesised column list at top level (ignores nested parens). */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let inString = false;
  for (const ch of body) {
    if (ch === "'") inString = !inString;
    if (!inString) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Extract the body of `create table <name> ( ... );` with balanced parens. */
function extractCreateTables(sql: string, file: string): TableDef[] {
  const tables: TableDef[] = [];
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    const name = match[1];
    let depth = 1;
    let i = re.lastIndex;
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    const body = sql.slice(re.lastIndex, i - 1);
    const columns = new Set<string>();
    const CONSTRAINT_STARTS = /^(primary|unique|check|foreign|constraint|exclude|like)\b/i;
    for (const part of splitTopLevel(body)) {
      if (CONSTRAINT_STARTS.test(part)) continue;
      const col = /^([a-z_][a-z0-9_]*)\s/i.exec(part);
      if (col) columns.add(col[1].toLowerCase());
    }
    tables.push({ name, columns, file });
  }
  return tables;
}

function loadSql(): { migrations: { file: string; sql: string }[]; seed: string } {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const migrations = files.map((file) => ({ file, sql: readFileSync(join(MIGRATIONS_DIR, file), "utf8") }));
  let seed = "";
  try {
    seed = readFileSync(SEED_FILE, "utf8");
  } catch {
    warnings.push("supabase/seed.sql not found");
  }
  return { migrations, seed };
}

function main(): void {
  const { migrations, seed } = loadSql();
  if (migrations.length === 0) {
    problem("no migrations found in supabase/migrations");
    report();
    return;
  }

  const tables = new Map<string, TableDef>();
  const enums = new Map<string, Set<string>>();
  const rlsEnabled = new Set<string>();
  const combined = migrations.map((m) => stripNoise(m.sql)).join("\n");

  // ---- tables ----------------------------------------------------------
  for (const { file, sql } of migrations) {
    for (const table of extractCreateTables(stripNoise(sql), file)) {
      if (tables.has(table.name)) problem(`table "${table.name}" is created twice (${tables.get(table.name)!.file} and ${file})`);
      tables.set(table.name, table);
    }
  }

  // ---- columns added and removed later ---------------------------------
  //
  // One statement may carry several clauses:
  //
  //   alter table t add column a text, add column b text;
  //   alter table t drop column c;
  //
  // Matching `alter table <t> add column <c>` directly only ever sees the first
  // clause, so a second column stayed unknown and any index on it was reported
  // as referencing a column that does not exist. The statement is taken whole,
  // then every clause inside it is read.
  for (const stmt of combined.matchAll(/alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+([^;]*);/gi)) {
    const table = tables.get(stmt[1].toLowerCase());
    const body = stmt[2];
    const added = [...body.matchAll(/\badd\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)];
    const dropped = [...body.matchAll(/\bdrop\s+column\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)/gi)];
    if (added.length === 0 && dropped.length === 0) continue;
    if (!table) {
      problem(`alter table changes columns on unknown table "${stmt[1]}"`);
      continue;
    }
    for (const m of added) table.columns.add(m[1].toLowerCase());
    for (const m of dropped) table.columns.delete(m[1].toLowerCase());
  }

  // ---- enums -----------------------------------------------------------
  for (const m of combined.matchAll(/create\s+type\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+as\s+enum\s*\(([^)]*)\)/gi)) {
    const values = new Set([...m[2].matchAll(/'([^']*)'/g)].map((v) => v[1]));
    enums.set(m[1], values);
  }

  // ---- RLS -------------------------------------------------------------
  for (const m of combined.matchAll(/alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi)) {
    if (!tables.has(m[1])) problem(`row level security enabled on unknown table "${m[1]}"`);
    rlsEnabled.add(m[1]);
  }
  for (const name of tables.keys()) {
    if (!rlsEnabled.has(name)) problem(`table "${name}" has no "enable row level security" (multi-tenant leak risk)`);
  }

  // ---- foreign keys ----------------------------------------------------
  for (const m of combined.matchAll(/references\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(\s*([a-z_][a-z0-9_]*)\s*\)/gi)) {
    const [, targetTable, targetColumn] = m;
    if (targetTable === "users") continue; // auth.users lives in another schema
    const table = tables.get(targetTable);
    if (!table) {
      problem(`foreign key references unknown table "${targetTable}"`);
    } else if (!table.columns.has(targetColumn.toLowerCase())) {
      problem(`foreign key references unknown column "${targetTable}.${targetColumn}"`);
    }
  }

  // ---- indexes ---------------------------------------------------------
  for (const m of combined.matchAll(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([^;]*?)\)\s*(?:where[^;]*)?;/gi)) {
    const [, indexName, tableName, columnList] = m;
    const table = tables.get(tableName);
    if (!table) {
      problem(`index "${indexName}" is defined on unknown table "${tableName}"`);
      continue;
    }
    for (const rawColumn of splitTopLevel(columnList)) {
      // Only plain column references are checked; expressions are skipped.
      const plain = /^([a-z_][a-z0-9_]*)(\s+(asc|desc))?(\s+nulls\s+(first|last))?$/i.exec(rawColumn.trim());
      if (!plain) continue;
      const column = plain[1].toLowerCase();
      if (!table.columns.has(column)) problem(`index "${indexName}" references unknown column "${tableName}.${column}"`);
    }
  }

  // ---- policies and triggers ------------------------------------------
  for (const m of combined.matchAll(/create\s+policy\s+([a-z_][a-z0-9_]*)\s+on\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
    if (!tables.has(m[2])) problem(`policy "${m[1]}" is defined on unknown table "${m[2]}"`);
  }
  for (const m of combined.matchAll(/create\s+trigger\s+([a-z_][a-z0-9_]*)\s+(?:before|after|instead\s+of)\s+[a-z\s,]+?\s+on\s+([a-z_][a-z0-9_]*)(?:\.([a-z_][a-z0-9_]*))?/gi)) {
    const [, triggerName, first, second] = m;
    const schema = second ? first : "public";
    const table = second ?? first;
    if (schema !== "public") continue; // e.g. auth.users lives in another schema
    if (!tables.has(table)) problem(`trigger "${triggerName}" is defined on unknown table "${table}"`);
  }

  // ---- enum literals used in casts -------------------------------------
  for (const [typeName, values] of enums) {
    const castRe = new RegExp(`'([^']*)'\\s*::\\s*(?:public\\.)?${typeName}\\b`, "gi");
    for (const m of combined.matchAll(castRe)) {
      if (!values.has(m[1])) problem(`value '${m[1]}' is not a member of enum ${typeName}`);
    }
  }

  // ---- seed ------------------------------------------------------------
  if (seed) {
    const seedSql = stripNoise(seed);
    for (const m of seedSql.matchAll(/insert\s+into\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/gi)) {
      const [, tableName, columnList] = m;
      const table = tables.get(tableName);
      if (!table) {
        problem(`seed inserts into unknown table "${tableName}"`);
        continue;
      }
      for (const raw of columnList.split(",")) {
        const column = raw.trim().toLowerCase();
        if (!column || !/^[a-z_][a-z0-9_]*$/.test(column)) continue;
        if (!table.columns.has(column)) problem(`seed inserts unknown column "${tableName}.${column}"`);
      }
    }
    for (const [typeName, values] of enums) {
      const castRe = new RegExp(`'([^']*)'\\s*::\\s*(?:public\\.)?${typeName}\\b`, "gi");
      for (const m of seedSql.matchAll(castRe)) {
        if (!values.has(m[1])) problem(`seed uses '${m[1]}' which is not a member of enum ${typeName}`);
      }
    }
  }

  console.log(`Checked ${tables.size} tables, ${enums.size} enum types across ${migrations.length} migration file(s).`);
  report();
}

function report(): void {
  for (const w of warnings) console.warn(`warn  ${w}`);
  if (problems.length === 0) {
    console.log("SQL consistency check passed.");
    return;
  }
  for (const p of problems) console.error(`error ${p}`);
  console.error(`\n${problems.length} problem(s) found.`);
  process.exitCode = 1;
}

main();
