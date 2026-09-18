import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app/app-sidebar";
import { Topbar } from "@/components/app/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getWorkspaceContext, requireAuth } from "@/lib/auth/context";

/** The shell reads cookies through the auth context on every request. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
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
