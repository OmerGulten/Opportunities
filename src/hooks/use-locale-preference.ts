"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { useLocale } from "@/lib/i18n/client";
import type { Locale } from "@/types/common";

/** Mirrors LOCALE_COOKIE in src/lib/auth/context.ts, which is server-only. */
export const LOCALE_COOKIE = "oos_locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface LocalePreference {
  locale: Locale;
  setLocale: (next: Locale) => void;
  pending: boolean;
}

/**
 * Reads the active locale and writes the preference cookie (a UI preference,
 * not a secret), then refreshes so Server Components re-render translated.
 */
export function useLocalePreference(): LocalePreference {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
      startTransition(() => router.refresh());
    },
    [locale, router],
  );

  return { locale, setLocale, pending };
}
