import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminNav } from "@/features/admin/components/admin-nav";
import { InlineAlert, LocaleSwitcher, ThemeToggle } from "@/components/shared";
import { getAuthContext, getRequestLocale, requirePlatformAdmin } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

import { isPlatformDataAvailable } from "./_data";

/** Platform admin reads cookies and cross-tenant counters on every request. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · OpportunityOS" },
  robots: { index: false, follow: false },
};

/**
 * Platform admin shell.
 *
 * Deliberately *not* the workspace chrome: there is no sidebar, no workspace
 * switcher and no teal accent. The ink bar and amber accents are the signal
 * that nothing here is scoped to a single tenant.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await requirePlatformAdmin().catch(() => null);
  if (!ctx) {
    const auth = await getAuthContext();
    redirect(auth ? "/dashboard" : "/sign-in");
  }

  const locale = await getRequestLocale();
  const t = getT(locale, "admin");
  const tn = getT(locale, "nav");
  const configured = isPlatformDataAvailable();

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-background">
      <header className="sticky top-0 z-30">
        <div className="border-b border-slate-800/60 bg-slate-950 text-slate-100">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-2.5 md:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
                <ShieldCheck className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-heading text-sm leading-tight font-semibold tracking-tight">{t("brand")}</p>
                <p className="hidden truncate text-xs text-slate-400 sm:block">{t("brandHint")}</p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors outline-none hover:bg-slate-800 focus-visible:ring-3 focus-visible:ring-slate-500/50"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">{t("backToApp")}</span>
              <span className="sm:hidden">{tn("dashboard")}</span>
            </Link>
          </div>
        </div>
        <div className="border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 md:px-6">
            <AdminNav className="min-w-0 flex-1" />
            <div className="flex shrink-0 items-center gap-1">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        {configured ? null : (
          <InlineAlert tone="negative" title={t("common.notConfiguredTitle")}>
            {t("common.notConfigured")}
          </InlineAlert>
        )}
        {children}
      </main>
    </div>
  );
}
