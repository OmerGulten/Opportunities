/**
 * Verifies that the Turkish and English dictionaries stay in step.
 *
 * A missing key does not crash at runtime (the translator falls back and then
 * returns the key itself), which is exactly why it needs a check: an English
 * user would silently see `scans.wizard.title` instead of a label. This fails
 * the build instead.
 *
 * Also catches placeholder mismatches, so `{{count}}` cannot exist in one
 * language and be absent in the other.
 *
 * Run with: npx tsx scripts/check-i18n.ts
 */
import { dictionaries, NAMESPACES, type Namespace } from "../src/lib/i18n";
import type { MessageTree } from "../src/lib/i18n/config";

type Leaves = Map<string, string>;

const problems: string[] = [];

/** Flattens a message tree to dot-paths so two trees can be compared directly. */
function flatten(tree: MessageTree, prefix = "", out: Leaves = new Map()): Leaves {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else flatten(value, path, out);
  }
  return out;
}

function placeholders(template: string): Set<string> {
  return new Set([...template.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]));
}

function compareNamespace(namespace: Namespace): { keys: number } {
  const tr = flatten((dictionaries.tr[namespace] ?? {}) as MessageTree);
  const en = flatten((dictionaries.en[namespace] ?? {}) as MessageTree);

  for (const key of tr.keys()) {
    if (!en.has(key)) problems.push(`${namespace}.${key} is missing from en`);
  }
  for (const key of en.keys()) {
    if (!tr.has(key)) problems.push(`${namespace}.${key} is missing from tr`);
  }

  for (const [key, trValue] of tr) {
    const enValue = en.get(key);
    if (enValue === undefined) continue;

    const trPlaceholders = placeholders(trValue);
    const enPlaceholders = placeholders(enValue);
    for (const name of trPlaceholders) {
      if (!enPlaceholders.has(name)) problems.push(`${namespace}.${key}: en is missing the {{${name}}} placeholder`);
    }
    for (const name of enPlaceholders) {
      if (!trPlaceholders.has(name)) problems.push(`${namespace}.${key}: tr is missing the {{${name}}} placeholder`);
    }
    if (trValue.trim() === "") problems.push(`${namespace}.${key}: tr value is empty`);
    if (enValue.trim() === "") problems.push(`${namespace}.${key}: en value is empty`);
  }

  return { keys: tr.size };
}

function main(): void {
  let total = 0;
  const empty: string[] = [];

  for (const namespace of NAMESPACES) {
    const { keys } = compareNamespace(namespace);
    total += keys;
    // An unfilled namespace is expected while a feature is still being built.
    if (keys === 0) empty.push(namespace);
  }

  console.log(`Checked ${NAMESPACES.length} namespaces, ${total} keys in tr.`);
  if (empty.length > 0) console.log(`Not yet filled: ${empty.join(", ")}`);

  if (problems.length === 0) {
    console.log("i18n check passed: tr and en are in step.");
    return;
  }
  for (const problem of problems) console.error(`error ${problem}`);
  console.error(`\n${problems.length} problem(s) found.`);
  process.exitCode = 1;
}

main();
