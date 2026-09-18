"use client";

import Link from "next/link";

import { GoogleAttribution } from "@/components/shared";
import { useT } from "@/lib/i18n/client";

import { BrandLockup } from "./logo";

const LEGAL_LINKS = [
  { href: "/legal/terms", labelKey: "terms" },
  { href: "/legal/privacy", labelKey: "privacy" },
  { href: "/legal/cookies", labelKey: "cookies" },
  { href: "/legal/ai-disclosure", labelKey: "aiDisclosure" },
];

export function MarketingFooter() {
  const t = useT("marketing");
  const tn = useT("nav");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-sm space-y-3">
            <BrandLockup size={24} />
            <p className="text-sm text-muted-foreground">{t("footer.tagline")}</p>
          </div>
          <div className="flex gap-12">
            <nav className="space-y-2" aria-label={t("footer.product")}>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("footer.product")}</p>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <Link href="/sign-in" className="text-muted-foreground transition-colors hover:text-foreground">
                    {tn("signIn")}
                  </Link>
                </li>
                <li>
                  <Link href="/sign-up" className="text-muted-foreground transition-colors hover:text-foreground">
                    {tn("signUp")}
                  </Link>
                </li>
              </ul>
            </nav>
            <nav className="space-y-2" aria-label={t("footer.legalTitle")}>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("footer.legalTitle")}</p>
              <ul className="space-y-1.5 text-sm">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-muted-foreground transition-colors hover:text-foreground">
                      {tn(`legal.${link.labelKey}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("footer.copyright", { year })}</p>
          <div className="flex flex-col gap-1 sm:items-end">
            <GoogleAttribution variant="full" />
            <p className="max-w-md sm:text-right">{t("footer.attribution")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
