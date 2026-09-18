import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DemoBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getRequestLocale } from "@/lib/auth/context";
import { getDemoFlags } from "@/lib/config/env";
import { getT } from "@/lib/i18n";

import { CreditsPill } from "./credits-pill";

export interface TopbarProps {
  /** Breadcrumb or page-title slot rendered by the route segment. */
  breadcrumbs?: ReactNode;
}

function anyProviderInDemoMode(): boolean {
  try {
    return getDemoFlags().any;
  } catch {
    // Environment could not be parsed; do not claim a mode we cannot verify.
    return false;
  }
}

export async function Topbar({ breadcrumbs }: TopbarProps) {
  const locale = await getRequestLocale();
  const t = getT(locale, "nav");
  const demo = anyProviderInDemoMode();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-backdrop-filter:bg-background/70">
      <SidebarTrigger aria-label={t("toggleSidebar")} />
      <Separator orientation="vertical" className="mx-1 h-4" />
      <div className="flex min-w-0 flex-1 items-center gap-2">{breadcrumbs}</div>
      <div className="flex shrink-0 items-center gap-2">
        {demo ? <DemoBadge /> : null}
        <CreditsPill />
        <Button size="sm" render={<Link href="/scans/new" />}>
          <Plus />
          <span className="hidden sm:inline">{t("newScan")}</span>
        </Button>
      </div>
    </header>
  );
}
