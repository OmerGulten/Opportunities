"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import type { Locale } from "@/types/common";

import type { Dictionary, Namespace } from "./config";
import { createTranslator, type TFunction } from "./translate";

interface I18nContextValue {
  locale: Locale;
  dictionaries: Record<Locale, Dictionary>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Wrap client trees that need translations. The server layout passes the
 * locale and the dictionaries (small, static objects).
 */
export function I18nProvider({ locale, dictionaries, children }: { locale: Locale; dictionaries: Record<Locale, Dictionary>; children: ReactNode }) {
  const value = useMemo(() => ({ locale, dictionaries }), [locale, dictionaries]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): Locale {
  const ctx = useContext(I18nContext);
  return ctx?.locale ?? "tr";
}

/** `const t = useT("scans"); t("wizard.title", { count: 3 })` */
const identityT: TFunction = (key) => key;

export function useT(namespace: Namespace): TFunction {
  const ctx = useContext(I18nContext);
  const locale = ctx?.locale ?? "tr";
  const dictionaries = ctx?.dictionaries;
  const translator = useMemo(() => (dictionaries ? createTranslator(dictionaries, locale, namespace) : identityT), [dictionaries, locale, namespace]);
  return translator;
}

/** Format helpers bound to the active locale. */
export function useFormatters() {
  const locale = useLocale();
  const tag = locale === "en" ? "en-GB" : "tr-TR";
  const number = useCallback((n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(tag, opts).format(n), [tag]);
  const currency = useCallback((n: number, currency = "TRY") => new Intl.NumberFormat(tag, { style: "currency", currency, maximumFractionDigits: 0 }).format(n), [tag]);
  const date = useCallback((d: string | Date, opts?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, opts ?? { dateStyle: "medium" }).format(new Date(d)), [tag]);
  const dateTime = useCallback((d: string | Date) => new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short" }).format(new Date(d)), [tag]);
  const relative = useCallback(
    (d: string | Date) => {
      const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
      const diffMs = new Date(d).getTime() - Date.now();
      const abs = Math.abs(diffMs);
      const minutes = Math.round(diffMs / 60000);
      if (abs < 3600_000) return rtf.format(minutes, "minute");
      const hours = Math.round(diffMs / 3600_000);
      if (abs < 86400_000) return rtf.format(hours, "hour");
      const days = Math.round(diffMs / 86400_000);
      if (abs < 30 * 86400_000) return rtf.format(days, "day");
      const months = Math.round(days / 30);
      return rtf.format(months, "month");
    },
    [tag],
  );
  return { locale, number, currency, date, dateTime, relative };
}
