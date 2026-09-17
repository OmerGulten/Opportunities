import type { Locale } from "@/types/common";

import type { Dictionary, MessageTree, Namespace } from "./config";

export type TranslateParams = Record<string, string | number | null | undefined>;

export type TFunction = (key: string, params?: TranslateParams) => string;

function lookup(tree: MessageTree | undefined, path: string[]): string | undefined {
  let node: string | MessageTree | undefined = tree;
  for (const segment of path) {
    if (node === undefined || typeof node === "string") return undefined;
    node = node[segment];
  }
  return typeof node === "string" ? node : undefined;
}

export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name: string) => {
    const value = params[name];
    return value === null || value === undefined ? "" : String(value);
  });
}

/**
 * Creates a translate function bound to a namespace with fallback chain:
 * requested locale -> fallback locale -> the key itself (never "undefined").
 */
export function createTranslator(dictionaries: Record<Locale, Dictionary>, locale: Locale, namespace: Namespace, fallbackLocale: Locale = "en"): TFunction {
  const primary = dictionaries[locale]?.[namespace];
  const fallback = dictionaries[fallbackLocale]?.[namespace];
  return (key, params) => {
    const path = key.split(".");
    const template = lookup(primary, path) ?? lookup(fallback, path) ?? (locale !== "tr" ? lookup(dictionaries.tr?.[namespace], path) : undefined) ?? key;
    return interpolate(template, params);
  };
}

/** Translate a fully-qualified key "namespace.path.to.key". */
export function createGlobalTranslator(dictionaries: Record<Locale, Dictionary>, locale: Locale): TFunction {
  return (fullKey, params) => {
    const [ns, ...rest] = fullKey.split(".");
    const t = createTranslator(dictionaries, locale, ns as Namespace);
    return t(rest.join("."), params);
  };
}
