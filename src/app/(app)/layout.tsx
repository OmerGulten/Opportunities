import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { Topbar } from "@/components/app/topbar";
import { InlineAlert } from "@/components/shared";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getRequestLocale, getWorkspaceContext, requireAuth } from "@/lib/auth/context";
import { isSupabaseConfigured } from "@/lib/config/env";
import { getT } from "@/lib/i18n";

/** The shell reads cookies through the auth context on every request. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Without Supabase every authenticated route would throw a generic error.
  // Say what is actually missing instead, the way the sign-in page does.
  if (!isSupabaseConfigured()) {
    const t = getT(await getRequestLocale(), "errors");
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <InlineAlert tone="attention" title={t("generic")}>
            {t("supabaseNotConfigured")}
          </InlineAlert>
        </div>
      </div>
    );
  }

  await requireAuth();
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/onboarding");

  return (
    <SidebarProvider className="flex-1">
      <AppSidebar
        currentWorkspaceId={ctx.workspace.id}
        workspaces={ctx.memberships.map((membership) => ({
          id: membership.workspace.id,
          name: membership.workspace.name,
          slug: membership.workspace.slug,
          role: membership.role,
        }))}
        user={{
          displayName: ctx.profile.display_name,
          email: ctx.profile.email ?? ctx.user.email,
          avatarUrl: ctx.profile.avatar_url,
        }}
        isPlatformAdmin={ctx.profile.is_platform_admin}
      />
      <SidebarInset className="min-w-0">
        <Topbar />
        <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
