"use client";

import { Cookie } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

const STORAGE_KEY = "oos.cookie-notice.v1";
const ACKNOWLEDGED = "acknowledged";

let listeners: Array<() => void> = [];

function subscribe(onChange: () => void): () => void {
  listeners = [...listeners, onChange];
  return () => {
    listeners = listeners.filter((listener) => listener !== onChange);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Storage blocked (private mode, blocked cookies): stay quiet rather than
    // showing a notice that cannot be dismissed.
    return ACKNOWLEDGED;
  }
}

/** Server render never shows the notice, so hydration stays stable. */
function getServerSnapshot(): string {
  return ACKNOWLEDGED;
}

function acknowledge(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, ACKNOWLEDGED);
  } catch {
    // Ignored: the notice hides for this session either way.
  }
  emit();
}

/**
 * Informational cookie notice. The app sets only essential cookies (session,
 * workspace preference, locale), so this asks for acknowledgement rather than
 * consent and never blocks the page.
 */
export function CookieConsent() {
  const t = useT("marketing");
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (state === ACKNOWLEDGED) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <div
        role="region"
        aria-label={t("cookies.title")}
        className="pointer-events-auto flex w-full max-w-2xl flex-col gap-3 rounded-xl bg-popover p-4 text-sm shadow-lg ring-1 ring-foreground/10 sm:flex-row sm:items-center"
      >
        <Cookie className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t("cookies.title")}</p>
          <p className="text-muted-foreground">{t("cookies.description")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/legal/cookies" />}>
            {t("cookies.details")}
          </Button>
          <Button size="sm" onClick={acknowledge}>
            {t("cookies.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
