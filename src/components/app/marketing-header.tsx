"use client";

import Link from "next/link";

import { LocaleSwitcher, ThemeToggle } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

import { BrandLockup } from "./logo";

const SECTION_LINKS = [
  { href: "/#how-it-works", labelKey: "nav.howItWorks" },
  { href: "/#scoring", labelKey: "nav.scoring" },
  { href: "/#principles", labelKey: "nav.principles" },
  { href: "/#pricing", labelKey: "nav.pricing" },
];

export interface MarketingHeaderProps {
  /** Swaps the sign-in pair for a dashboard link. */
  isAuthenticated?: boolean;
}

export function MarketingHeader({ isAuthenticated = false }: MarketingHeaderProps) {
  const t = useT("marketing");
  const tn = useT("nav");

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={tn("home")}>
          <BrandLockup size={24} />
        </Link>
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label={tn("home")}>
          {SECTION_LINKS.map((link) => (
            <Button key={link.href} variant="ghost" size="sm" render={<Link href={link.href} />}>
              {t(link.labelKey)}
            </Button>
          ))}
        </nav>
        <div className="flex flex-1 items-center justify-end gap-1 md:flex-none">
          <LocaleSwitcher />
          <ThemeToggle />
          {isAuthenticated ? (
            <Button size="sm" render={<Link href="/dashboard" />}>
              {tn("goToDashboard")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/sign-in" />}>
                {tn("signIn")}
              </Button>
              <Button size="sm" render={<Link href="/sign-up" />}>
                {tn("signUp")}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
