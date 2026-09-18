import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLockup } from "@/components/app/logo";
import { UserMenu } from "@/components/app/user-menu";
import { LocaleSwitcher, ThemeToggle } from "@/components/shared";
import { getRequestLocale, requireAuth } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** Minimal chrome: the user has an account but not necessarily a workspace. */
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const ctx = await requireAuth();
  const locale = await getRequestLocale();
  const tn = getT(locale, "nav");

  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label={tn("home")}>
          <BrandLockup size={24} />
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <UserMenu
            variant="compact"
            displayName={ctx.profile.display_name}
            email={ctx.profile.email ?? ctx.user.email}
            avatarUrl={ctx.profile.avatar_url}
            isPlatformAdmin={ctx.profile.is_platform_admin}
          />
        </div>
      </header>
      <main className="flex flex-1 justify-center px-4 py-8 md:py-12">{children}</main>
    </div>
  );
}
