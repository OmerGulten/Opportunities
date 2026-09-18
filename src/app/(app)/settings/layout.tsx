import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared";
import { SettingsNav } from "@/features/settings/components/settings-nav";
import { requireWorkspaceContext } from "@/lib/auth/context";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "settings");
  return { title: t("title"), description: t("description") };
}

/** Shared frame for every settings section: one header plus the section nav. */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const ctx = await requireWorkspaceContext();
  const t = getT(ctx.locale, "settings");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid min-w-0 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
        <SettingsNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
