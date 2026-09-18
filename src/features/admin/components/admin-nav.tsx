"use client";

import { cn } from "cn";
import {
  Building2,
  Coins,
  LayoutDashboard,
  Layers,
  Plug,
  SlidersHorizontal,
  Tags,
  ToggleRight,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/lib/i18n/client";

interface AdminSection {
  href: string;
  /** Key under `nav.adminSections`. */
  labelKey: string;
  icon: LucideIcon;
}

/** Order mirrors the way an operator moves through the platform: usage, tenants, then configuration. */
export const ADMIN_SECTIONS: AdminSection[] = [
  { href: "/admin", labelKey: "overview", icon: LayoutDashboard },
  { href: "/admin/workspaces", labelKey: "workspaces", icon: Building2 },
  { href: "/admin/plans", labelKey: "plans", icon: Layers },
  { href: "/admin/credit-rules", labelKey: "creditRules", icon: Coins },
  { href: "/admin/services", labelKey: "services", icon: Wrench },
  { href: "/admin/scoring-rules", labelKey: "serviceRules", icon: SlidersHorizontal },
  { href: "/admin/categories", labelKey: "categories", icon: Tags },
  { href: "/admin/providers", labelKey: "providers", icon: Plug },
  { href: "/admin/feature-flags", labelKey: "featureFlags", icon: ToggleRight },
  { href: "/admin/jobs", labelKey: "failedJobs", icon: TriangleAlert },
];

/** `/admin` only matches exactly, so the overview tab does not stay lit on every child route. */
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ className }: { className?: string }) {
  const t = useT("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("groups.platform")} className={cn("-mx-1 flex items-center gap-1 overflow-x-auto px-1 py-1.5", className)}>
      {ADMIN_SECTIONS.map((section) => {
        const Icon = section.icon;
        const active = isActive(pathname, section.href);
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {t(`adminSections.${section.labelKey}`)}
          </Link>
        );
      })}
    </nav>
  );
}
