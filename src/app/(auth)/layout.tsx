import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLockup } from "@/components/app/logo";
import { LocaleSwitcher, ThemeToggle } from "@/components/shared";
import { getRequestLocale } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await getRequestLocale();
  const t = getT(locale, "auth");
  const tn = getT(locale, "nav");

  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={tn("home")}>
          <BrandLockup size={24} />
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="surface-signal-glow flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <p className="text-center text-sm text-balance text-muted-foreground">{t("brandPitch")}</p>
          <div className="panel p-5">{children}</div>
        </div>
      </main>
      <footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-6 text-xs text-muted-foreground">
        <Link href="/legal/terms" className="transition-colors hover:text-foreground">
          {tn("legal.terms")}
        </Link>
        <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
          {tn("legal.privacy")}
        </Link>
        <Link href="/legal/cookies" className="transition-colors hover:text-foreground">
          {tn("legal.cookies")}
        </Link>
      </footer>
    </div>
  );
}
