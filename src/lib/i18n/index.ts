import type { Locale } from "@/types/common";

import type { Dictionary, Namespace } from "./config";
import { en } from "./messages/en";
import { tr } from "./messages/tr";
import { createGlobalTranslator, createTranslator, type TFunction } from "./translate";

export type { Dictionary, Namespace, MessageTree } from "./config";
export { NAMESPACES, LOCALE_LABELS, isLocale } from "./config";
export type { TFunction, TranslateParams } from "./translate";
export { interpolate } from "./translate";

export const dictionaries: Record<Locale, Dictionary> = { tr, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.tr;
}

/**
 * Server Components / server code: `const t = getT(locale, "scans"); t("wizard.title")`.
 * Synchronous because dictionaries are bundled.
 */
export function getT(locale: Locale, namespace: Namespace): TFunction {
  return createTranslator(dictionaries, locale, namespace);
}

/** `tg("scans.wizard.title")` — namespace-qualified keys. */
export function getGlobalT(locale: Locale): TFunction {
  return createGlobalTranslator(dictionaries, locale);
}

/** Pick the localized column of a bilingual DB row (name_tr / name_en). */
export function pickLocalized<T extends Record<string, unknown>>(row: T, base: string, locale: Locale): string {
  const key = `${base}_${locale}` as keyof T;
  const fallback = `${base}_tr` as keyof T;
  const value = (row[key] ?? row[fallback]) as unknown;
  return typeof value === "string" ? value : "";
}

export const dateLocaleTag: Record<Locale, string> = { tr: "tr-TR", en: "en-GB" };
