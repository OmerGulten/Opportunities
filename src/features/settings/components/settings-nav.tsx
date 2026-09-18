"use client";

import { cn } from "cn";
import { Building2, CreditCard, KeyRound, Layers, Plug, Sparkles, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/lib/i18n/client";

interface SettingsSection {
  href: string;
  /** Key under `settings.nav` / `settings.navDescription`. */
  key: string;
  icon: typeof User;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { href: "/settings/profile", key: "profile", icon: User },
  { href: "/settings/workspace", key: "workspace", icon: Building2 },
  { href: "/settings/services", key: "services", icon: Layers },
  { href: "/settings/team", key: "team", icon: Users },
  { href: "/settings/integrations", key: "integrations", icon: Plug },
  { href: "/settings/ai", key: "ai", icon: Sparkles },
  { href: "/settings/billing", key: "billing", icon: CreditCard },
  { href: "/settings/api-keys", key: "apiKeys", icon: KeyRound },
];

/** Section navigation for the settings area; scrolls horizontally on phones. */
export function SettingsNav() {
  const t = useT("settings");
  const pathname = usePathname();

  return (
    <nav aria-label={t("nav.label")} className="lg:sticky lg:top-6">
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
          return (
            <li key={section.href} className="shrink-0 lg:shrink">
              <Link
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("mt-0.5 size-4 shrink-0", active && "text-primary")} />
                <span className="flex min-w-0 flex-col">
                  <span className="whitespace-nowrap">{t(`nav.${section.key}`)}</span>
                  <span className="hidden text-xs font-normal text-muted-foreground lg:block">{t(`navDescription.${section.key}`)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
