import { describe, expect, it } from "vitest";

import { dictionaries, getT } from "@/lib/i18n";
import type { MessageTree } from "@/lib/i18n";
import { LOCALES } from "@/types/common";
import { SIGNAL_TYPES } from "@/types/signals";

import { UNAVAILABLE_REASONS, signalMessageKey } from "./signal";

function flatten(tree: MessageTree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    return typeof value === "string" ? [path] : flatten(value, path);
  });
}

describe("findings namespace", () => {
  it("has identical key sets in tr and en", () => {
    const tr = flatten(dictionaries.tr.findings).sort();
    const en = flatten(dictionaries.en.findings).sort();
    expect(tr).toEqual(en);
    expect(tr.length).toBeGreaterThan(200);
  });

  it("explains every signal type in every locale", () => {
    for (const locale of LOCALES) {
      const t = getT(locale, "findings");
      for (const signalType of Object.values(SIGNAL_TYPES)) {
        const key = signalMessageKey(signalType);
        expect(t(key), `${locale}: ${key}`).not.toBe(key);
      }
    }
  });

  it("explains every reason a signal can be unavailable", () => {
    for (const locale of LOCALES) {
      const t = getT(locale, "findings");
      for (const reason of UNAVAILABLE_REASONS) {
        expect(t(`unavailable.${reason}`), `${locale}: ${reason}`).not.toBe(`unavailable.${reason}`);
      }
    }
  });

  it("gives every finding a title, an explanation and a reason it matters", () => {
    for (const locale of LOCALES) {
      const tree = dictionaries[locale].findings;
      for (const [key, value] of Object.entries(tree)) {
        if (typeof value === "string" || ["signal", "unavailable", "value", "method", "note", "benchmark"].includes(key)) continue;
        expect(Object.keys(value).sort(), `${locale}: ${key}`).toEqual(["explanation", "title", "why"]);
        for (const text of Object.values(value)) {
          expect(typeof text).toBe("string");
          expect(String(text).length).toBeGreaterThan(5);
        }
      }
    }
  });

  it("leaves no unresolved placeholder in the shared words", () => {
    for (const locale of LOCALES) {
      const t = getT(locale, "findings");
      for (const word of ["value.yes", "value.no", "value.unknown", "value.weak", "value.average", "value.strong", "method.heuristic", "method.measured"]) {
        expect(t(word)).not.toContain("{{");
        expect(t(word)).not.toBe(word);
      }
    }
  });
});
